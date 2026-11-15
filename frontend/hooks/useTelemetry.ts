"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useProvider } from "./useProvider";
import { SIM_TICK_EVENT } from "@/services/sim-progress";
import type { TelemetryMetric, TelemetrySeries } from "@/types/health";

/** Time-series for one metric (with events + forecast) from the provider. */
export function useTelemetry(crewId: string | undefined, metric: TelemetryMetric) {
  const provider = useProvider();
  const [series, setSeries] = useState<TelemetrySeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!provider || !crewId) return;
    const mySeq = ++seq.current;
    setLoading(true);
    try {
      const s = await provider.getTelemetrySeries(crewId, metric);
      if (mySeq === seq.current) {
        setSeries(s);
        setError(null);
        setLoading(false);
      }
    } catch (e) {
      if (mySeq === seq.current) {
        setError(e instanceof Error ? e.message : "Telemetry load failed.");
        setLoading(false);
      }
    }
  }, [provider, crewId, metric]);

  useEffect(() => {
    // Defer so the fetch (and its setState) runs outside the effect body.
    queueMicrotask(() => void load());
  }, [load]);

  // The demo scenario player pings after each scripted ingest — refetch so the
  // graph visibly grows point-by-point while it runs.
  useEffect(() => {
    const onTick = () => void load();
    window.addEventListener(SIM_TICK_EVENT, onTick);
    return () => window.removeEventListener(SIM_TICK_EVENT, onTick);
  }, [load]);

  return { series, loading, error, refresh: () => void load() };
}
