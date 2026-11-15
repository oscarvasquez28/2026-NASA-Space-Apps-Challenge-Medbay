/**
 * MockHealthDataProvider — deterministic, offline implementation.
 *
 * Curated datasets live in data/. Triage evaluation reproduces the
 * deterministic rules from backend/app/triage/engine.py so the simulated
 * path matches the real engine's contract (thresholds belong to the
 * provider, never to UI components).
 */

import {
  COMPANION_SKINS,
  DAILY_CHECKLIST,
} from "@/data/gamification";
import { CREW, getCrewMember } from "@/data/crew";
import {
  DEFAULT_LOCATION,
  getLocationProfile,
  LOCATION_PROFILES,
} from "@/data/mission";
import { buildTelemetrySeries } from "@/data/telemetry";
import type {
  AssistantRequest,
  HealthDataProvider,
} from "./health-provider";
import type {
  AssistantResponse,
  BehaviorLog,
  BodyZone,
  CrewMember,
  GamificationState,
  HealthResponse,
  LocationId,
  LocationProfile,
  LogAck,
  SkinDef,
  TelemetryMetric,
  TelemetrySeries,
  TriageAssessment,
  TriageLevel,
  VitalSigns,
  ZoneId,
} from "@/types/health";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => sleep(90 + Math.random() * 220);

const ORDER: TriageLevel[] = ["NOMINAL", "CAUTION", "URGENT", "CRITICAL"];

function escalate(cur: TriageLevel, next: TriageLevel): TriageLevel {
  return ORDER.indexOf(next) > ORDER.indexOf(cur) ? next : cur;
}

/** Mirrors backend/app/triage/engine.py deterministic baseline rules. */
function evaluateLocally(v: VitalSigns): TriageAssessment {
  const flags: string[] = [];
  const actions: string[] = [];
  let severity: TriageLevel = "NOMINAL";

  if (v.spo2_percent < 90) {
    flags.push(`Severe hypoxemia risk (SpO2=${v.spo2_percent.toFixed(1)}%)`);
    actions.push(
      "Verify suit/cabin O2 supply and inspect mask seal immediately.",
    );
    severity = escalate(severity, "CRITICAL");
  } else if (v.spo2_percent < 94) {
    flags.push(
      `Borderline low oxygen saturation (SpO2=${v.spo2_percent.toFixed(1)}%)`,
    );
    actions.push(
      "Increase O2 flow monitoring and re-check pulse oximeter placement.",
    );
    severity = escalate(severity, "URGENT");
  }

  if (v.heart_rate_bpm < 40 || v.heart_rate_bpm > 150) {
    flags.push(`Extreme heart rate (${v.heart_rate_bpm.toFixed(0)} bpm)`);
    actions.push(
      "Initiate ECG telemetry review and halt strenuous EVA/IVA activity.",
    );
    severity = escalate(severity, "CRITICAL");
  } else if (v.heart_rate_bpm < 50 || v.heart_rate_bpm > 120) {
    flags.push(
      `Elevated/abnormal heart rate (${v.heart_rate_bpm.toFixed(0)} bpm)`,
    );
    actions.push(
      "Monitor resting heart rate over next 5 minutes and assess hydration.",
    );
    severity = escalate(severity, "CAUTION");
  }

  if (v.core_temp_c >= 39 || v.core_temp_c <= 35) {
    flags.push(`Critical core temperature (${v.core_temp_c.toFixed(1)} C)`);
    actions.push(
      "Adjust Liquid Cooling and Ventilation Garment (LCVG) thermal loop.",
    );
    severity = escalate(severity, "URGENT");
  } else if (v.core_temp_c >= 38 || v.core_temp_c <= 35.8) {
    flags.push(`Core temperature deviation (${v.core_temp_c.toFixed(1)} C)`);
    actions.push(
      "Check thermal loop setpoint and log repeat core temperature.",
    );
    severity = escalate(severity, "CAUTION");
  }

  if (v.suit_pressure_kpa != null && v.suit_pressure_kpa < 25) {
    flags.push(`Low suit pressure (${v.suit_pressure_kpa.toFixed(1)} kPa)`);
    actions.push(
      "Execute emergency depressurization protocol and return to airlock.",
    );
    severity = escalate(severity, "CRITICAL");
  }

  const summary = flags.length
    ? `Detected ${flags.length} anomaly flag(s); triage level classified as ${severity}.`
    : "All monitored physiological and suit parameters are within nominal range.";
  if (!flags.length) actions.push("Continue nominal telemetry monitoring.");

  return {
    astronaut_id: v.astronaut_id,
    triage_level: severity,
    anomaly_flags: flags,
    recommended_actions: actions,
    summary,
    ai_advisory: null,
    evaluated_at: new Date().toISOString(),
  };
}

/* ---------------- assistant intent engine (simulated) ---------------- */

const ZONE_KEYWORDS: Record<ZoneId, RegExp> = {
  chest: /heart|cardio|chest|pulse|spo2|oxygen|breath/i,
  head: /head|brain|neuro|sleep|stress|cogni|mood/i,
  spine: /spine|back|bone|skelet|posture/i,
  limbs: /arm|leg|limb|muscle|grip|exertion|strength/i,
  gut: /gut|stomach|glucose|microbiome|digest|nutrition|food/i,
  skin: /skin|suit|radiation|pressure|thermal|surface/i,
};

function detectZones(prompt: string): ZoneId[] {
  return (Object.keys(ZONE_KEYWORDS) as ZoneId[]).filter((z) =>
    ZONE_KEYWORDS[z].test(prompt),
  );
}

function zoneByName(member: CrewMember, id: ZoneId): BodyZone {
  return member.zones.find((z) => z.id === id)!;
}

function worstZones(member: CrewMember): BodyZone[] {
  return [...member.zones].sort(
    (a, b) => ORDER.indexOf(b.status) - ORDER.indexOf(a.status),
  );
}

function vitalsLine(z: BodyZone): string {
  return z.vitals.map((v) => `${v.label} ${v.value} ${v.unit}`).join(" · ");
}

function respond(
  member: CrewMember,
  req: AssistantRequest,
): AssistantResponse {
  const location = getLocationProfile(req.locationId);
  const mode = location.linkMode;
  const prompt = req.prompt.toLowerCase();

  const assumptions = [
    "Simulated companion — responses are composed from curated telemetry, not a live medical model.",
    `Link mode: ${mode === "local" ? "LOCAL (offline-capable, Earth relay degraded)" : "ADVISORY (Earth relay reachable)"} — ${location.label}.`,
  ];

  const build = (
    message: string,
    zoneIds: ZoneId[],
    extraInsights = true,
  ): AssistantResponse => {
    const referencedZoneIds = [
      ...new Set(
        zoneIds.length ? zoneIds : worstZones(member).slice(0, 2).map((z) => z.id),
      ),
    ];
    return {
      message,
      referencedZoneIds,
      actions: referencedZoneIds.slice(0, 2).map((zoneId) => ({
        type: "focus" as const,
        zoneId,
      })),
      insights: extraInsights
        ? member.insights.filter(
            (i) => !i.zoneId || referencedZoneIds.includes(i.zoneId),
          )
        : [],
      assumptions,
      mode,
    };
  };

  // Context-biased: asking while a zone is focused.
  if (req.contextZoneId && detectZones(prompt).length === 0) {
    const z = zoneByName(member, req.contextZoneId);
    return build(
      `${z.name} is ${z.status}. ${z.description} Current readings — ${vitalsLine(z)}.`,
      [z.id],
    );
  }

  if (/explain|status|how.*(is|am|feel)|summary|overview/.test(prompt)) {
    const worst = worstZones(member);
    const flagged = worst.filter((z) => z.status !== "NOMINAL");
    const msg = flagged.length
      ? `${member.callsign} shows ${flagged.length} zone(s) above nominal. Worst: ${flagged[0].name} at ${flagged[0].status} — ${vitalsLine(flagged[0])}. Remaining zones stay inside the reference corridor.`
      : `${member.callsign} is fully nominal across all ${member.zones.length} monitored zones. Readiness ${member.readiness.score}/100 (${member.readiness.label}).`;
    return build(msg, flagged.slice(0, 3).map((z) => z.id));
  }

  if (/critical|worst|urgent|danger|alert|flag/.test(prompt)) {
    const flagged = worstZones(member).filter((z) => z.status !== "NOMINAL");
    const msg = flagged.length
      ? `Flagged zones: ${flagged.map((z) => `${z.name} (${z.status})`).join(", ")}. I'm highlighting the highest-severity region now.`
      : `No flagged zones — every monitored region reads NOMINAL.`;
    return build(msg, flagged.slice(0, 3).map((z) => z.id));
  }

  if (/eva|prep|spacewalk|suit up/.test(prompt)) {
    const skin = zoneByName(member, "skin");
    const limbs = zoneByName(member, "limbs");
    return build(
      `EVA prep for ${member.callsign}: readiness ${member.readiness.score}/100 (${member.readiness.label}). Suit layer reads ${vitalsLine(skin)}; limbs at ${vitalsLine(limbs)}. Protocol: ${member.protocols[0]?.value}.`,
      ["skin", "limbs"],
    );
  }

  if (/sleep|rest|stress|fatigue|tired/.test(prompt)) {
    const head = zoneByName(member, "head");
    return build(
      `Recovery profile — ${head.name}: ${vitalsLine(head)}. Sleep window on file: ${member.protocols.find((p) => /sleep/i.test(p.label))?.value ?? "not scheduled"}.`,
      ["head"],
    );
  }

  if (/countermeasure|risk|mitigation|prevent/.test(prompt)) {
    const top = member.risks.slice(0, 2);
    const msg = top
      .map((r) => `${r.name}: ${r.cause} → Mitigation: ${r.mitigation}`)
      .join(" ");
    return build(msg, top.map((r) => r.zoneId), false);
  }

  const zones = detectZones(prompt);
  if (zones.length) {
    const z = zoneByName(member, zones[0]);
    return build(
      `${z.name} is ${z.status}. ${z.description} Current readings — ${vitalsLine(z)}.`,
      [z.id],
    );
  }

  const flagged = worstZones(member).filter((z) => z.status !== "NOMINAL");
  return build(
    `I can walk you through ${member.callsign}'s monitored zones${flagged.length ? ` — currently watching ${flagged.map((z) => z.name).join(", ")}` : " — all nominal"}. Ask about a body region, EVA prep, sleep, or countermeasures.`,
    flagged.slice(0, 2).map((z) => z.id),
  );
}

/* ------------------------------- provider ------------------------------ */

export class MockHealthDataProvider implements HealthDataProvider {
  readonly kind = "mock" as const;

  async checkHealth(): Promise<HealthResponse> {
    await latency();
    return {
      status: "ok",
      service: "mock-provider",
      environment: "simulation",
      triage_mode: "simulated",
      version: "0.1.0",
    };
  }

  async getCrew(): Promise<CrewMember[]> {
    await latency();
    return CREW;
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    await latency();
    return getCrewMember(id);
  }

  async getLocations(): Promise<LocationProfile[]> {
    await latency();
    return LOCATION_PROFILES;
  }

  async getLocationProfile(id: LocationId): Promise<LocationProfile> {
    await latency();
    return getLocationProfile(id ?? DEFAULT_LOCATION);
  }

  async getTelemetrySeries(
    crewId: string,
    metric: TelemetryMetric,
  ): Promise<TelemetrySeries> {
    await latency();
    return buildTelemetrySeries(crewId, metric);
  }

  async submitTelemetry(
    _crewId: string,
    vitals: VitalSigns,
  ): Promise<TriageAssessment> {
    await latency();
    return evaluateLocally(vitals);
  }

  async submitLog(_crewId: string, log: BehaviorLog): Promise<LogAck> {
    await latency();
    return {
      id: `log-${Date.now().toString(36)}`,
      receivedAt: new Date().toISOString(),
      kind: log.kind,
    };
  }

  async ask(
    crewId: string,
    req: AssistantRequest,
    signal?: AbortSignal,
  ): Promise<AssistantResponse> {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, 320 + Math.random() * 480);
      signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      });
    });
    const member = getCrewMember(crewId) ?? CREW[0];
    return respond(member, req);
  }

  async getGamification(crewId: string): Promise<GamificationState> {
    await latency();
    const streak = crewId === "AST-01" ? 6 : crewId === "AST-03" ? 3 : 1;
    return {
      streakDays: streak,
      checklist: DAILY_CHECKLIST.map((c, i) => ({ ...c, done: i === 0 })),
      ownedSkinIds: ["skin-nominal"],
    };
  }

  async pullGachapon(crewId: string): Promise<SkinDef> {
    await sleep(1400); // pull animation window
    const idx =
      (crewId.charCodeAt(crewId.length - 1) + Date.now() / 86_400_000) %
      COMPANION_SKINS.length | 0;
    return COMPANION_SKINS[idx];
  }
}
