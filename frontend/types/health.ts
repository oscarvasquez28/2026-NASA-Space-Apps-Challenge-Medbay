/**
 * Domain contracts for the health-monitoring console.
 *
 * Mirrors backend schemas across:
 *   - triage/models.py (`VitalSigns`, `TriageAssessment`)
 *   - context/models.py (`LocationContextResponse`, `LocationContextUpdate`)
 *   - telemetry/models.py (`TelemetryIngestRequest`, `TelemetryIngestResponse`)
 *   - astronaut/models.py (`AstronautBodyStatusResponse`)
 *   - trends/models.py (`TrendAnalysisResponse`)
 *   - rag/models.py & ai/schemas.py (`KnowledgeSearchResponse`, `AIChatResponse`)
 *   - voice/models.py (`TTSRequest`, `TTSResponse`, `VisemeCue`)
 *   - gamification/models.py (`GamificationStatusResponse`, `CheckupCompleteResponse`)
 *   - telemedicine/models.py (`TelemedicineSyncQueueResponse`, `TelemedicineFlushResponse`)
 *   - api/routes/tests.py (`DatabaseSnapshotRestoreResponse`)
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

export type BackendStatus = "nominal" | "caution" | "critical";

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
  status?: BackendStatus | string;
  triage_tier?: string;
  mission_readiness_score?: number;
  anomaly_flags: string[];
  recommended_actions: string[];
  summary: string;
  high_level?: string;
  technical?: string;
  ai_advisory: string | null;
  ml_anomaly_score?: number | null;
  predicted_probabilities?: Record<string, number> | null;
  telemedicine_enqueued?: boolean;
  evaluated_at: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  environment: string;
  triage_mode: string;
  version: string;
}

/* ---------- Context & 5-Hazards (doc/back/context/environment-and-hazards.md) ---------- */

export type LocationSettingBackend =
  | "Space Station [0g]"
  | "Spacecraft [0g Transit]"
  | "Moon [1/6g]"
  | "Mars [3/8g]"
  | "Rover / EVA";

export interface HazardMultipliers {
  space_radiation: number;
  isolation_and_confinement: number;
  distance_from_earth: number;
  gravity_fields: number;
  hostile_closed_environments: number;
  composite_multiplier: number;
}

export interface LocationContextResponse {
  id?: number | null;
  location_setting: LocationSettingBackend | string;
  gravity_g: number;
  temperature_c: number;
  pressure_kpa: number;
  lighting_lux: number;
  noise_dba: number;
  microbial_cfu_m3: number;
  co2_mmhg: number;
  earth_comm_latency_sec: number;
  offline_fallback_active: boolean;
  hazard_multipliers: HazardMultipliers;
  status: BackendStatus;
  high_level: string;
  technical: string;
  updated_at: string;
}

export interface LocationContextUpdate {
  location_setting?: LocationSettingBackend | string | null;
  temperature_c?: number | null;
  pressure_kpa?: number | null;
  lighting_lux?: number | null;
  noise_dba?: number | null;
  microbial_cfu_m3?: number | null;
  co2_mmhg?: number | null;
  earth_comm_latency_sec?: number | null;
  offline_fallback_active?: boolean | null;
}

/* ---------- Multi-Modal Telemetry Ingest (doc/back/telemetry/ingestion-and-multimodal.md) ---------- */

export interface ImageMetadata {
  filename: string;
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
  format: string;
  aspect_ratio: number;
}

export interface TelemetryIngestRequest {
  astronaut_id: string;
  heart_rate_bpm: number;
  systolic_bp_mmhg?: number;
  diastolic_bp_mmhg?: number;
  blood_sugar_mg_dl?: number;
  core_temp_c?: number;
  spo2_percent?: number;
  sleep_hours?: number;
  mood_score?: number;
  stress_level?: number;
  suit_pressure_kpa?: number | null;
  co2_partial_pressure_mmhg?: number | null;
  radiation_dose_msv?: number | null;
  visual_acuity_logmar?: number | null;
  bone_mineral_density_t_score?: number | null;
  symptoms?: string[];
  target_anatomical_zone?: string | null;
}

export interface TelemetryIngestResponse {
  id: number;
  astronaut_id: string;
  timestamp: string;
  status: BackendStatus;
  triage_tier: string;
  mission_readiness_score: number;
  anomaly_flags: string[];
  recommended_actions: string[];
  high_level: string;
  technical: string;
  target_anatomical_zone?: string | null;
  image_stored: boolean;
  image_path?: string | null;
  image_metadata?: ImageMetadata | null;
}

/* ---------- 6-Zone Anatomical Body Status (doc/back/astronaut/anatomical-status.md) ---------- */

export interface AnatomicalZoneStatusBackend {
  zone: string;
  label: string;
  status: BackendStatus;
  ui_token: "status-nominal" | "status-caution" | "status-critical";
  active_risks: string[];
  linked_vitals: Record<string, unknown>;
  self_exam_steps: string[];
  recommended_countermeasures: string[];
  high_level: string;
  technical: string;
}

export interface AstronautBodyStatusResponse {
  astronaut_id: string;
  timestamp: string;
  location_setting: string;
  status: BackendStatus;
  overall_status: BackendStatus;
  overall_ui_token: "status-nominal" | "status-caution" | "status-critical";
  mission_readiness_score: number;
  high_level: string;
  technical: string;
  zones: Record<string, AnatomicalZoneStatusBackend>;
}

/* ---------- Trends (doc/back/trends/forecasting-and-timeseries.md) ---------- */

export type BackendTrendIndicator =
  | "heart_rate_bpm"
  | "spo2_percent"
  | "core_temp_c"
  | "radiation_dose_msv"
  | "blood_sugar_mg_dl"
  | "bone_mineral_density_t_score"
  | "visual_acuity_logmar"
  | "mission_readiness_score";

export interface TrendPointBackend {
  timestamp: string;
  value: number;
}

export interface MissionEventMarkerBackend {
  timestamp: string;
  event_name: string;
  impact: string;
  description?: string | null;
}

export interface ForecastPointBackend {
  timestamp: string;
  predicted_value: number;
  lower_ci: number;
  upper_ci: number;
}

export interface TrendAnalysisResponse {
  indicator: string;
  astronaut_id: string;
  unit: string;
  historical_points: TrendPointBackend[];
  event_markers: MissionEventMarkerBackend[];
  forecast_points: ForecastPointBackend[];
  threshold_warning: boolean;
  warning_details?: string | null;
  status: BackendStatus;
  high_level: string;
  technical: string;
}

/* ---------- RAG & AI Chat & Voice TTS ---------- */

export interface KnowledgeDocument {
  id?: number | null;
  chunk_key: string;
  title: string;
  category: string;
  content_high_level: string;
  content_technical: string;
  source_reference: string;
  score: number;
  similarity_score: number;
}

export interface KnowledgeSearchResponse {
  status: BackendStatus;
  high_level: string;
  technical: string;
  total_chunks: number;
  embedding_provider: string;
  results: KnowledgeDocument[];
}

export interface VisemeCue {
  start_ms: number;
  end_ms: number;
  viseme: "A" | "E" | "I" | "O" | "U" | "M" | "rest" | string;
}

export interface TTSRequest {
  text: string;
  astronaut_id?: string | null;
  voice_id?: string | null;
  severity?: BackendStatus;
  force_offline?: boolean;
  view_mode?: ViewMode;
}

export interface TTSResponse {
  status: BackendStatus;
  high_level: string;
  technical: string;
  provider_used: "elevenlabs" | "local-riff-wav-synth" | string;
  offline_mode: boolean;
  mime_type: "audio/wav" | "audio/mpeg" | string;
  audio_base64: string;
  duration_ms: number;
  viseme_cues: VisemeCue[];
  browser_speech_hint: {
    text?: string;
    lang?: string;
    rate?: number;
    pitch?: number;
    [key: string]: unknown;
  };
}

export interface AIChatRequest {
  astronaut_id: string;
  message: string;
  view_mode: ViewMode;
  include_voice?: boolean;
  force_offline?: boolean;
  diagnostic_image_base64?: string | null;
}

export interface AIChatResponse {
  status: BackendStatus;
  high_level: string;
  technical: string;
  astronaut_id: string;
  reply: string;
  view_mode: ViewMode;
  provider_used:
    | "google-genai:gemini"
    | "ollama:medgemma"
    | "offline-rag-clinical-synth"
    | string;
  failover_reason?: string | null;
  offline_mode: boolean;
  earth_comm_latency_sec: number;
  triage_tier: string;
  retrieved_knowledge: KnowledgeDocument[];
  recommended_actions: string[];
  voice_payload?: TTSResponse | null;
}

/* ---------- Gamification (doc/back/gamification/engine.md) ---------- */

export interface CompanionSkinBackend {
  skin_id: string;
  name: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  description: string;
  unlocked: boolean;
  equipped: boolean;
  probability_percent: number;
}

export interface RoutineTaskBackend {
  task_id: string;
  title: string;
  frequency: string;
  category: string;
  completed: boolean;
  description?: string | null;
}

export interface GachaponRollResultBackend {
  rolled_skin: CompanionSkinBackend;
  is_new_unlock: boolean;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  probability_percent: number;
  message: string;
}

export interface GamificationStatusResponse {
  status: BackendStatus;
  high_level: string;
  technical: string;
  astronaut_id: string;
  readiness_streak_days: number;
  total_checkups_completed: number;
  gachapon_tokens: number;
  compliance_rate_percent: number;
  equipped_skin: CompanionSkinBackend;
  routine_tasks: RoutineTaskBackend[];
  unlocked_skins_count: number;
  total_skins_count: number;
  catalog: CompanionSkinBackend[];
}

export interface CheckupCompleteRequest {
  astronaut_id: string;
  completed_tasks: string[];
  perform_gachapon_roll?: boolean;
  equip_skin_id?: string | null;
  unlock_skin_id?: string | null;
  deterministic_seed?: number | null;
}

export interface CheckupCompleteResponse {
  status: BackendStatus;
  high_level: string;
  technical: string;
  astronaut_id: string;
  readiness_streak_days: number;
  total_checkups_completed: number;
  gachapon_tokens: number;
  tokens_awarded: number;
  roll_performed: boolean;
  roll_result?: GachaponRollResultBackend | null;
  equipped_skin: CompanionSkinBackend;
  completed_tasks_today: string[];
  compliance_rate_percent: number;
}

/* ---------- Telemedicine (doc/back/telemedicine/sync-queue.md) ---------- */

export interface TempusProPacket {
  packet_id: number;
  astronaut_id: string;
  timestamp: string;
  location_setting: string;
  triage_tier: string;
  status: BackendStatus | string;
  priority: "CRITICAL" | "HIGH" | "ROUTINE" | string;
  transmission_status: "pending" | "transmitted" | string;
  transmitted_at?: string | null;
  earth_comm_latency_sec: number;
  anomaly_flags: string[];
  recommended_actions: string[];
  standard_measures_telemetry: Record<string, unknown>;
  trend_forecasts_summary: Record<string, unknown>;
}

export interface TelemedicineSyncQueueResponse {
  status: BackendStatus;
  high_level: string;
  technical: string;
  location_setting: string;
  earth_comm_latency_sec: number;
  offline_fallback_active: boolean;
  comm_window_open: boolean;
  pending_count: number;
  transmitted_count: number;
  packets: TempusProPacket[];
}

export interface TelemedicineFlushRequest {
  astronaut_id?: string | null;
  packet_ids?: number[] | null;
  force_flush?: boolean;
  ground_station?: string;
}

export interface TelemedicineFlushResponse {
  status: BackendStatus;
  high_level: string;
  technical: string;
  flushed_count: number;
  remaining_pending_count: number;
  ground_station: string;
  transmitted_at: string;
  flushed_packets: TempusProPacket[];
}

/* ---------- Tests / DB Snapshot ---------- */

export interface DatabaseSnapshotRestoreResponse {
  status: BackendStatus;
  high_level: string;
  technical: string;
  restored: boolean;
  restored_at: string;
  default_astronaut_id: string;
  default_location_setting: string;
  seeded_counts: Record<string, number>;
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
  /** Backend anatomical enrichment (Phase 1-4). */
  uiToken?: "status-nominal" | "status-caution" | "status-critical";
  highLevel?: string;
  technical?: string;
  selfExamSteps?: string[];
  recommendedCountermeasures?: string[];
  activeRisks?: string[];
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

/** A drill-down anatomical structure rendered inside a BodyZone. */
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
  /** Backend anatomical status metadata. */
  locationSetting?: string;
  overallStatus?: BackendStatus;
  overallUiToken?: "status-nominal" | "status-caution" | "status-critical";
  highLevel?: string;
  technical?: string;
}

/* ---------- Telemetry / trends ---------- */

export type TelemetryMetric =
  | "heart_rate"
  | "spo2"
  | "core_temp"
  | "exertion"
  | "radiation"
  | "fatigue"
  | "blood_sugar"
  | "bone_density"
  | "visual_acuity"
  | "mission_readiness";

export interface TelemetryPoint {
  t: string;
  value: number;
  lowerCi?: number;
  upperCi?: number;
}

export interface MissionEvent {
  t: string;
  label: string;
  kind: "eva" | "radiation" | "gravity" | "sleep" | "exercise";
  impact?: string;
  description?: string | null;
}

export interface TelemetrySeries {
  metric: TelemetryMetric;
  indicator?: string;
  label: string;
  unit: string;
  points: TelemetryPoint[];
  forecast: TelemetryPoint[];
  events: MissionEvent[];
  /** Provider-owned reference band — never clinical constants in the UI. */
  band?: { low: number; high: number; label: string };
  thresholdWarning?: boolean;
  warningDetails?: string | null;
  status?: BackendStatus;
  highLevel?: string;
  technical?: string;
}

/* ---------- Location context ---------- */

export interface HazardWeights {
  radiation: number;
  isolation: number;
  gravity: number;
  workload: number;
  distance?: number;
  composite?: number;
}

export interface LocationProfile {
  id: LocationId;
  label: string;
  locationSetting?: string;
  gravityG?: number;
  commLatencySec: number;
  blackoutRisk: string;
  /** How the AI/TTS adapters behave under this comm profile. */
  linkMode: "local" | "advisory";
  offlineFallbackActive?: boolean;
  hazards: HazardWeights;
  hazardMultipliers?: HazardMultipliers;
  eclss?: {
    temperature_c: number;
    pressure_kpa: number;
    lighting_lux: number;
    noise_dba: number;
    microbial_cfu_m3: number;
    co2_mmhg: number;
  };
  status?: BackendStatus;
  highLevel?: string;
  technical?: string;
  updatedAt?: string;
}

/* ---------- AI companion ---------- */

export interface AssistantAction {
  type: "focus";
  zoneId: ZoneId;
}

export interface AssistantResponse {
  message: string;
  highLevel?: string;
  technical?: string;
  status?: BackendStatus;
  referencedZoneIds: ZoneId[];
  actions: AssistantAction[];
  insights: AIInsight[];
  assumptions: string[];
  /** Declared operating mode, driven by the active LocationProfile. */
  mode: "local" | "advisory";
  providerUsed?: string;
  failoverReason?: string | null;
  offlineMode?: boolean;
  earthCommLatencySec?: number;
  triageTier?: string;
  retrievedKnowledge?: KnowledgeDocument[];
  recommendedActions?: string[];
  voicePayload?: TTSResponse | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  contextZoneId?: ZoneId;
  hasImage?: boolean;
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
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;
  palette: { suit: string; accent: string };
  unlocked?: boolean;
  equipped?: boolean;
  probabilityPercent?: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  frequency?: string;
  category?: string;
  description?: string | null;
}

export interface GamificationState {
  streakDays: number;
  totalCheckupsCompleted?: number;
  gachaponTokens?: number;
  complianceRatePercent?: number;
  checklist: ChecklistItem[];
  ownedSkinIds: string[];
  equippedSkinId?: string;
  catalog?: SkinDef[];
  status?: BackendStatus;
  highLevel?: string;
  technical?: string;
}

/* ---------- Local users & daily check-in (frontend-only, localStorage) ---------- */

/** Operator session role — `medic` sees every enrolled user; `user` sees only their own. */
export type UserRole = "medic" | "user";

/** Enrolled console operator. facePhoto is a compressed JPEG dataURL backed by face_credentials. */
export interface LocalUser {
  id: string;
  name: string;
  callsign?: string;
  role: UserRole;
  facePhoto: string;
  /** Gamification key — the backend auto-seeds a profile for any astronaut_id. */
  astronautId: string;
  wheelSpinsClaimed?: number;
  createdAt: string;
}

export interface CheckInRecord {
  userId: string;
  /** YYYY-MM-DD local day key. */
  day: string;
  at: string;
}

/* ---------- Backend Auth & Facial Recognition (/api/v1/auth/*) ---------- */

export interface AuthSessionStateResponse {
  status: BackendStatus;
  users: LocalUser[];
  check_ins: CheckInRecord[];
  face_credentials_count: number;
}

export interface RegisterOperatorRequest {
  id?: string;
  name: string;
  callsign?: string;
  role?: UserRole;
  astronaut_id?: string;
  face_photo: string;
  label?: string;
}

export interface RegisterOperatorResponse {
  status: BackendStatus;
  user: LocalUser;
  face_credential_id: number;
  embedding_dim: number;
  model_name: string;
}

export interface FaceIdentifyResponse {
  status: "matched" | "unknown_face" | "no_face";
  matched_user?: LocalUser | null;
  confidence: number;
  threshold: number;
  model_name: string;
  message: string;
}

export interface OperatorCheckInResponse {
  status: BackendStatus;
  is_new_day: boolean;
  earned_spin: boolean;
  streak: number;
  total_checkins: number;
  pending_spins: number;
  check_in: CheckInRecord;
}

export interface ClaimWheelSpinRequest {
  user_id: string;
  unlocked_skin_id?: string | null;
  equip?: boolean;
}

export interface ClaimWheelSpinResponse {
  status: BackendStatus;
  user_id: string;
  wheel_spins_claimed: number;
  pending_spins: number;
  unlocked_skin_id?: string | null;
  unlocked_skins: string[];
}
