/**
 * RestHealthDataProvider — real backend wiring.
 *
 * Implements the contract surface the backend actually exposes
 * (doc/back/api/endpoints.md):
 *   - GET  /health                    → checkHealth
 *   - POST /api/v1/triage/evaluate    → submitTelemetry
 *
 * Everything else (crew, zones, trends, assistant, gamification) has no
 * backend endpoint yet, so those methods delegate to the mock provider —
 * clearly marked via `kind: "rest"` + `partial: true` so the UI can label
 * the mixed provenance honestly.
 */

import { evaluateTriage, getHealth } from "@/lib/api";
import { MockHealthDataProvider } from "./mock-provider";
import type {
  AssistantRequest,
  HealthDataProvider,
} from "./health-provider";
import type {
  HealthResponse,
  TriageAssessment,
  VitalSigns,
} from "@/types/health";

export class RestHealthDataProvider implements HealthDataProvider {
  readonly kind = "rest" as const;
  /** Only a subset of the contract is backed by real endpoints today. */
  readonly partial = true;

  private mock = new MockHealthDataProvider();

  checkHealth(): Promise<HealthResponse> {
    return getHealth();
  }

  submitTelemetry(
    _crewId: string,
    vitals: VitalSigns,
  ): Promise<TriageAssessment> {
    return evaluateTriage(vitals);
  }

  // --- delegated to the mock provider (no backend endpoint yet) ---

  getCrew: HealthDataProvider["getCrew"] = ( ) =>
    this.mock.getCrew();
  getCrewMember: HealthDataProvider["getCrewMember"] = (id) =>
    this.mock.getCrewMember(id);
  getLocations: HealthDataProvider["getLocations"] = () =>
    this.mock.getLocations();
  getLocationProfile: HealthDataProvider["getLocationProfile"] = (id) =>
    this.mock.getLocationProfile(id);
  getTelemetrySeries: HealthDataProvider["getTelemetrySeries"] = (id, m) =>
    this.mock.getTelemetrySeries(id, m);
  submitLog: HealthDataProvider["submitLog"] = (id, log) =>
    this.mock.submitLog(id, log);
  ask: HealthDataProvider["ask"] = (id, req: AssistantRequest, signal) =>
    this.mock.ask(id, req, signal);
  getGamification: HealthDataProvider["getGamification"] = (id) =>
    this.mock.getGamification(id);
  pullGachapon: HealthDataProvider["pullGachapon"] = (id) =>
    this.mock.pullGachapon(id);
}
