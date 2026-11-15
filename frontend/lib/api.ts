/**
 * Typed HTTP client for every FastAPI backend endpoint across Phases 1–4.
 *
 * Uses runtime-resolved backend base URL from `getRuntimeConfig()` so the
 * browser container works across local dev, Docker Compose, and Cloud Run.
 */

import { getRuntimeConfig } from "./config";
import type {
  AIChatRequest,
  AIChatResponse,
  AstronautBodyStatusResponse,
  AuthSessionStateResponse,
  BackendTrendIndicator,
  CheckupCompleteRequest,
  CheckupCompleteResponse,
  ClaimWheelSpinRequest,
  ClaimWheelSpinResponse,
  DatabaseSnapshotRestoreResponse,
  FaceIdentifyResponse,
  GamificationStatusResponse,
  HealthResponse,
  KnowledgeSearchResponse,
  LocationContextResponse,
  LocationContextUpdate,
  OperatorCheckInResponse,
  RegisterOperatorRequest,
  RegisterOperatorResponse,
  TelemedicineFlushRequest,
  TelemedicineFlushResponse,
  TelemedicineSyncQueueResponse,
  TelemetryIngestRequest,
  TelemetryIngestResponse,
  TrendAnalysisResponse,
  TriageAssessment,
  TTSRequest,
  TTSResponse,
  VitalSigns,
} from "@/types/health";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { apiUrl } = await getRuntimeConfig();
  const baseUrl = apiUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const { timeoutMs = 15_000, signal: externalSignal, headers, body, ...rest } =
    options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const resolvedHeaders = new Headers(headers);
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData && body !== undefined && !resolvedHeaders.has("Content-Type")) {
    resolvedHeaders.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(url, {
      ...rest,
      body,
      headers: resolvedHeaders,
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail: unknown = undefined;
      let msg = `${res.status} ${res.statusText}`;
      try {
        detail = await res.json();
        if (detail && typeof detail === "object" && "detail" in detail) {
          const d = (detail as { detail: unknown }).detail;
          msg = typeof d === "string" ? d : JSON.stringify(d);
        }
      } catch {
        try {
          const txt = await res.text();
          if (txt) msg = txt;
        } catch {
          // ignore secondary parse errors
        }
      }
      throw new ApiError(msg, res.status, detail);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "Network request failed",
      0,
    );
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

/* ---------- 1. Health & Baseline Triage ---------- */

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health", { method: "GET", timeoutMs: 8_000 });
}

export function evaluateTriage(vitals: VitalSigns): Promise<TriageAssessment> {
  return apiFetch<TriageAssessment>("/api/v1/triage/evaluate", {
    method: "POST",
    body: JSON.stringify(vitals),
  });
}

/* ---------- 2. Operational Context & 5-Hazards ---------- */

export function getContextLocation(): Promise<LocationContextResponse> {
  return apiFetch<LocationContextResponse>("/api/v1/context/location", {
    method: "GET",
  });
}

export function updateContextLocation(
  payload: LocationContextUpdate,
): Promise<LocationContextResponse> {
  return apiFetch<LocationContextResponse>("/api/v1/context/location", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ---------- 3. Multi-Modal Telemetry Ingest ---------- */

export function ingestTelemetry(
  payload: TelemetryIngestRequest,
  imageFile?: File | null,
): Promise<TelemetryIngestResponse> {
  if (imageFile) {
    const fd = new FormData();
    const appendIf = (k: string, v: unknown) => {
      if (v !== undefined && v !== null && v !== "") {
        fd.append(k, String(v));
      }
    };
    appendIf("astronaut_id", payload.astronaut_id);
    appendIf("heart_rate_bpm", payload.heart_rate_bpm);
    appendIf("systolic_bp_mmhg", payload.systolic_bp_mmhg);
    appendIf("diastolic_bp_mmhg", payload.diastolic_bp_mmhg);
    appendIf("blood_sugar_mg_dl", payload.blood_sugar_mg_dl);
    appendIf("core_temp_c", payload.core_temp_c);
    appendIf("spo2_percent", payload.spo2_percent);
    appendIf("sleep_hours", payload.sleep_hours);
    appendIf("mood_score", payload.mood_score);
    appendIf("stress_level", payload.stress_level);
    appendIf("suit_pressure_kpa", payload.suit_pressure_kpa);
    appendIf("co2_partial_pressure_mmhg", payload.co2_partial_pressure_mmhg);
    appendIf("radiation_dose_msv", payload.radiation_dose_msv);
    appendIf("visual_acuity_logmar", payload.visual_acuity_logmar);
    appendIf(
      "bone_mineral_density_t_score",
      payload.bone_mineral_density_t_score,
    );
    appendIf("target_anatomical_zone", payload.target_anatomical_zone);
    if (payload.symptoms && payload.symptoms.length > 0) {
      fd.append("symptoms", payload.symptoms.join(","));
    }
    fd.append("diagnostic_image", imageFile, imageFile.name);
    return apiFetch<TelemetryIngestResponse>("/api/v1/telemetry/ingest", {
      method: "POST",
      body: fd,
      timeoutMs: 30_000,
    });
  }

  return apiFetch<TelemetryIngestResponse>("/api/v1/telemetry/ingest", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ---------- 4. 6-Zone Anatomical Body Status ---------- */

export function getAstronautBodyStatus(
  astronautId: string,
): Promise<AstronautBodyStatusResponse> {
  const q = new URLSearchParams({ astronaut_id: astronautId });
  return apiFetch<AstronautBodyStatusResponse>(
    `/api/v1/astronaut/body-status?${q.toString()}`,
    { method: "GET" },
  );
}

/* ---------- 5. Trends & 95% CI Forecasting ---------- */

export function getTrendAnalysis(
  indicator: BackendTrendIndicator,
  astronautId: string,
  opts?: { historyLimit?: number; forecastSteps?: number },
): Promise<TrendAnalysisResponse> {
  const q = new URLSearchParams({ astronaut_id: astronautId });
  if (opts?.historyLimit !== undefined) {
    q.set("history_limit", String(opts.historyLimit));
  }
  if (opts?.forecastSteps !== undefined) {
    q.set("forecast_steps", String(opts.forecastSteps));
  }
  return apiFetch<TrendAnalysisResponse>(
    `/api/v1/trends/${encodeURIComponent(indicator)}?${q.toString()}`,
    { method: "GET" },
  );
}

/* ---------- 6. RAG Space Medicine Knowledge Base ---------- */

export function searchKnowledge(
  query: string,
  opts?: { category?: string; topK?: number },
): Promise<KnowledgeSearchResponse> {
  const q = new URLSearchParams({ q: query });
  if (opts?.category) q.set("category", opts.category);
  if (opts?.topK !== undefined) q.set("top_k", String(opts.topK));
  return apiFetch<KnowledgeSearchResponse>(
    `/api/v1/ai/knowledge?${q.toString()}`,
    { method: "GET" },
  );
}

/* ---------- 7. Clinical AI Chat & Voice TTS ---------- */

export function sendAIChat(
  payload: AIChatRequest,
  signal?: AbortSignal,
): Promise<AIChatResponse> {
  return apiFetch<AIChatResponse>("/api/v1/ai/chat", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
    timeoutMs: 45_000,
  });
}

export function synthesizeTTS(
  payload: TTSRequest,
  signal?: AbortSignal,
): Promise<TTSResponse> {
  return apiFetch<TTSResponse>("/api/v1/ai/tts", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
    timeoutMs: 30_000,
  });
}

/* ---------- 8. Gamification & Gachapon ---------- */

export function getGamificationStatus(
  astronautId: string,
): Promise<GamificationStatusResponse> {
  const q = new URLSearchParams({ astronaut_id: astronautId });
  return apiFetch<GamificationStatusResponse>(
    `/api/v1/gamification/status?${q.toString()}`,
    { method: "GET" },
  );
}

export function completeCheckup(
  payload: CheckupCompleteRequest,
): Promise<CheckupCompleteResponse> {
  return apiFetch<CheckupCompleteResponse>(
    "/api/v1/gamification/checkup-complete",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/* ---------- 9. Tempus Pro Telemedicine Sync Queue ---------- */

export function getTelemedicineSyncQueue(): Promise<TelemedicineSyncQueueResponse> {
  return apiFetch<TelemedicineSyncQueueResponse>(
    "/api/v1/telemedicine/sync-queue",
    { method: "GET" },
  );
}

export function flushTelemedicineQueue(
  payload: TelemedicineFlushRequest = {},
): Promise<TelemedicineFlushResponse> {
  return apiFetch<TelemedicineFlushResponse>("/api/v1/telemedicine/flush", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ---------- 10. Database Seeder Snapshot (Test Reset) ---------- */

export function restoreDatabaseSnapshot(): Promise<DatabaseSnapshotRestoreResponse> {
  return apiFetch<DatabaseSnapshotRestoreResponse>("/api/v1/tests/dbsnapshot", {
    method: "PUT",
    timeoutMs: 30_000,
  });
}

/* ---------- 11. Operator Auth, Facial Recognition & Check-In Session ---------- */

export function getAuthSessionState(): Promise<AuthSessionStateResponse> {
  return apiFetch<AuthSessionStateResponse>("/api/v1/auth/session-state", {
    method: "GET",
  });
}

export function registerOperator(
  payload: RegisterOperatorRequest,
): Promise<RegisterOperatorResponse> {
  return apiFetch<RegisterOperatorResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 20_000,
  });
}

export function identifyOperatorFace(
  facePhoto: string,
): Promise<FaceIdentifyResponse> {
  return apiFetch<FaceIdentifyResponse>("/api/v1/auth/identify", {
    method: "POST",
    body: JSON.stringify({ face_photo: facePhoto }),
    timeoutMs: 20_000,
  });
}

export function recordOperatorCheckIn(
  userId: string,
  day?: string,
): Promise<OperatorCheckInResponse> {
  return apiFetch<OperatorCheckInResponse>("/api/v1/auth/checkin", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, day }),
  });
}

export function claimOperatorWheelSpin(
  payload: ClaimWheelSpinRequest,
): Promise<ClaimWheelSpinResponse> {
  return apiFetch<ClaimWheelSpinResponse>("/api/v1/auth/claim-wheel-spin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteOperatorUser(
  userId: string,
): Promise<{ status: string; user_id: string }> {
  return apiFetch<{ status: string; user_id: string }>(
    `/api/v1/auth/users/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}
