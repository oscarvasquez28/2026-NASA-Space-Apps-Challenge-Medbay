/**
 * HealthDataProvider — the single data contract the UI talks to.
 *
 * Implementations:
 *  - MockHealthDataProvider (services/mock-provider.ts): deterministic
 *    curated datasets + simulated latency. Fully offline.
 *  - RestHealthDataProvider (services/rest-provider.ts): maps the real
 *    backend endpoints where they exist (/health, /triage/evaluate) and
 *    delegates the not-yet-implemented surface to the mock provider.
 *
 * Swap via env: NEXT_PUBLIC_DATA_PROVIDER=mock|rest (or DATA_PROVIDER
 * through /api/runtime-config inside Docker).
 */

import type {
  AssistantResponse,
  BehaviorLog,
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
  VitalSigns,
  ZoneId,
} from "@/types/health";

export interface AssistantRequest {
  prompt: string;
  contextZoneId?: ZoneId | null;
  locationId: LocationId;
}

export interface HealthDataProvider {
  readonly kind: "mock" | "rest";

  /** Connectivity probe — maps to GET /health in rest mode. */
  checkHealth(): Promise<HealthResponse>;

  getCrew(): Promise<CrewMember[]>;
  getCrewMember(id: string): Promise<CrewMember | undefined>;

  getLocations(): Promise<LocationProfile[]>;
  getLocationProfile(id: LocationId): Promise<LocationProfile>;

  getTelemetrySeries(
    crewId: string,
    metric: TelemetryMetric,
  ): Promise<TelemetrySeries>;

  /** Submit a vitals snapshot → triage evaluation (POST /triage/evaluate). */
  submitTelemetry(
    crewId: string,
    vitals: VitalSigns,
  ): Promise<TriageAssessment>;

  /** Submit a behavioral log entry (sleep, mood, hydration, exercise). */
  submitLog(crewId: string, log: BehaviorLog): Promise<LogAck>;

  /** AI companion — mock script today, LLM adapter later. */
  ask(
    crewId: string,
    req: AssistantRequest,
    signal?: AbortSignal,
  ): Promise<AssistantResponse>;

  getGamification(crewId: string): Promise<GamificationState>;
  pullGachapon(crewId: string): Promise<SkinDef>;
}
