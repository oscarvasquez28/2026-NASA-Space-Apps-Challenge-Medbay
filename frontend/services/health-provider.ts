/**
 * HealthDataProvider — the single data contract the UI talks to.
 *
 * Implementations:
 *  - MockHealthDataProvider (services/mock-provider.ts): deterministic
 *    curated datasets + simulated latency. Fully offline.
 *  - RestHealthDataProvider (services/rest-provider.ts): connects all
 *    frontend modules directly to the FastAPI backend (/health, /api/v1/*)
 *    with offline browser fallbacks preserved in MockHealthDataProvider.
 *
 * Swap via env: NEXT_PUBLIC_DATA_PROVIDER=mock|rest (or DATA_PROVIDER
 * through /api/runtime-config inside Docker). Default: rest.
 */

import type {
  AssistantResponse,
  BehaviorLog,
  CheckupCompleteRequest,
  CheckupCompleteResponse,
  CrewMember,
  DatabaseSnapshotRestoreResponse,
  GamificationState,
  HealthResponse,
  KnowledgeSearchResponse,
  LocationContextUpdate,
  LocationId,
  LocationProfile,
  LogAck,
  SkinDef,
  TelemedicineFlushRequest,
  TelemedicineFlushResponse,
  TelemedicineSyncQueueResponse,
  TelemetryIngestRequest,
  TelemetryIngestResponse,
  TelemetryMetric,
  TelemetrySeries,
  TriageAssessment,
  TTSRequest,
  TTSResponse,
  ViewMode,
  VitalSigns,
  ZoneId,
} from "@/types/health";

export interface AssistantRequest {
  prompt: string;
  contextZoneId?: ZoneId | null;
  locationId: LocationId;
  viewMode?: ViewMode;
  forceOffline?: boolean;
  includeVoice?: boolean;
  diagnosticImageBase64?: string | null;
}

export interface HealthDataProvider {
  readonly kind: "mock" | "rest";

  /** Connectivity probe — maps to GET /health in rest mode. */
  checkHealth(): Promise<HealthResponse>;

  getCrew(): Promise<CrewMember[]>;
  getCrewMember(id: string): Promise<CrewMember | undefined>;

  getLocations(): Promise<LocationProfile[]>;
  getLocationProfile(id: LocationId): Promise<LocationProfile>;
  getActiveLocation(): Promise<LocationProfile>;
  updateLocationProfile(
    id: LocationId,
    updates?: Partial<LocationContextUpdate>,
  ): Promise<LocationProfile>;

  getTelemetrySeries(
    crewId: string,
    metric: TelemetryMetric,
  ): Promise<TelemetrySeries>;

  /** Submit a vitals snapshot → triage evaluation (POST /api/v1/triage/evaluate). */
  submitTelemetry(
    crewId: string,
    vitals: VitalSigns,
  ): Promise<TriageAssessment>;

  /** Submit comprehensive multimodal telemetry (POST /api/v1/telemetry/ingest). */
  ingestTelemetry(
    payload: TelemetryIngestRequest,
    imageFile?: File | null,
  ): Promise<TelemetryIngestResponse>;

  /** Submit a behavioral log entry (sleep, mood, hydration, exercise). */
  submitLog(crewId: string, log: BehaviorLog): Promise<LogAck>;

  /** Semantic RAG search (GET /api/v1/ai/knowledge). */
  searchKnowledge(
    query: string,
    opts?: { category?: string; topK?: number },
  ): Promise<KnowledgeSearchResponse>;

  /** AI clinical companion (POST /api/v1/ai/chat). */
  ask(
    crewId: string,
    req: AssistantRequest,
    signal?: AbortSignal,
  ): Promise<AssistantResponse>;

  /** Voice TTS + visemes (POST /api/v1/ai/tts). */
  synthesizeSpeech(
    req: TTSRequest,
    signal?: AbortSignal,
  ): Promise<TTSResponse>;

  getGamification(crewId: string): Promise<GamificationState>;
  completeCheckup(
    req: CheckupCompleteRequest,
  ): Promise<CheckupCompleteResponse>;
  pullGachapon(crewId: string): Promise<SkinDef>;

  getTelemedicineQueue(): Promise<TelemedicineSyncQueueResponse>;
  flushTelemedicineQueue(
    req?: TelemedicineFlushRequest,
  ): Promise<TelemedicineFlushResponse>;

  restoreDatabaseSnapshot(): Promise<DatabaseSnapshotRestoreResponse>;
}
