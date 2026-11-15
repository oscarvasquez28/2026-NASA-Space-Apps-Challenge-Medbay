/**
 * Demo health-progression simulator (mock provider only).
 * Keyframes live in `data/sim-progress.json` — the arc interpolates between
 * steps every `tickMs` so vitals/zone statuses visibly deteriorate and recover
 * during a demo. Never used by the REST provider — all SIMULATED data.
 */

import dataset from "@/data/sim-progress.json";
import type {
  BodyZone,
  CrewMember,
  TelemetryIngestRequest,
  TelemetryMetric,
  TelemetrySeries,
  VitalReading,
  ZoneId,
} from "@/types/health";

type ZoneStatus = BodyZone["status"];
const RANK: ZoneStatus[] = ["NOMINAL", "CAUTION", "URGENT", "CRITICAL"];
const worst = (a: ZoneStatus, b: ZoneStatus): ZoneStatus =>
  RANK.indexOf(b) > RANK.indexOf(a) ? b : a;

interface SimZone {
  status?: ZoneStatus;
  vitals?: Record<string, number>;
}
interface SimStep {
  note?: string;
  zones?: Partial<Record<ZoneId, SimZone>>;
  telemetry?: Record<string, number>;
}

const steps = dataset.steps as SimStep[];
const tickMs = dataset.tickMs || 5000;

export const SIM_TICK_MS = tickMs;
export const SIM_STEP_COUNT = steps.length;
/** Window event dispatched after each scripted ingest so telemetry hooks refetch. */
export const SIM_TICK_EVENT = "medbay:sim-tick";

let bootAt: number | null = null;

/** Continuous keyframe position: whole part = step index, fraction = lerp alpha. */
export function simPhase(now = Date.now()): number {
  bootAt ??= now;
  const span = tickMs * steps.length;
  const t = dataset.loop ? (now - bootAt) % span : Math.min(now - bootAt, span - 1);
  return Math.min(t / tickMs, steps.length - 1);
}

const stepAt = (i: number) => steps[Math.max(0, Math.min(steps.length - 1, Math.round(i)))];

/** Rule-derived status — mirrors evaluateLocally in mock-provider.ts
 *  (backend/app/triage/engine.py thresholds). Never invent new limits here. */
function vitalStatus(key: string, value: number, zoneStatus: ZoneStatus): VitalReading["status"] {
  switch (key) {
    case "spo2_percent":
      if (value < 90) return "CRITICAL";
      if (value < 94) return "URGENT";
      return "NOMINAL";
    case "heart_rate_bpm":
      if (value < 40 || value > 150) return "CRITICAL";
      if (value < 50 || value > 120) return "CAUTION";
      return "NOMINAL";
    case "suit_pressure_kpa":
      if (value < 25) return "CRITICAL";
      return "NOMINAL";
    default:
      // Non-clinical markers track their zone's simulated status.
      return zoneStatus === "NOMINAL" ? "NOMINAL" : "CAUTION";
  }
}

/**
 * Blend the sim arc over the member's zones. Values lerp between keyframes;
 * status comes from the current keyframe escalated by rule-derived vital flags.
 */
export function applySimToMember(member: CrewMember, now = Date.now()): CrewMember {
  const phase = simPhase(now);
  const i0 = Math.floor(phase);
  const alpha = phase - i0;
  const s0 = stepAt(i0);
  const s1 = stepAt(i0 + 1 <= steps.length - 1 ? i0 + 1 : i0);

  const zones = member.zones.map((zone) => {
    const z0 = s0.zones?.[zone.id];
    const z1 = s1.zones?.[zone.id];
    if (!z0 && !z1) return zone;

    const zoneStatus: ZoneStatus = alpha < 0.5 ? (z0?.status ?? zone.status) : (z1?.status ?? zone.status);
    const vitals = zone.vitals.map((v) => {
      const v0 = z0?.vitals?.[v.key];
      const v1 = z1?.vitals?.[v.key];
      if (v0 === undefined && v1 === undefined) return v;
      const value = (v0 ?? v1 ?? v.value) + ((v1 ?? v0 ?? v.value) - (v0 ?? v1 ?? v.value)) * alpha;
      const rounded = Math.round(value * 10) / 10;
      return {
        ...v,
        value: rounded,
        status: worst(zoneStatus === "NOMINAL" ? "NOMINAL" : "CAUTION", vitalStatus(v.key, rounded, zoneStatus)),
        updatedAt: new Date(now).toISOString(),
      };
    });
    const derived = vitals.reduce<ZoneStatus>((acc, v) => worst(acc, v.status), "NOMINAL");
    return { ...zone, status: worst(zoneStatus, derived), vitals };
  });

  const worstZone = zones.reduce<ZoneStatus>((acc, z) => worst(acc, z.status), "NOMINAL");
  const readiness =
    worstZone === "URGENT"
      ? { score: 62, label: "MONITOR — ELEVATED STRAIN" }
      : worstZone === "CAUTION"
        ? { score: 84, label: "MISSION READY · WATCH" }
        : member.readiness;

  return { ...member, zones, readiness };
}

/** Interpolated telemetry target for the current phase (history + forecast seed). */
export function simTelemetryTarget(metric: TelemetryMetric | string, now = Date.now()): number | undefined {
  const phase = simPhase(now);
  const i0 = Math.floor(phase);
  const alpha = phase - i0;
  const a = stepAt(i0).telemetry?.[metric];
  const b = stepAt(Math.min(steps.length - 1, i0 + 1)).telemetry?.[metric];
  if (a === undefined && b === undefined) return undefined;
  return (a ?? b ?? 0) + ((b ?? a ?? 0) - (a ?? b ?? 0)) * alpha;
}

/**
 * Bend the series' tail toward the sim target so the live endpoint and the
 * forecast visibly track the arc while earlier history stays intact.
 */
export function applySimToSeries(series: TelemetrySeries, now = Date.now()): TelemetrySeries {
  const target = simTelemetryTarget(series.metric, now);
  if (target === undefined || series.points.length === 0) return series;

  const BRIDGE = 7;
  const n = series.points.length;
  const points = series.points.map((p, i) => {
    const fromTail = Math.max(0, n - BRIDGE - 1);
    if (i < fromTail) return p;
    const t = n - 1 === fromTail ? 1 : (i - fromTail) / (n - 1 - fromTail);
    return { ...p, value: p.value + (target - p.value) * t };
  });

  const last = points[n - 1].value;
  const slope = (last - points[Math.max(0, n - BRIDGE)].value) / Math.min(BRIDGE, n - 1) || 0;
  const stepMs =
    n > 1
      ? new Date(points[n - 1].t).getTime() - new Date(points[n - 2].t).getTime()
      : 60 * 60 * 1000;
  const nowMs = new Date(points[n - 1].t).getTime();
  const forecast = series.forecast.map((p, i) => ({
    ...p,
    t: new Date(nowMs + stepMs * (i + 1)).toISOString(),
    value: Math.round((last + slope * (i + 1) * 0.4) * 10) / 10,
  }));

  return { ...series, points, forecast };
}

export { stepAt as simStepAt };

/**
 * Frontend metric name → ingestable telemetry field. Metrics with no backend
 * column (exertion/fatigue hints) are skipped — nothing is fabricated.
 */
const METRIC_TO_INGEST: Record<string, keyof TelemetryIngestRequest> = {
  heart_rate: "heart_rate_bpm",
  spo2: "spo2_percent",
  core_temp: "core_temp_c",
  blood_sugar: "blood_sugar_mg_dl",
  systolic_bp: "systolic_bp_mmhg",
  sleep: "sleep_hours",
  suit_pressure: "suit_pressure_kpa",
  cabin_co2: "co2_partial_pressure_mmhg",
};

/**
 * REST scenario player: sample the arc at `phase` (wraps when loop=true) and
 * build a real TelemetryIngestRequest — POSTing it to /telemetry/ingest writes
 * an actual row, so body-status and trend endpoints change for real.
 */
export function simIngestPayload(crewId: string, phase: number): TelemetryIngestRequest {
  const p = dataset.loop ? phase % steps.length : Math.min(phase, steps.length - 1);
  const i0 = Math.floor(p);
  const alpha = p - i0;
  const s0 = stepAt(i0).telemetry ?? {};
  const s1 = stepAt(Math.min(steps.length - 1, i0 + 1)).telemetry ?? {};

  const payload: Record<string, unknown> = { astronaut_id: crewId, heart_rate_bpm: 70 };
  for (const [metric, field] of Object.entries(METRIC_TO_INGEST)) {
    const a = s0[metric];
    const b = s1[metric];
    if (a === undefined && b === undefined) continue;
    payload[field] = Math.round(((a ?? b ?? 0) + ((b ?? a ?? 0) - (a ?? b ?? 0)) * alpha) * 10) / 10;
  }
  return payload as unknown as TelemetryIngestRequest;
}
