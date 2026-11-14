/**
 * Centralized HTTP client for the backend API.
 * All requests go through `request()` so error handling stays consistent.
 * Endpoints consumed (doc/back/api/endpoints.md):
 *   - GET  /health
 *   - POST /api/v1/triage/evaluate
 */

import { getRuntimeConfig } from "./config";
import type {
  HealthResponse,
  TriageAssessment,
  VitalSigns,
} from "@/types/health";

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiUrl } = await getRuntimeConfig();

  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(
      `Backend unreachable at ${apiUrl}. Verify the backend service is running.`,
    );
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status} ${res.statusText}`.trim();
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = `${detail} — ${body.detail}`;
      else if (body.detail) detail = `${detail} — ${JSON.stringify(body.detail)}`;
    } catch {
      // Non-JSON error body; keep the status detail.
    }
    throw new ApiError(detail, res.status);
  }

  return (await res.json()) as T;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export function evaluateTriage(vitals: VitalSigns): Promise<TriageAssessment> {
  return request<TriageAssessment>("/api/v1/triage/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vitals),
  });
}
