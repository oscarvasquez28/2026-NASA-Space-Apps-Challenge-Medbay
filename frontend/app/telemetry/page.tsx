"use client";

/**
 * /telemetry — trends dashboard (module F).
 * Overlay modes tint a mini 3D model; Recharts renders the selected metric
 * series with mission-event markers + predicted-trend mode. Both view modes
 * (high-level vs technical) re-render differently.
 */

import { useState } from "react";

import { cn } from "@/lib/utils";
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
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-5">
      {/* mode bar */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="medbay-display text-xl tracking-widest">Telemetry</h1>
        <div className="flex border border-input" role="group" aria-label="Overlay mode">
          {OVERLAYS.map((o) => (
            <button
              key={o.id}
              className={cn("medbay-micro px-3 py-2", overlay === o.id ? "bg-foreground text-black" : "hover:text-state")}
              aria-pressed={overlay === o.id}
              onClick={() => setOverlay(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="medbay-micro ml-auto text-foreground/60">
          {series?.indicator ? `TREND ENGINE · ${series.indicator}` : "TELEMETRY & 95% CI FORECAST"}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(280px,380px)_1fr] gap-4">
        {/* model panel */}
        <div className="relative min-h-[380px] overflow-hidden border border-input">
          {member ? (
            <ModelViewport zones={member.zones}>
              <div className="medbay-micro absolute left-3 top-3 text-foreground/50">
                {overlay === "none" ? "STATUS TINT" : `${overlay.toUpperCase()} OVERLAY`}
              </div>
              <div className="medbay-micro absolute bottom-2 left-3 text-foreground/50">drag to orbit</div>
            </ModelViewport>
          ) : (
            <div className="medbay-micro grid h-full place-items-center text-foreground/60" role="status">
              Linking subject…
            </div>
          )}
        </div>

        {/* metric panel */}
        <div className="border border-input p-4">
          <div className="flex items-baseline gap-3">
            <span className="medbay-micro text-foreground/60">Subject {crewId}</span>
            <span className="medbay-micro ml-auto text-foreground/60">
              Last sample {latest ? new Date(latest.t).toLocaleTimeString() : "—"}
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="medbay-display text-[40px] leading-none">{latest?.value ?? "—"}</span>
            <span className="medbay-micro">{series?.unit}</span>
          </div>

          {/* metric selector */}
          <div className="mt-4 flex flex-wrap gap-2">
            {METRICS.map((m) => (
              <button
                key={m.id}
                className={cn(
                  "medbay-micro border px-3 py-1.5",
                  metric === m.id ? "border-state text-state" : "border-input hover:border-state",
                )}
                aria-pressed={metric === m.id}
                onClick={() => setMetric(m.id)}
              >
                {technical ? m.id.toUpperCase() : m.label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* zones focus list */}
          {member && (
            <div className="mt-5">
              <div className="medbay-micro text-foreground/60">Focus a region</div>
              {member.zones
                .filter((z) => z.status !== "NOMINAL")
                .map((z) => (
                  <ZoneFocus key={z.id} zone={z} />
                ))}
              {member.zones.every((z) => z.status === "NOMINAL") && (
                <p className="medbay-micro mt-2 text-ok">ALL ZONES NOMINAL</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* chart row */}
      <div className="border border-input p-4">
        {loading && (
          <div className="medbay-micro text-foreground/60" role="status">Sampling series…</div>
        )}
        {error && !loading && (
          <div className="medbay-micro text-risk" role="alert">{error}</div>
        )}
        {series && !loading && (
          <TrendsChart series={series} viewMode={viewMode} height={280} />
        )}
        <p className="medbay-micro mt-3 text-foreground/45">
          TIME-SERIES HISTORY, MISSION EVENT MARKERS, AND LINEAR FORECASTS WITH 95%
          CONFIDENCE INTERVALS ARE SERVED FROM THE ACTIVE DATA PROVIDER.
        </p>
      </div>
    </div>
  );
}

function ZoneFocus({ zone }: { zone: BodyZone }) {
  const focus = useViewerStore((s) => s.focus);
  return (
    <button className="flex w-full items-center gap-3 border-b border-input px-2 py-2 text-left" onClick={() => focus(zone)}>
      <span className="medbay-display flex-1 text-[13px]">{zone.name}</span>
      <span className="medbay-micro">{zone.status}</span>
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
