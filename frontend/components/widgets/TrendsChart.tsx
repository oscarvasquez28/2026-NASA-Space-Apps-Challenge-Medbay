"use client";

/**
 * TrendsChart — Recharts time-series with mission-event overlays and an
 * optional predicted-trend mode (dashed forecast + band-crossing warning).
 * Data contract comes from the provider: points, forecast, events, band.
 */

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Eyebrow } from "@/components/ui/primitives";
import type { TelemetrySeries, ViewMode } from "@/types/health";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

interface TrendsChartProps {
  series: TelemetrySeries;
  viewMode: ViewMode;
  height?: number;
}

export function TrendsChart({ series, viewMode, height = 260 }: TrendsChartProps) {
  const [showForecast, setShowForecast] = useState(true);

  const technical = viewMode === "technical";
  const data = useMemo<{ t: string; value?: number; forecast?: number }[]>(() => {
    const base = series.points.map((p) => ({ t: p.t, value: p.value }));
    if (!showForecast) return base;
    return [
      ...base,
      ...series.forecast.map((p) => ({ t: p.t, forecast: p.value })),
    ];
  }, [series, showForecast]);

  const bandBreach = useMemo(() => {
    if (!series.band || !showForecast) return null;
    const over = series.forecast.find(
      (p) => p.value > series.band!.high || p.value < series.band!.low,
    );
    return over ?? null;
  }, [series, showForecast]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Eyebrow>
          {series.label} · {series.unit}
        </Eyebrow>
        <span style={{ flex: 1 }} />
        <button
          className="ctx-select"
          aria-pressed={showForecast}
          onClick={() => setShowForecast((f) => !f)}
        >
          {showForecast ? "FORECAST ON" : "FORECAST OFF"}
        </button>
      </div>

      <div style={{ height, marginTop: 12 }} role="img" aria-label={`${series.label} trend chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={fmtTime}
              stroke="var(--dim)"
              tick={{ fontSize: 8, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              interval={7}
            />
            <YAxis
              stroke="var(--dim)"
              tick={{ fontSize: 8, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              width={44}
            />
            <Tooltip
              contentStyle={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 4,
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              labelFormatter={(v) => new Date(String(v)).toLocaleString()}
              formatter={(v) => [`${String(v)} ${series.unit}`, series.label]}
            />
            {series.band && (
              <ReferenceArea
                y1={series.band.low}
                y2={series.band.high}
                fill="var(--accent)"
                fillOpacity={0.05}
                stroke="none"
              />
            )}
            {data.length > 0 &&
              series.events.map((ev) => {
                const nearest = data.reduce((best, d) =>
                  Math.abs(new Date(d.t).getTime() - new Date(ev.t).getTime()) <
                  Math.abs(new Date(best.t).getTime() - new Date(ev.t).getTime())
                    ? d
                    : best,
                );
                return (
                  <ReferenceDot
                    key={ev.label}
                    x={nearest.t}
                    y={nearest.value ?? nearest.forecast ?? 0}
                    r={3.5}
                    fill="var(--accent)"
                    fillOpacity={0.9}
                    stroke="none"
                  />
                );
              })}
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--accent)"
              strokeWidth={1.6}
              dot={false}
              connectNulls
            />
            {showForecast && (
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="var(--accent)"
                strokeWidth={1.2}
                strokeDasharray="4 4"
                strokeOpacity={0.55}
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* event legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 14px",
          marginTop: 10,
        }}
      >
        {series.events.map((ev) => (
          <span key={ev.label} className="micro-8">
            <span style={{ color: "var(--accent)" }}>●</span> {ev.label}
            {technical && ` · ${fmtTime(ev.t)}`}
          </span>
        ))}
      </div>

      {bandBreach && series.band && (
        <p
          className="micro"
          role="alert"
          style={{ marginTop: 10, color: "var(--status-urgent)" }}
        >
          ▸ FORECAST CROSSES REFERENCE BAND NEAR {fmtTime(bandBreach.t)} (
          {bandBreach.value} {series.unit} vs band {series.band.low}–
          {series.band.high})
        </p>
      )}
    </div>
  );
}
