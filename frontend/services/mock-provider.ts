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
import { crewFromOperators, crewMemberFromOperator } from "@/data/crew";
import { userStore } from "@/stores/user-store";
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
  CheckupCompleteRequest,
  CheckupCompleteResponse,
  CompanionSkinBackend,
  CrewMember,
  DatabaseSnapshotRestoreResponse,
  GamificationState,
  HealthResponse,
  KnowledgeDocument,
  KnowledgeSearchResponse,
  LocationContextUpdate,
  LocationId,
  LocationProfile,
  LocalUser,
  LogAck,
  SkinDef,
  TelemedicineFlushRequest,
  TelemedicineFlushResponse,
  TelemedicineSyncQueueResponse,
  TelemetryIngestRequest,
  TelemetryIngestResponse,
  TelemetryMetric,
  TelemetrySeries,
  TempusProPacket,
  TriageAssessment,
  TriageLevel,
  TTSRequest,
  TTSResponse,
  VisemeCue,
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

const BACKEND_TO_FRONT_LOCATION: Record<string, LocationId> = {
  "Space Station [0g]": "station",
  "Spacecraft [0g Transit]": "spacecraft",
  "Moon [1/6g]": "moon",
  "Mars [3/8g]": "mars",
  "Rover / EVA": "eva",
};

const MOCK_RAG_DOCS: KnowledgeDocument[] = [
  {
    id: 1,
    chunk_key: "sans_optic_edema_v1",
    title: "SANS Optic Disc Edema & ICP Countermeasures",
    category: "SANS / Neuro-Ocular",
    content_high_level:
      "Fluid shifts in 0g can elevate intracranial pressure and flatten the back of the eye. Use visual self-checks and keep cabin CO2 low.",
    content_technical:
      "Spaceflight-Associated Neuro-ocular Syndrome (SANS): venous congestion + elevated ppCO2 (>3.5 mmHg) increases choroidal folding and logMAR drift. Perform fundoscopy/OCT + Chibis LBNP.",
    source_reference: "NASA-HRP-SANS-2025",
    score: 0.94,
    similarity_score: 0.94,
  },
  {
    id: 2,
    chunk_key: "eva_decompression_bends_v1",
    title: "EVA Decompression Sickness (Bends) & Suit Pressure Loss",
    category: "EVA / Hypoxia",
    content_high_level:
      "Low suit pressure can trigger hypoxia and nitrogen bubbles. Terminate EVA, begin 100% oxygen pre-breathe, and repressurize immediately.",
    content_technical:
      "Hypobaric ebullism / Type I-II DCS protocol: suit_pressure < 29.6 kPa or SpO2 < 90% mandates immediate emergency airlock ingress, 100% O2 hyperbaric therapy, and Flight Surgeon telemetry flag.",
    source_reference: "NASA-STD-3001-EVA",
    score: 0.92,
    similarity_score: 0.92,
  },
  {
    id: 3,
    chunk_key: "radiation_spe_shielding_v1",
    title: "Solar Particle Event (SPE) Dosimetry & Integumentary Care",
    category: "Radiation",
    content_high_level:
      "Seek water-wall storm shelter when cumulative radiation exceeds 20 mSv and monitor skin erythema or rash.",
    content_technical:
      "ALARA dosimetry escalation (>20 mSv acute): relocate to polyethylene-shielded core, log integumentary lesions via high-res optical scan, and evaluate lymphocyte count trend.",
    source_reference: "NASA-ALARA-SPE-04",
    score: 0.89,
    similarity_score: 0.89,
  },
  {
    id: 4,
    chunk_key: "bone_ared_insulin_v1",
    title: "Microgravity Osteopenia & Metabolic Insulin Resistance",
    category: "Musculoskeletal / Metabolic",
    content_high_level:
      "Floating reduces bone loading and alters sugar regulation. Prioritize daily ARED resistive exercise and balanced low-glycemic nutrition.",
    content_technical:
      "BMD T-score <= -1.0 combined with fasting glucose > 110 mg/dL indicates mechanical unloading insulin resistance. Increase ARED squat/deadlift volume and vitamin D3 supplementation.",
    source_reference: "NASA-HRP-BONE-08",
    score: 0.87,
    similarity_score: 0.87,
  },
];

function createSilentWavBase64(durationMs: number): string {
  const sampleRate = 8000;
  const numSamples = Math.max(
    800,
    Math.floor((sampleRate * Math.min(durationMs, 3000)) / 1000),
  );
  const dataSize = numSamples * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) bytes[off + i] = str.charCodeAt(i);
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function buildMockVisemes(text: string): {
  durationMs: number;
  cues: VisemeCue[];
} {
  const clean = text.trim() || "Nominal";
  const words = clean.split(/\s+/).slice(0, 18);
  const visemes: Array<VisemeCue["viseme"]> = ["A", "E", "O", "U", "M", "I"];
  const cues: VisemeCue[] = [];
  let t = 0;
  for (let i = 0; i < words.length; i++) {
    const dur = Math.min(260, Math.max(90, words[i].length * 26));
    cues.push({
      start_ms: t,
      end_ms: t + dur,
      viseme: visemes[(i + words[i].length) % visemes.length],
    });
    t += dur + 45;
  }
  cues.push({ start_ms: t, end_ms: t + 120, viseme: "rest" });
  return { durationMs: t + 120, cues };
}

export class MockHealthDataProvider implements HealthDataProvider {
  readonly kind = "mock" as const;

  private activeLocationId: LocationId = DEFAULT_LOCATION;
  private locationOverrides = new Map<LocationId, LocationProfile>();
  private completedTasks: string[] = [DAILY_CHECKLIST[0].id];
  private unlockedSkins = new Set<string>(["skin_standard_suit"]);
  private equippedSkinId = "skin_standard_suit";
  private streakDays = 6;
  private totalCheckups = 6;
  private tokens = 2;
  private queuePackets: TempusProPacket[] = [
    {
      packet_id: 101,
      astronaut_id: "AST-01",
      timestamp: new Date(Date.now() - 3600_000).toISOString(),
      location_setting: "Space Station [0g]",
      triage_tier: "CAUTION",
      status: "caution",
      priority: "HIGH",
      transmission_status: "pending",
      transmitted_at: null,
      earth_comm_latency_sec: 0.6,
      anomaly_flags: ["SANS Screening Flag (logMAR 0.28)"],
      recommended_actions: ["Perform ocular OCT self-exam", "Monitor ppCO2"],
      standard_measures_telemetry: { heart_rate_bpm: 76, spo2_percent: 98.1 },
      trend_forecasts_summary: { visual_acuity_logmar: 0.29 },
    },
  ];

  async checkHealth(): Promise<HealthResponse> {
    await latency();
    return {
      status: "ok",
      service: "mock-provider",
      environment: "simulation",
      triage_mode: "simulated",
      version: "0.4.0-mock",
    };
  }

  async getCrew(): Promise<CrewMember[]> {
    await latency();
    return crewFromOperators(userStore().users);
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    await latency();
    const user = userStore().users.find((u) => u.astronautId === id);
    return user ? crewMemberFromOperator(user) : undefined;
  }

  async getLocations(): Promise<LocationProfile[]> {
    await latency();
    return LOCATION_PROFILES.map(
      (loc) => this.locationOverrides.get(loc.id) ?? loc,
    );
  }

  async getActiveLocation(): Promise<LocationProfile> {
    await latency();
    return (
      this.locationOverrides.get(this.activeLocationId) ??
      getLocationProfile(this.activeLocationId)
    );
  }

  async getLocationProfile(id: LocationId): Promise<LocationProfile> {
    await latency();
    return (
      this.locationOverrides.get(id) ?? getLocationProfile(id ?? DEFAULT_LOCATION)
    );
  }

  async updateLocationProfile(
    id: LocationId,
    updates?: Partial<LocationContextUpdate>,
  ): Promise<LocationProfile> {
    await latency();
    const mappedId = updates?.location_setting
      ? BACKEND_TO_FRONT_LOCATION[updates.location_setting] ?? id
      : id;
    this.activeLocationId = mappedId;
    const base =
      this.locationOverrides.get(mappedId) ?? getLocationProfile(mappedId);
    const merged: LocationProfile = {
      ...base,
      commLatencySec: updates?.earth_comm_latency_sec ?? base.commLatencySec,
      offlineFallbackActive:
        updates?.offline_fallback_active ?? base.offlineFallbackActive,
      linkMode: updates?.offline_fallback_active ? "local" : base.linkMode,
      eclss: {
        temperature_c: updates?.temperature_c ?? base.eclss?.temperature_c ?? 21.5,
        pressure_kpa: updates?.pressure_kpa ?? base.eclss?.pressure_kpa ?? 101.3,
        lighting_lux: updates?.lighting_lux ?? base.eclss?.lighting_lux ?? 420,
        noise_dba: updates?.noise_dba ?? base.eclss?.noise_dba ?? 58,
        microbial_cfu_m3:
          updates?.microbial_cfu_m3 ?? base.eclss?.microbial_cfu_m3 ?? 45,
        co2_mmhg: updates?.co2_mmhg ?? base.eclss?.co2_mmhg ?? 2.3,
      },
      updatedAt: new Date().toISOString(),
    };
    this.locationOverrides.set(mappedId, merged);
    return merged;
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

  async ingestTelemetry(
    payload: TelemetryIngestRequest,
    imageFile?: File | null,
  ): Promise<TelemetryIngestResponse> {
    await latency();
    const assessment = evaluateLocally({
      astronaut_id: payload.astronaut_id,
      heart_rate_bpm: payload.heart_rate_bpm,
      spo2_percent: payload.spo2_percent ?? 98,
      core_temp_c: payload.core_temp_c ?? 37,
      systolic_bp_mmhg: payload.systolic_bp_mmhg,
      suit_pressure_kpa: payload.suit_pressure_kpa,
      radiation_msv_hr: payload.radiation_dose_msv
        ? payload.radiation_dose_msv / 24
        : null,
      symptoms: payload.symptoms,
    });
    const status =
      assessment.triage_level === "CRITICAL" ||
      assessment.triage_level === "URGENT"
        ? "critical"
        : assessment.triage_level === "CAUTION"
          ? "caution"
          : "nominal";

    if (status !== "nominal") {
      this.queuePackets.unshift({
        packet_id: 200 + this.queuePackets.length,
        astronaut_id: payload.astronaut_id,
        timestamp: new Date().toISOString(),
        location_setting: getLocationProfile(this.activeLocationId).label,
        triage_tier: assessment.triage_level,
        status,
        priority: status === "critical" ? "CRITICAL" : "HIGH",
        transmission_status: "pending",
        transmitted_at: null,
        earth_comm_latency_sec: getLocationProfile(this.activeLocationId)
          .commLatencySec,
        anomaly_flags: assessment.anomaly_flags,
        recommended_actions: assessment.recommended_actions,
        standard_measures_telemetry: {
          heart_rate_bpm: payload.heart_rate_bpm,
          spo2_percent: payload.spo2_percent ?? 98,
        },
        trend_forecasts_summary: {},
      });
    }

    return {
      id: Date.now(),
      astronaut_id: payload.astronaut_id,
      timestamp: new Date().toISOString(),
      status,
      triage_tier: assessment.triage_level,
      mission_readiness_score:
        status === "critical" ? 54 : status === "caution" ? 78 : 94,
      anomaly_flags: assessment.anomaly_flags,
      recommended_actions: assessment.recommended_actions,
      high_level: assessment.summary,
      technical: `[MOCK INGEST] ${assessment.triage_level}: ${assessment.anomaly_flags.join("; ") || "All parameters nominal."}`,
      target_anatomical_zone: payload.target_anatomical_zone ?? null,
      image_stored: Boolean(imageFile),
      image_path: imageFile ? `mock://uploads/${imageFile.name}` : null,
      image_metadata: imageFile
        ? {
            filename: imageFile.name,
            content_type: imageFile.type || "image/png",
            size_bytes: imageFile.size,
            width: 1,
            height: 1,
            format: "PNG",
            aspect_ratio: 1,
          }
        : null,
    };
  }

  async submitLog(_crewId: string, log: BehaviorLog): Promise<LogAck> {
    await latency();
    return {
      id: `log-${Date.now().toString(36)}`,
      receivedAt: new Date().toISOString(),
      kind: log.kind,
    };
  }

  async searchKnowledge(
    query: string,
    opts?: { category?: string; topK?: number },
  ): Promise<KnowledgeSearchResponse> {
    await latency();
    const q = query.toLowerCase();
    let docs = MOCK_RAG_DOCS.filter((d) =>
      opts?.category
        ? d.category.toLowerCase().includes(opts.category.toLowerCase())
        : true,
    );
    docs = docs.sort((a, b) => {
      const am =
        (a.title + a.content_technical + a.category).toLowerCase().includes(q)
          ? 1
          : 0;
      const bm =
        (b.title + b.content_technical + b.category).toLowerCase().includes(q)
          ? 1
          : 0;
      return bm - am;
    });
    const sliced = docs.slice(0, opts?.topK ?? 3);
    return {
      status: "nominal",
      high_level: `Found ${sliced.length} space-medicine protocol match(es) locally.`,
      technical: `Offline BM25/keyword fallback across ${MOCK_RAG_DOCS.length} local HRP chunks.`,
      total_chunks: MOCK_RAG_DOCS.length,
      embedding_provider: "local-mock-rag",
      results: sliced,
    };
  }

  async ask(
    crewId: string,
    req: AssistantRequest,
    signal?: AbortSignal,
  ): Promise<AssistantResponse> {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, 260 + Math.random() * 280);
      signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      });
    });
    const users = userStore().users;
    const member: LocalUser = users.find((u) => u.astronautId === crewId) ??
      users[0] ?? {
        id: "usr_unassigned",
        name: "Unassigned Operator",
        role: "user",
        facePhoto: "",
        astronautId: crewId || "AST-U00",
        createdAt: "",
      };
    const base = respond(crewMemberFromOperator(member), req);
    return {
      ...base,
      highLevel: base.message,
      technical: `[OFFLINE MOCK ENGINE · ${req.viewMode ?? "high_level"}] ${base.message}`,
      status: "nominal",
      providerUsed: req.forceOffline
        ? "offline-rag-clinical-synth"
        : "mock-clinical-router",
      offlineMode: req.forceOffline ?? base.mode === "local",
      triageTier: "NOMINAL",
    };
  }

  async synthesizeSpeech(
    req: TTSRequest,
  ): Promise<TTSResponse> {
    await latency();
    const { durationMs, cues } = buildMockVisemes(req.text);
    const offline = req.force_offline ?? true;
    return {
      status: req.severity ?? "nominal",
      high_level: "Local speech waveform and phoneme visemes ready.",
      technical: `Mock WAV synthesis (${durationMs}ms, ${cues.length} viseme cues, offline=${offline}).`,
      provider_used: offline ? "local-riff-wav-synth" : "elevenlabs-mock",
      offline_mode: offline,
      mime_type: "audio/wav",
      audio_base64: createSilentWavBase64(durationMs),
      duration_ms: durationMs,
      viseme_cues: cues,
      browser_speech_hint: {
        text: req.text,
        lang: "en-US",
        rate: req.severity === "critical" ? 1.08 : 0.96,
        pitch: req.severity === "critical" ? 1.05 : 1.0,
      },
    };
  }

  async getGamification(crewId: string): Promise<GamificationState> {
    await latency();
    const streak = crewId === "AST-01" ? this.streakDays : 3;
    const catalog: SkinDef[] = COMPANION_SKINS.map((s) => ({
      ...s,
      unlocked: this.unlockedSkins.has(s.id),
      equipped: s.id === this.equippedSkinId,
    }));
    const checklist = DAILY_CHECKLIST.map((c) => ({
      ...c,
      done: this.completedTasks.includes(c.id),
    }));
    const completedCount = checklist.filter((c) => c.done).length;
    return {
      streakDays: streak,
      totalCheckupsCompleted: this.totalCheckups,
      gachaponTokens: this.tokens,
      complianceRatePercent: Math.round((completedCount / checklist.length) * 100),
      checklist,
      ownedSkinIds: Array.from(this.unlockedSkins),
      equippedSkinId: this.equippedSkinId,
      catalog,
      status: "nominal",
      highLevel: `${completedCount}/${checklist.length} routine checks complete.`,
      technical: `Streak=${streak}d, tokens=${this.tokens}, unlocked=${this.unlockedSkins.size}/${COMPANION_SKINS.length}.`,
    };
  }

  async completeCheckup(
    req: CheckupCompleteRequest,
  ): Promise<CheckupCompleteResponse> {
    await latency();
    this.completedTasks = Array.from(new Set(req.completed_tasks));
    this.totalCheckups += 1;
    const tokensAwarded = req.completed_tasks.length > 0 ? 1 : 0;
    this.tokens += tokensAwarded;

    let rolledBackend: CompanionSkinBackend | null = null;
    let isNew = false;
    if (req.perform_gachapon_roll) {
      const idx =
        (req.deterministic_seed ?? Date.now()) % COMPANION_SKINS.length;
      const chosen = COMPANION_SKINS[idx];
      isNew = !this.unlockedSkins.has(chosen.id);
      this.unlockedSkins.add(chosen.id);
      if (this.tokens > 0) this.tokens -= 1;
      rolledBackend = {
        skin_id: chosen.id,
        name: chosen.name,
        rarity: chosen.rarity.toUpperCase() as CompanionSkinBackend["rarity"],
        description: chosen.description,
        unlocked: true,
        equipped: chosen.id === this.equippedSkinId,
        probability_percent: chosen.probabilityPercent ?? 8,
      };
    }

    if (req.equip_skin_id && this.unlockedSkins.has(req.equip_skin_id)) {
      this.equippedSkinId = req.equip_skin_id;
    }

    const eq =
      COMPANION_SKINS.find((s) => s.id === this.equippedSkinId) ??
      COMPANION_SKINS[0];
    const eqBackend: CompanionSkinBackend = {
      skin_id: eq.id,
      name: eq.name,
      rarity: eq.rarity.toUpperCase() as CompanionSkinBackend["rarity"],
      description: eq.description,
      unlocked: true,
      equipped: true,
      probability_percent: eq.probabilityPercent ?? 20,
    };

    return {
      status: "nominal",
      high_level: rolledBackend
        ? `Checkup saved! Unlocked ${rolledBackend.name}.`
        : "Checkup progress saved.",
      technical: `Mock checkup-complete: streak=${this.streakDays}, tokens=${this.tokens}.`,
      astronaut_id: req.astronaut_id,
      readiness_streak_days: this.streakDays,
      total_checkups_completed: this.totalCheckups,
      gachapon_tokens: this.tokens,
      tokens_awarded: tokensAwarded,
      roll_performed: Boolean(req.perform_gachapon_roll),
      roll_result: rolledBackend
        ? {
            rolled_skin: rolledBackend,
            is_new_unlock: isNew,
            rarity: rolledBackend.rarity,
            probability_percent: rolledBackend.probability_percent,
            message: isNew
              ? "New suit skin unlocked!"
              : "Duplicate suit skin rolled.",
          }
        : null,
      equipped_skin: eqBackend,
      completed_tasks_today: this.completedTasks,
      compliance_rate_percent: Math.round(
        (this.completedTasks.length / DAILY_CHECKLIST.length) * 100,
      ),
    };
  }

  async pullGachapon(crewId: string): Promise<SkinDef> {
    await sleep(600);
    const idx =
      (crewId.charCodeAt(crewId.length - 1) + Date.now() / 86_400_000) %
      COMPANION_SKINS.length | 0;
    const chosen = COMPANION_SKINS[idx];
    this.unlockedSkins.add(chosen.id);
    return {
      ...chosen,
      unlocked: true,
      equipped: chosen.id === this.equippedSkinId,
    };
  }

  async getTelemedicineQueue(): Promise<TelemedicineSyncQueueResponse> {
    await latency();
    const pending = this.queuePackets.filter(
      (p) => p.transmission_status === "pending",
    ).length;
    const loc = await this.getActiveLocation();
    return {
      status: pending > 0 ? "caution" : "nominal",
      high_level: `${pending} packet(s) awaiting Earth ground relay.`,
      technical: `Tempus Pro store-and-forward queue: pending=${pending}, transmitted=${this.queuePackets.length - pending}.`,
      location_setting: loc.label,
      earth_comm_latency_sec: loc.commLatencySec,
      offline_fallback_active: Boolean(loc.offlineFallbackActive),
      comm_window_open: !loc.offlineFallbackActive,
      pending_count: pending,
      transmitted_count: this.queuePackets.length - pending,
      packets: [...this.queuePackets],
    };
  }

  async flushTelemedicineQueue(
    req?: TelemedicineFlushRequest,
  ): Promise<TelemedicineFlushResponse> {
    await latency();
    const now = new Date().toISOString();
    const flushed: TempusProPacket[] = [];
    this.queuePackets = this.queuePackets.map((p) => {
      if (
        p.transmission_status === "pending" &&
        (!req?.astronaut_id || p.astronaut_id === req.astronaut_id)
      ) {
        const updated: TempusProPacket = {
          ...p,
          transmission_status: "transmitted",
          transmitted_at: now,
        };
        flushed.push(updated);
        return updated;
      }
      return p;
    });
    const remaining = this.queuePackets.filter(
      (p) => p.transmission_status === "pending",
    ).length;
    return {
      status: "nominal",
      high_level: `Flushed ${flushed.length} Tempus Pro packet(s) to Mission Control.`,
      technical: `Ground station=${req?.ground_station ?? "MCC-Houston-DSN"}, remaining_pending=${remaining}.`,
      flushed_count: flushed.length,
      remaining_pending_count: remaining,
      ground_station: req?.ground_station ?? "MCC-Houston-DSN",
      transmitted_at: now,
      flushed_packets: flushed,
    };
  }

  async restoreDatabaseSnapshot(): Promise<DatabaseSnapshotRestoreResponse> {
    await latency();
    this.activeLocationId = DEFAULT_LOCATION;
    this.locationOverrides.clear();
    this.completedTasks = [DAILY_CHECKLIST[0].id];
    this.unlockedSkins = new Set(["skin_standard_suit"]);
    this.equippedSkinId = "skin_standard_suit";
    return {
      status: "nominal",
      high_level: "Mock mission snapshot restored to baseline values.",
      technical:
        "Offline state reset: AST-01, Space Station [0g], baseline queue.",
      restored: true,
      restored_at: new Date().toISOString(),
      default_astronaut_id: "AST-01",
      default_location_setting: "Space Station [0g]",
      seeded_counts: {
        telemetry_logs: 20,
        rag_chunks: MOCK_RAG_DOCS.length,
        gamification_profiles: 1,
      },
    };
  }
}
