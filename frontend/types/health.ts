/**
 * Domain contracts for the health-monitoring console.
 *
 * `VitalSigns` / `TriageAssessment` mirror backend/app/triage/models.py.
 * Everything else is a UI-side contract owned by `HealthDataProvider`
 * (services/health-provider.ts) — the mock provider ships curated data
 * today; the REST provider maps the real backend endpoints.
 */

export type Vec3 = [number, number, number];

/* ---------- Backend mirrors (doc/back/triage/rules-and-models.md) ---------- */

export type TriageLevel = "NOMINAL" | "CAUTION" | "URGENT" | "CRITICAL";

export const TRIAGE_LEVELS: TriageLevel[] = [
  "NOMINAL",
  "CAUTION",
  "URGENT",
  "CRITICAL",
];

export interface VitalSigns {
  astronaut_id: string;
  timestamp?: string;
  heart_rate_bpm: number;
  spo2_percent: number;
  core_temp_c: number;
  systolic_bp_mmhg?: number;
  suit_pressure_kpa?: number | null;
  radiation_msv_hr?: number | null;
  symptoms?: string[];
}

export interface TriageAssessment {
  astronaut_id: string;
  triage_level: TriageLevel;
  anomaly_flags: string[];
  recommended_actions: string[];
  summary: string;
  ai_advisory: string | null;
  evaluated_at: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  environment: string;
  triage_mode: string;
  version: string;
}

/* ---------- Global UI state ---------- */

export type ViewMode = "high_level" | "technical";

export type LocationId =
  | "station"
  | "spacecraft"
  | "moon"
  | "mars"
  | "eva";

/* ---------- Body / anatomical zones ---------- */

export type ZoneId =
  | "head"
  | "chest"
  | "spine"
  | "limbs"
  | "gut"
  | "skin";

export interface VitalReading {
  key: string;
  label: string;
  value: number;
  unit: string;
  status: TriageLevel;
  updatedAt: string;
}

/** Y-offset applied to the astronaut model group in world space.
 * `BodyZone.position` is model-local; world anchor = position + offset. */
export const MODEL_GROUP_OFFSET: Vec3 = [0, -0.92, 0];

/** A selectable anatomical zone — links data to 3D `partId`s (ex-Hotspot). */
export interface BodyZone {
  id: ZoneId;
  name: string;
  /** 3D part ids that make up this zone in the astronaut model. */
  partIds: string[];
  /** Anchor point (model-local) for camera focus & tooltip. */
  position: Vec3;
  description: string;
  vitals: VitalReading[];
  status: TriageLevel;
}

export interface RiskFactor {
  name: string;
  cause: string;
  mitigation: string;
  zoneId: ZoneId;
}

/* ---------- Anatomical drill-down (model layer, shared across crew) ---------- */

/** Procedural builder ids — see components/three/organ-geometry.ts. */
export type OrganShape =
  | "brain"
  | "eye"
  | "heart"
  | "lung"
  | "trachea"
  | "esophagus"
  | "diaphragm"
  | "spine_cervical"
  | "spine_thoracic"
  | "spine_lumbar"
  | "pelvis"
  | "biceps"
  | "femur"
  | "liver"
  | "gallbladder"
  | "stomach"
  | "spleen"
  | "pancreas"
  | "kidney"
  | "small_intestine"
  | "colon"
  | "bladder"
  | "skin_section";

/** Idle motion driven by the organ's own vitals (respects reduced motion). */
export type OrganAnim = "heartbeat" | "breath" | "peristalsis";

/** A drill-down anatomical structure rendered inside a BodyZone.
 * Anatomy is static (data/organs.ts) — status is inherited from the
 * parent zone of the crew member being viewed. */
export interface Organ {
  id: string;
  name: string;
  zoneId: ZoneId;
  /** Anchor (model-local) — world anchor = position + MODEL_GROUP_OFFSET. */
  position: Vec3;
  rotation?: Vec3;
  /** Procedural mesh builder (one merged BufferGeometry per organ). */
  shape: OrganShape;
  /** Anatomical side for paired organs: +1 patient-left (+x), -1 right. */
  side?: 1 | -1;
  /** Camera distance when this organ is focused (default 0.6). */
  focusDistance?: number;
  anim?: OrganAnim;
  description: string;
  vitals: VitalReading[];
}

export interface BioEntry {
  label: string;
  value: string;
  unit?: string;
}

export interface AIInsight {
  category:
    | "Cardio"
    | "Neuro"
    | "Musculoskeletal"
    | "Radiation"
    | "Environment"
    | "Nutrition"
    | "Mission";
  title: string;
  description: string;
  zoneId?: ZoneId;
}

export interface ReadinessScore {
  /** 0–100 composite mission-readiness value (provider-computed). */
  score: number;
  label: string;
}

export interface CrewMember {
  id: string;
  name: string;
  callsign: string;
  role: string;
  mission: string;
  subtitle: string;
  modelKind: "suit";
  description: string;
  biometrics: BioEntry[];
  zones: BodyZone[];
  risks: RiskFactor[];
  protocols: BioEntry[];
  checks: BioEntry[];
  insights: AIInsight[];
  readiness: ReadinessScore;
}

/* ---------- Telemetry / trends ---------- */

export type TelemetryMetric =
  | "heart_rate"
  | "spo2"
  | "core_temp"
  | "exertion"
  | "radiation"
  | "fatigue";

export interface TelemetryPoint {
  t: string;
  value: number;
}

export interface MissionEvent {
  t: string;
  label: string;
  kind: "eva" | "radiation" | "gravity" | "sleep" | "exercise";
}

export interface TelemetrySeries {
  metric: TelemetryMetric;
  label: string;
  unit: string;
  points: TelemetryPoint[];
  forecast: TelemetryPoint[];
  events: MissionEvent[];
  /** Provider-owned reference band — never clinical constants in the UI. */
  band?: { low: number; high: number; label: string };
}

/* ---------- Location context ---------- */

export interface HazardWeights {
  radiation: number;
  isolation: number;
  gravity: number;
  workload: number;
}

export interface LocationProfile {
  id: LocationId;
  label: string;
  commLatencySec: number;
  blackoutRisk: string;
  /** How the AI/TTS adapters behave under this comm profile. */
  linkMode: "local" | "advisory";
  hazards: HazardWeights;
}

/* ---------- AI companion ---------- */

export interface AssistantAction {
  type: "focus";
  zoneId: ZoneId;
}

export interface AssistantResponse {
  message: string;
  referencedZoneIds: ZoneId[];
  actions: AssistantAction[];
  insights: AIInsight[];
  assumptions: string[];
  /** Declared operating mode, driven by the active LocationProfile. */
  mode: "local" | "advisory";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  contextZoneId?: ZoneId;
  response?: AssistantResponse;
}

/* ---------- Logger / ingest ---------- */

export interface BehaviorLog {
  kind: "sleep" | "mood" | "hydration" | "exercise";
  value: string;
  note?: string;
}

export interface LogAck {
  id: string;
  receivedAt: string;
  kind: BehaviorLog["kind"];
}

/* ---------- Gamification ---------- */

export interface SkinDef {
  id: string;
  name: string;
  rarity: "common" | "rare" | "legendary";
  description: string;
  palette: { suit: string; accent: string };
}

export interface GamificationState {
  streakDays: number;
  checklist: { id: string; label: string; done: boolean }[];
  ownedSkinIds: string[];
}
