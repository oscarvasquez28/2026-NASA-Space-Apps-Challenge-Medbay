"use client";

/**
 * /telemetry — trends dashboard (module F).
 * Overlay modes tint a mini 3D model; Recharts renders the selected metric
 * series with mission-event markers + predicted-trend mode. Both view modes
 * (high-level vs technical) re-render differently.
 */

import { useState } from "react";

import { Eyebrow, Disclaimer } from "@/components/ui/primitives";
import { ModelViewport } from "@/components/three/model-viewport";
import { TrendsChart } from "@/components/widgets/TrendsChart";
import { useBodyStatus } from "@/hooks/useBodyStatus";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useAppStore } from "@/stores/app-store";
import {
  useViewerStore,
  ViewerProvider,
  type OverlayMode,
} from "@/stores/viewer-store";
import type { BodyZone, TelemetryMetric } from "@/types/health";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const METRICS: { id: TelemetryMetric; label: string }[] = [
  { id: "heart_rate", label: "Heart rate" },
  { id: "spo2", label: "SpO2" },
  { id: "blood_sugar", label: "Blood glucose" },
  { id: "bone_density", label: "Bone density (BMD)" },
  { id: "visual_acuity", label: "Visual acuity (SANS)" },
  { id: "core_temp", label: "Core temp" },
  { id: "radiation", label: "Radiation dose" },
  { id: "mission_readiness", label: "Mission readiness" },
  { id: "exertion", label: "Exertion (sim)" },
  { id: "fatigue", label: "Fatigue (sim)" },
];

const OVERLAYS: { id: OverlayMode; label: string }[] = [
  { id: "none", label: "STATUS" },
  { id: "thermal", label: "THERMAL" },
  { id: "exertion", label: "EXERTION" },
  { id: "fatigue", label: "FATIGUE" },
  { id: "radiation", label: "RADIATION" },
];

function TelemetryInner() {
  const params = useSearchParams();
  const { activeUser } = useCheckIn();
  const crewId = params.get("crew") ?? activeUser?.astronautId ?? "";
  const viewMode = useAppStore((s) => s.viewMode);
  const technical = viewMode === "technical";
  const [metric, setMetric] = useState<TelemetryMetric>("heart_rate");
  const overlay = useViewerStore((s) => s.overlay);
  const setOverlay = useViewerStore((s) => s.setOverlay);

  const { member } = useBodyStatus(crewId);
  const { series, loading, error } = useTelemetry(crewId, metric);

  const latest = series?.points[series.points.length - 1];

  return (
    <div style={{ padding: "22px 26px" }}>
      {/* mode bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Eyebrow>Analysis / conceptual overlays</Eyebrow>
        <div className="view-toggle" role="group" aria-label="Overlay mode">
          {OVERLAYS.map((o) => (
            <button
              key={o.id}
              aria-pressed={overlay === o.id}
              onClick={() => setOverlay(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="micro-8" style={{ marginLeft: "auto" }}>
          {series?.indicator ? `TREND ENGINE · ${series.indicator}` : "TELEMETRY & 95% CI FORECAST"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 380px) 1fr",
          gap: 14,
          marginTop: 16,
        }}
      >
        {/* model panel */}
        <div className="panel" style={{ position: "relative", minHeight: 380 }}>
          {member ? (
            <ModelViewport zones={member.zones}>
              <div className="viewer-scene-meta">
                {overlay === "none" ? "STATUS TINT" : `${overlay.toUpperCase()} OVERLAY`}
              </div>
              <div className="viewer-bottom-left">drag to orbit</div>
            </ModelViewport>
          ) : (
            <div className="fallback-figure mono" role="status">
              LINKING SUBJECT…
            </div>
          )}
        </div>

        {/* metric panel */}
        <div className="panel panel-pad">
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <Eyebrow>Subject {crewId}</Eyebrow>
            <span className="micro-8" style={{ marginLeft: "auto" }}>
              LAST SAMPLE {latest ? new Date(latest.t).toLocaleTimeString() : "—"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 14 }}>
            <span style={{ fontSize: 40, fontWeight: 400, letterSpacing: "-1.5px" }}>
              {latest?.value ?? "—"}
            </span>
            <span className="micro">{series?.unit}</span>
          </div>

          {/* metric selector */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
            {METRICS.map((m) => (
              <button
                key={m.id}
                className="camera-preset"
                aria-pressed={metric === m.id}
                onClick={() => setMetric(m.id)}
              >
                {technical ? m.id.toUpperCase() : m.label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* zones focus list */}
          {member && (
            <div style={{ marginTop: 18 }}>
              <Eyebrow>Focus a region</Eyebrow>
              {member.zones
                .filter((z) => z.status !== "NOMINAL")
                .map((z) => (
                  <ZoneFocus key={z.id} zone={z} />
                ))}
              {member.zones.every((z) => z.status === "NOMINAL") && (
                <p className="micro-8" style={{ marginTop: 8 }}>
                  ALL ZONES NOMINAL
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* chart row */}
      <div className="panel panel-pad" style={{ marginTop: 14 }}>
        {loading && (
          <div className="empty-state mono" role="status">SAMPLING SERIES…</div>
        )}
        {error && !loading && (
          <div className="empty-state" role="alert">{error}</div>
        )}
        {series && !loading && (
          <TrendsChart series={series} viewMode={viewMode} height={280} />
        )}
        <div style={{ marginTop: 14 }}>
          <Disclaimer>
            TIME-SERIES HISTORY, MISSION EVENT MARKERS, AND LINEAR FORECASTS
            WITH 95% CONFIDENCE INTERVALS ARE SERVED FROM THE ACTIVE DATA PROVIDER.
          </Disclaimer>
        </div>
      </div>
    </div>
  );
}

function ZoneFocus({ zone }: { zone: BodyZone }) {
  const focus = useViewerStore((s) => s.focus);
  return (
    <button className="zone-list-item" onClick={() => focus(zone)}>
      <span className="zl">{zone.name}</span>
      <span className="micro-8">{zone.status}</span>
    </button>
  );
}

export default function TelemetryPage() {
  return (
    <ViewerProvider>
      <Suspense
        fallback={<div className="empty-state mono">LINKING TELEMETRY…</div>}
      >
        <TelemetryInner />
      </Suspense>
    </ViewerProvider>
  );
}
