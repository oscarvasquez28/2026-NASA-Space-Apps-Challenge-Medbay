"use client";

/**
 * TelemetryLogger — module E.
 * Multi-modal clinical telemetry ingest (POST /api/v1/telemetry/ingest),
 * standalone triage evaluation (POST /api/v1/triage/evaluate), and behavioral logs.
 */

import { Activity, Camera, SendHorizontal, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import {
  Disclaimer,
  Eyebrow,
  StatusChip,
} from "@/components/ui/primitives";
import { useProvider } from "@/hooks/useProvider";
import { useAppStore } from "@/stores/app-store";
import type {
  BehaviorLog,
  TelemetryIngestRequest,
  TelemetryIngestResponse,
  TriageAssessment,
  TriageLevel,
  VitalSigns,
} from "@/types/health";

const ANATOMICAL_ZONES = [
  { id: "", label: "Auto / Global" },
  { id: "head_eyes", label: "Head & Eyes (SANS / CO2)" },
  { id: "cardiovascular_chest", label: "Cardiovascular / Chest" },
  { id: "spine_skeletal", label: "Spine & Skeletal" },
  { id: "musculoskeletal_limbs", label: "Musculoskeletal / Limbs" },
  { id: "gut_microbiome", label: "Gut & Metabolic" },
  { id: "skin", label: "Skin / Radiation" },
];

const DEFAULT_VITALS_FORM: Record<string, string> = {
  heart_rate_bpm: "72",
  spo2_percent: "98.5",
  core_temp_c: "37.0",
  systolic_bp_mmhg: "120",
  diastolic_bp_mmhg: "80",
  blood_sugar_mg_dl: "95",
  suit_pressure_kpa: "",
  co2_partial_pressure_mmhg: "",
  radiation_dose_msv: "",
  visual_acuity_logmar: "",
  bone_mineral_density_t_score: "",
  sleep_hours: "",
  mood_score: "",
  stress_level: "",
};

const VITAL_FIELDS: { key: string; label: string; unit: string; required?: boolean }[] = [
  { key: "heart_rate_bpm", label: "Heart rate", unit: "bpm", required: true },
  { key: "spo2_percent", label: "SpO2", unit: "%", required: true },
  { key: "core_temp_c", label: "Core temperature", unit: "°C", required: true },
  { key: "systolic_bp_mmhg", label: "Systolic BP", unit: "mmHg" },
  { key: "diastolic_bp_mmhg", label: "Diastolic BP", unit: "mmHg" },
  { key: "blood_sugar_mg_dl", label: "Blood glucose", unit: "mg/dL" },
  { key: "suit_pressure_kpa", label: "Suit pressure", unit: "kPa" },
  { key: "co2_partial_pressure_mmhg", label: "Cabin ppCO2", unit: "mmHg" },
  { key: "radiation_dose_msv", label: "Radiation dose", unit: "mSv" },
  { key: "visual_acuity_logmar", label: "Visual acuity", unit: "logMAR" },
  { key: "bone_mineral_density_t_score", label: "BMD T-score", unit: "T" },
  { key: "sleep_hours", label: "Sleep duration", unit: "hr" },
  { key: "mood_score", label: "Mood index", unit: "/10" },
  { key: "stress_level", label: "Stress level", unit: "/10" },
];

const LOG_KINDS: { kind: BehaviorLog["kind"]; label: string; hint: string }[] = [
  { kind: "sleep", label: "Sleep", hint: "e.g. 7.5" },
  { kind: "mood", label: "Mood", hint: "e.g. 8" },
  { kind: "hydration", label: "Hydration", hint: "e.g. 2.1 L" },
  { kind: "exercise", label: "Exercise", hint: "e.g. ARED 60 min" },
];

function backendStatusToTriageLevel(s: string): TriageLevel {
  const norm = s.toLowerCase();
  if (norm === "critical" || norm === "urgent") return "CRITICAL";
  if (norm === "caution") return "CAUTION";
  return "NOMINAL";
}

interface LoggerProps {
  crewId: string;
  onSubmitted?: () => void;
}

export function TelemetryLogger({ crewId, onSubmitted }: LoggerProps) {
  const provider = useProvider();
  const viewMode = useAppStore((s) => s.viewMode);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<Record<string, string>>(DEFAULT_VITALS_FORM);
  const [targetZone, setTargetZone] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageAssessment | null>(null);
  const [ingestResult, setIngestResult] = useState<TelemetryIngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [logKind, setLogKind] = useState<BehaviorLog["kind"]>("sleep");
  const [logValue, setLogValue] = useState("");
  const [logAcks, setLogAcks] = useState<string[]>([]);

  const num = (k: string) => {
    const raw = form[k]?.trim() ?? "";
    if (!raw) return undefined;
    const v = Number(raw);
    return Number.isFinite(v) ? v : undefined;
  };

  const parsedSymptoms = () =>
    symptoms
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const submitIngest = async () => {
    if (!provider) return;
    const hr = num("heart_rate_bpm");
    if (hr == null) {
      setError("Heart rate (bpm) requires a numeric value.");
      return;
    }

    const payload: TelemetryIngestRequest = {
      astronaut_id: crewId,
      heart_rate_bpm: hr,
      systolic_bp_mmhg: num("systolic_bp_mmhg"),
      diastolic_bp_mmhg: num("diastolic_bp_mmhg"),
      blood_sugar_mg_dl: num("blood_sugar_mg_dl"),
      core_temp_c: num("core_temp_c"),
      spo2_percent: num("spo2_percent"),
      sleep_hours: num("sleep_hours"),
      mood_score: num("mood_score"),
      stress_level: num("stress_level"),
      suit_pressure_kpa: num("suit_pressure_kpa") ?? null,
      co2_partial_pressure_mmhg: num("co2_partial_pressure_mmhg") ?? null,
      radiation_dose_msv: num("radiation_dose_msv") ?? null,
      visual_acuity_logmar: num("visual_acuity_logmar") ?? null,
      bone_mineral_density_t_score:
        num("bone_mineral_density_t_score") ?? null,
      symptoms: parsedSymptoms(),
      target_anatomical_zone: targetZone || null,
    };

    setSubmitting(true);
    setError(null);
    setTriageResult(null);
    try {
      const res = await provider.ingestTelemetry(payload, imageFile);
      setIngestResult(res);
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Telemetry ingest failed.");
      setIngestResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  const submitTriageOnly = async () => {
    if (!provider) return;
    const hr = num("heart_rate_bpm");
    const spo2 = num("spo2_percent");
    const temp = num("core_temp_c");
    if (hr == null || spo2 == null || temp == null) {
      setError("Heart rate, SpO2 and core temperature require numeric values.");
      return;
    }
    const vitals: VitalSigns = {
      astronaut_id: crewId,
      timestamp: new Date().toISOString(),
      heart_rate_bpm: hr,
      spo2_percent: spo2,
      core_temp_c: temp,
      systolic_bp_mmhg: num("systolic_bp_mmhg"),
      suit_pressure_kpa: num("suit_pressure_kpa") ?? null,
      radiation_msv_hr: num("radiation_dose_msv")
        ? Number((num("radiation_dose_msv")! / 24).toFixed(3))
        : null,
      symptoms: parsedSymptoms(),
    };

    setSubmitting(true);
    setError(null);
    setIngestResult(null);
    try {
      const res = await provider.submitTelemetry(crewId, vitals);
      setTriageResult(res);
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Triage evaluation failed.");
      setTriageResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  const submitLog = async () => {
    if (!provider || !logValue.trim()) return;
    try {
      const ack = await provider.submitLog(crewId, {
        kind: logKind,
        value: logValue.trim(),
      });
      setLogAcks((a) =>
        [
          `${ack.kind} persisted · ${new Date(ack.receivedAt).toLocaleTimeString()}`,
          ...a,
        ].slice(0, 5),
      );
      setLogValue("");
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Behavioral log failed.");
    }
  };

  const technical = viewMode === "technical";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 14,
        }}
      >
        {/* full telemetry ingest form */}
        <div className="panel panel-pad">
          <Eyebrow>Multi-modal telemetry ingest / manual entry</Eyebrow>
          <div style={{ marginTop: 10 }}>
            {VITAL_FIELDS.map((row) => (
              <div className="form-row" key={row.key}>
                <label htmlFor={`in-${row.key}`}>
                  {row.label}
                  {!row.required && (
                    <span className="micro-8" style={{ marginLeft: 6 }}>
                      opt
                    </span>
                  )}
                </label>
                <input
                  id={`in-${row.key}`}
                  type="number"
                  step="any"
                  value={form[row.key] ?? ""}
                  aria-required={row.required}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [row.key]: e.target.value }))
                  }
                />
                <span className="unit">{row.unit}</span>
              </div>
            ))}

            <div className="form-row">
              <label htmlFor="in-zone">Target zone</label>
              <select
                id="in-zone"
                className="ctx-select"
                value={targetZone}
                onChange={(e) => setTargetZone(e.target.value)}
              >
                {ANATOMICAL_ZONES.map((z) => (
                  <option key={z.id || "auto"} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
              <span className="unit">6-zone</span>
            </div>

            <div className="form-row" style={{ gridTemplateColumns: "1fr" }}>
              <label htmlFor="in-symptoms">Symptoms (comma-separated)</label>
              <input
                id="in-symptoms"
                type="text"
                value={symptoms}
                placeholder="headache, dizziness, dyspnea…"
                onChange={(e) => setSymptoms(e.target.value)}
                style={{ gridColumn: "1 / -1" }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 14,
              alignItems: "center",
            }}
          >
            <button
              className="btn btn-primary"
              onClick={() => void submitIngest()}
              disabled={submitting || !provider}
            >
              <SendHorizontal size={11} />
              {submitting ? "Ingesting…" : "Ingest Telemetry (DB + Image)"}
            </button>
            <button
              className="btn"
              onClick={() => void submitTriageOnly()}
              disabled={submitting || !provider}
            >
              <Activity size={11} />
              Evaluate Triage Only
            </button>
          </div>

          {error && (
            <p
              className="micro"
              role="alert"
              style={{ marginTop: 12, color: "var(--status-critical)" }}
            >
              {error}
            </p>
          )}

          {ingestResult && (
            <div className="callout" style={{ marginTop: 14 }} role="status">
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <StatusChip
                  level={backendStatusToTriageLevel(ingestResult.status)}
                />
                <span className="micro-8">
                  INGEST #{ingestResult.id} · TIER {ingestResult.triage_tier} ·
                  READINESS {Math.round(ingestResult.mission_readiness_score)}/100
                </span>
                <span className="micro-8" style={{ marginLeft: "auto" }}>
                  {new Date(ingestResult.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
                {technical ? ingestResult.technical : ingestResult.high_level}
              </p>
              {ingestResult.anomaly_flags.length > 0 && (
                <ul
                  style={{
                    margin: "8px 0 0",
                    paddingLeft: 16,
                    fontSize: 11,
                    color: "var(--status-critical)",
                  }}
                >
                  {ingestResult.anomaly_flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
              {ingestResult.recommended_actions.length > 0 && (
                <ul
                  style={{
                    margin: "8px 0 0",
                    paddingLeft: 16,
                    fontSize: 11,
                    color: "var(--status-nominal)",
                  }}
                >
                  {ingestResult.recommended_actions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
              {ingestResult.image_stored && ingestResult.image_metadata && (
                <div className="micro-8" style={{ marginTop: 8, color: "var(--accent)" }}>
                  IMAGE STORED: {ingestResult.image_metadata.filename} (
                  {ingestResult.image_metadata.format}{" "}
                  {ingestResult.image_metadata.width}×
                  {ingestResult.image_metadata.height}px ·{" "}
                  {ingestResult.image_metadata.size_bytes} B)
                </div>
              )}
            </div>
          )}

          {triageResult && (
            <div className="callout" style={{ marginTop: 14 }} role="status">
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <StatusChip level={triageResult.triage_level} />
                {triageResult.telemedicine_enqueued && (
                  <span className="micro-8" style={{ color: "var(--status-caution)" }}>
                    TEMPUS PRO ENQUEUED
                  </span>
                )}
                {typeof triageResult.ml_anomaly_score === "number" && (
                  <span className="micro-8">
                    ML ANOMALY {triageResult.ml_anomaly_score.toFixed(3)}
                  </span>
                )}
                <span className="micro-8" style={{ marginLeft: "auto" }}>
                  {new Date(triageResult.evaluated_at).toLocaleTimeString()}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                {(technical ? triageResult.technical : triageResult.high_level) ??
                  triageResult.summary}
              </p>
              {triageResult.ai_advisory && (
                <p style={{ fontSize: 11, color: "var(--accent)", marginTop: 6 }}>
                  AI ADVISORY: {triageResult.ai_advisory}
                </p>
              )}
              {triageResult.anomaly_flags.length > 0 && (
                <ul
                  style={{
                    margin: "8px 0 0",
                    paddingLeft: 16,
                    fontSize: 10,
                    color: "var(--status-critical)",
                  }}
                >
                  {triageResult.anomaly_flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
              {triageResult.recommended_actions.length > 0 && (
                <ul
                  style={{
                    margin: "8px 0 0",
                    paddingLeft: 16,
                    fontSize: 10,
                    color: "var(--muted)",
                  }}
                >
                  {triageResult.recommended_actions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* behavioral logs + real multimodal image upload */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="panel panel-pad">
            <Eyebrow>Behavioral log → telemetry persist</Eyebrow>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <select
                className="ctx-select"
                aria-label="Log kind"
                value={logKind}
                onChange={(e) =>
                  setLogKind(e.target.value as BehaviorLog["kind"])
                }
              >
                {LOG_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                style={{ flex: 1 }}
                placeholder={LOG_KINDS.find((k) => k.kind === logKind)?.hint}
                value={logValue}
                onChange={(e) => setLogValue(e.target.value)}
                aria-label="Log value"
              />
              <button
                className="btn"
                onClick={() => void submitLog()}
                disabled={!logValue.trim()}
              >
                Log
              </button>
            </div>
            {logAcks.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {logAcks.map((a) => (
                  <div
                    key={a}
                    className="micro-8"
                    style={{ padding: "3px 0", color: "var(--status-nominal)" }}
                  >
                    ✓ {a}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel panel-pad">
            <Eyebrow>Multi-modal scan ingest (Pillow validated)</Eyebrow>
            <div
              className="crosshair"
              style={{
                marginTop: 10,
                border: "1px dashed var(--line)",
                borderRadius: 4,
                padding: "20px 16px",
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              <Camera size={18} style={{ marginBottom: 8, color: "var(--accent)" }} />
              <p className="micro-8">
                {imageFile
                  ? `ATTACHED: ${imageFile.name} (${imageFile.size} B · ${imageFile.type || "image/png"})`
                  : "OPTIC / SKIN / DIAGNOSTIC IMAGE (PNG, JPG, WEBP)"}
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Diagnostic image upload"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setImageFile(f);
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => fileRef.current?.click()}
                >
                  Choose Image…
                </button>
                {imageFile && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setImageFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    <Trash2 size={11} /> Clear
                  </button>
                )}
              </div>
            </div>
            <Disclaimer>
              Multipart upload transmits directly to POST /api/v1/telemetry/ingest
              with server-side Pillow image validation & metadata inspection.
            </Disclaimer>
          </div>
        </div>
      </div>
    </div>
  );
}
