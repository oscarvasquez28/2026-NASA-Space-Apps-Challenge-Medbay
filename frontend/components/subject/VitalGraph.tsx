"use client";

/**
 * MEDBAY vital graph — globe = historical graph, eye = predicted evolution
 * (spec §6). Data: provider telemetry series (GET /api/v1/trends/*) with the
 * backend forecast + confidence band.
 */

import { useMemo } from "react";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useTelemetry } from "@/hooks/useTelemetry";
import type { TelemetryMetric } from "@/types/health";

export type GraphMode = "history" | "prediction";

const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function VitalGraph({
  crewId,
  metric,
  mode,
  height = "100%",
}: {
  crewId: string | undefined;
  metric?: TelemetryMetric;
  mode: GraphMode;
  height?: number | string;
}) {
  const { series, loading, error } = useTelemetry(metric ? crewId : undefined, metric ?? "heart_rate");

  type Row = { t: string; value?: number; forecast?: number; band?: [number, number] };
  const data = useMemo<Row[]>(() => {
    if (!series) return [];
    if (mode === "history") return series.points.map((p) => ({ t: p.t, value: p.value }));
    const rows: Row[] = series.points.slice(-8).map((p) => ({ t: p.t, value: p.value }));
    const last = rows[rows.length - 1];
    if (last?.value !== undefined) {
      last.forecast = last.value;
      last.band = [last.value, last.value];
    }
    for (const p of series.forecast) {
      rows.push({ t: p.t, forecast: p.value, band: [p.lowerCi ?? p.value, p.upperCi ?? p.value] });
    }
    return rows;
  }, [series, mode]);

  const label = mode === "history" ? "Historical graph" : "Prediction graph";

  if (!metric) {
    return <Placeholder text="No graph feed for this vital yet" />;
  }
  if (loading && !series) return <Placeholder text={`Loading ${label.toLowerCase()}…`} />;
  if (error || data.length === 0) return <Placeholder text={error ?? "No readings yet"} />;

  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`${series?.label} ${label}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
          <XAxis dataKey="t" tickFormatter={fmt} tick={{ fill: "#a3a3ad", fontSize: 9 }} stroke="#ffffff22" minTickGap={40} />
          <YAxis tick={{ fill: "#a3a3ad", fontSize: 9 }} stroke="#ffffff22" domain={["auto", "auto"]} width={46} />
          <Tooltip
            contentStyle={{ background: "#000", border: "1px solid var(--state)", fontSize: 11 }}
            labelFormatter={(v) => fmt(String(v))}
          />
          {mode === "prediction" && (
            <Area dataKey="band" stroke="none" fill="var(--state)" fillOpacity={0.18} isAnimationActive={false} />
          )}
          <Line dataKey="value" stroke="#fff" strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls />
          {mode === "prediction" && (
            <Line
              dataKey="forecast"
              stroke="var(--state)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="grid size-full min-h-24 place-items-center border border-dashed border-input">
      <span className="medbay-micro text-center text-foreground/60">{text}</span>
    </div>
  );
}
