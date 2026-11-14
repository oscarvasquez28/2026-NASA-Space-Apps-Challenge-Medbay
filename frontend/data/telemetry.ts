/**
 * Deterministic telemetry series generator for the mock provider.
 * Seeded random walk per (crew, metric) — same inputs, same curves.
 */

import { missionEvents } from "./mission";
import type {
  TelemetryMetric,
  TelemetryPoint,
  TelemetrySeries,
} from "@/types/health";

function seedFrom(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface MetricSpec {
  label: string;
  unit: string;
  base: number;
  drift: number;
  jitter: number;
  decimals: number;
  band?: { low: number; high: number; label: string };
}

const METRIC_SPECS: Record<TelemetryMetric, MetricSpec> = {
  heart_rate: {
    label: "Heart rate",
    unit: "bpm",
    base: 68,
    drift: 0.04,
    jitter: 4.5,
    decimals: 0,
    band: { low: 50, high: 120, label: "ENGINE REFERENCE BAND" },
  },
  spo2: {
    label: "SpO2",
    unit: "%",
    base: 98,
    drift: -0.005,
    jitter: 0.7,
    decimals: 1,
    band: { low: 94, high: 100, label: "ENGINE REFERENCE BAND" },
  },
  core_temp: {
    label: "Core temperature",
    unit: "°C",
    base: 36.9,
    drift: 0.002,
    jitter: 0.18,
    decimals: 2,
    band: { low: 35.8, high: 38, label: "ENGINE REFERENCE BAND" },
  },
  exertion: {
    label: "Cardiovascular exertion",
    unit: "idx",
    base: 42,
    drift: 0.09,
    jitter: 9,
    decimals: 0,
    band: { low: 0, high: 75, label: "ENGINE REFERENCE BAND" },
  },
  radiation: {
    label: "Radiation dose rate",
    unit: "mSv/h",
    base: 0.02,
    drift: 0.0006,
    jitter: 0.012,
    decimals: 3,
    band: { low: 0, high: 0.08, label: "ENGINE REFERENCE BAND" },
  },
  fatigue: {
    label: "Fatigue index",
    unit: "idx",
    base: 30,
    drift: 0.12,
    jitter: 6,
    decimals: 0,
    band: { low: 0, high: 70, label: "ENGINE REFERENCE BAND" },
  },
};

export function buildTelemetrySeries(
  crewId: string,
  metric: TelemetryMetric,
  now = new Date(),
): TelemetrySeries {
  const spec = METRIC_SPECS[metric];
  const rand = mulberry32(seedFrom(`${crewId}:${metric}`));
  const stepMs = 30 * 60_000; // 30 min per sample, 48 samples ≈ 24 h

  const points: TelemetryPoint[] = [];
  let value = spec.base;
  for (let i = 47; i >= 0; i--) {
    value += spec.drift + (rand() - 0.5) * 2 * spec.jitter * 0.28;
    // EVA window bump for exertion/heart rate; radiation belt pass for dose.
    const t = new Date(now.getTime() - i * stepMs);
    const hoursAgo = (now.getTime() - t.getTime()) / 3_600_000;
    if (hoursAgo > 11 && hoursAgo < 14 && metric !== "radiation") {
      value += spec.jitter * 0.35;
    }
    if (hoursAgo > 10.5 && hoursAgo < 12.5 && metric === "radiation") {
      value += 0.06;
    }
    points.push({ t: t.toISOString(), value: round(value, spec.decimals) });
  }

  // Forecast: damped continuation of the last drift direction.
  const forecast: TelemetryPoint[] = [];
  const last = points[points.length - 1].value;
  const trend =
    (points[points.length - 1].value - points[points.length - 9].value) / 8;
  for (let i = 1; i <= 12; i++) {
    forecast.push({
      t: new Date(now.getTime() + i * stepMs).toISOString(),
      value: round(last + trend * i * 0.9, spec.decimals),
    });
  }

  return {
    metric,
    label: spec.label,
    unit: spec.unit,
    points,
    forecast,
    events: missionEvents(now),
    band: spec.band,
  };
}

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
