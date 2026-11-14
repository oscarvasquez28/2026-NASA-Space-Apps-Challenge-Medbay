"use client";

/**
 * TelemetryLogger — module E.
 * Manual vitals entry → provider.submitTelemetry → echoes the triage result.
 * Behavioral logs (sleep/mood/hydration/exercise) → provider.submitLog.
 * Media upload slot is a disabled placeholder (suit-cam ingest, simulated).
 */

import { Camera, SendHorizontal } from "lucide-react";
import { useState } from "react";

import {
  Disclaimer,
  Eyebrow,
  StatusChip,
} from "@/components/ui/primitives";
import { useProvider } from "@/hooks/useProvider";
import { useAppStore } from "@/stores/app-store";
import type {
  BehaviorLog,
  TriageAssessment,
  VitalSigns,
} from "@/types/health";

const VITAL_ROWS: {
  key: keyof Pick<
    VitalSigns,
    | "heart_rate_bpm"
    | "spo2_percent"
    | "core_temp_c"
    | "systolic_bp_mmhg"
    | "suit_pressure_kpa"
    | "radiation_msv_hr"
  >;
  label: string;
  unit: string;
  required?: boolean;
  optional?: boolean;
}[] = [
  { key: "heart_rate_bpm", label: "Heart rate", unit: "bpm", required: true },
  { key: "spo2_percent", label: "SpO2", unit: "%", required: true },
  { key: "core_temp_c", label: "Core temperature", unit: "°C", required: true },
  { key: "systolic_bp_mmhg", label: "Systolic BP", unit: "mmHg" },
  { key: "suit_pressure_kpa", label: "Suit pressure", unit: "kPa", optional: true },
  { key: "radiation_msv_hr", label: "Radiation", unit: "mSv/h", optional: true },
];

const LOG_KINDS: { kind: BehaviorLog["kind"]; label: string; hint: string }[] = [
  { kind: "sleep", label: "Sleep", hint: "e.g. 7.5h, restful" },
  { kind: "mood", label: "Mood", hint: "e.g. calm, focused, irritable" },
  { kind: "hydration", label: "Hydration", hint: "e.g. 2.1 L" },
  { kind: "exercise", label: "Exercise", hint: "e.g. ARED 60 min" },
];

interface LoggerProps {
  crewId: string;
}

export function TelemetryLogger({ crewId }: LoggerProps) {
  const provider = useProvider();
  const viewMode = useAppStore((s) => s.viewMode);
  const [form, setForm] = useState<Record<string, string>>({
    heart_rate_bpm: "72",
    spo2_percent: "98.5",
    core_temp_c: "37.0",
    systolic_bp_mmhg: "120",
    suit_pressure_kpa: "",
    radiation_msv_hr: "",
  });
  const [symptoms, setSymptoms] = useState("");
  const [glucose, setGlucose] = useState("95");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TriageAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logKind, setLogKind] = useState<BehaviorLog["kind"]>("sleep");
  const [logValue, setLogValue] = useState("");
  const [logAcks, setLogAcks] = useState<string[]>([]);

  const num = (k: string) => {
    const v = Number(form[k]);
    return form[k].trim() === "" || !Number.isFinite(v) ? undefined : v;
  };

  const submit = async () => {
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
    };
    const sys = num("systolic_bp_mmhg");
    if (sys != null) vitals.systolic_bp_mmhg = sys;
    const suit = num("suit_pressure_kpa");
    if (suit != null) vitals.suit_pressure_kpa = suit;
    const rad = num("radiation_msv_hr");
    if (rad != null) vitals.radiation_msv_hr = rad;
    const sy = symptoms.split(",").map((s) => s.trim()).filter(Boolean);
    if (sy.length) vitals.symptoms = sy;

    setSubmitting(true);
    setError(null);
    try {
      setResult(await provider.submitTelemetry(crewId, vitals));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed.");
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  const submitLog = async () => {
    if (!provider || !logValue.trim()) return;
    const ack = await provider.submitLog(crewId, {
      kind: logKind,
      value: logValue.trim(),
    });
    setLogAcks((a) => [`${ack.kind} logged · ${new Date(ack.receivedAt).toLocaleTimeString()}`, ...a].slice(0, 5));
    setLogValue("");
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 14,
      }}
    >
      {/* vitals entry */}
      <div className="panel panel-pad">
        <Eyebrow>Vitals ingest / manual entry</Eyebrow>
        <div style={{ marginTop: 10 }}>
          {VITAL_ROWS.map((row) => (
            <div className="form-row" key={row.key}>
              <label htmlFor={`in-${row.key}`}>
                {row.label}
                {row.optional && (
                  <span className="micro-8" style={{ marginLeft: 6 }}>
                    opt
                  </span>
                )}
              </label>
              <input
                id={`in-${row.key}`}
                type="number"
                step="any"
                value={form[row.key]}
                aria-required={row.required}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [row.key]: e.target.value }))
                }
              />
              <span className="unit">{row.unit}</span>
            </div>
          ))}
          <div className="form-row">
            <label htmlFor="in-glucose">Glucose</label>
            <input
              id="in-glucose"
              type="number"
              step="any"
              value={glucose}
              onChange={(e) => setGlucose(e.target.value)}
            />
            <span className="unit">mg/dL</span>
          </div>
          <div className="form-row" style={{ gridTemplateColumns: "1fr" }}>
            <label htmlFor="in-symptoms">Symptoms (comma-separated)</label>
            <input
              id="in-symptoms"
              type="text"
              value={symptoms}
              placeholder="headache, dizziness…"
              onChange={(e) => setSymptoms(e.target.value)}
              style={{ gridColumn: "1 / -1" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={submitting || !provider}
          >
            <SendHorizontal size={11} />
            {submitting ? "Submitting…" : "Submit snapshot"}
          </button>
          <span className="micro-8">→ triage engine</span>
        </div>

        {error && (
          <p className="micro" role="alert" style={{ marginTop: 12, color: "var(--status-critical)" }}>
            {error}
          </p>
        )}

        {result && (
          <div className="callout" style={{ marginTop: 14 }} role="status">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <StatusChip level={result.triage_level} />
              <span className="micro-8">
                {new Date(result.evaluated_at).toLocaleTimeString()}
              </span>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
              {result.summary}
            </p>
            {result.anomaly_flags.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 10, color: "var(--status-critical)" }}>
                {result.anomaly_flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            {viewMode === "technical" && result.recommended_actions.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 10, color: "var(--muted)" }}>
                {result.recommended_actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* behavioral logs + media placeholder */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="panel panel-pad">
          <Eyebrow>Behavioral log</Eyebrow>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <select
              className="ctx-select"
              aria-label="Log kind"
              value={logKind}
              onChange={(e) => setLogKind(e.target.value as BehaviorLog["kind"])}
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
            <button className="btn" onClick={submitLog} disabled={!logValue.trim()}>
              Log
            </button>
          </div>
          {logAcks.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {logAcks.map((a) => (
                <div key={a} className="micro-8" style={{ padding: "3px 0", color: "var(--status-nominal)" }}>
                  ✓ {a}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel panel-pad">
          <Eyebrow>Media ingest / suit cam</Eyebrow>
          <div
            className="crosshair"
            style={{
              marginTop: 10,
              border: "1px dashed var(--line)",
              borderRadius: 4,
              padding: "26px 16px",
              textAlign: "center",
              color: "var(--dim)",
            }}
          >
            <Camera size={16} style={{ marginBottom: 8 }} />
            <p className="micro-8">
              SKIN / OCULAR SCAN UPLOAD — PLACEHOLDER
              <br />
              awaiting media pipeline contract
            </p>
            <input type="file" disabled aria-label="Media upload (unavailable)" style={{ display: "none" }} />
          </div>
          <Disclaimer>
            Simulated ingest — files are not transmitted or stored.
          </Disclaimer>
        </div>
      </div>
    </div>
  );
}
