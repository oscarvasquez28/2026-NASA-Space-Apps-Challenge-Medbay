"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useProvider } from "./useProvider";
import { SIM_TICK_EVENT, SIM_TICK_MS, simIngestPayload } from "@/services/sim-progress";
import type { BodyZone, CrewMember } from "@/types/health";

interface SimState {
  running: boolean;
  /** Real telemetry rows written via /telemetry/ingest since START. */
  inserts: number;
}

interface BodyStatus {
  member: CrewMember | null;
  zones: BodyZone[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  sim: SimState;
  toggleSim: () => void;
}

/** Crew member + per-zone triage status for the anatomical explorer. */
export function useBodyStatus(crewId: string | undefined): BodyStatus {
  const provider = useProvider();
  const [state, setState] = useState<Omit<BodyStatus, "refresh" | "sim" | "toggleSim">>({
    member: null,
    zones: [],
    loading: true,
    error: null,
  });
  const seq = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      if (!provider || !crewId) return;
      const mySeq = ++seq.current;
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const member = await provider.getCrewMember(crewId);
        if (mySeq !== seq.current) return;
        setState({
          member: member ?? null,
          zones: member?.zones ?? [],
          loading: false,
          error: member ? null : `Crew member ${crewId} not found.`,
        });
      } catch (e) {
        if (mySeq !== seq.current) return;
        setState((s) => ({
          member: silent ? s.member : null,
          zones: silent ? s.zones : [],
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load crew status.",
        }));
      }
    },
    [provider, crewId],
  );

  useEffect(() => {
    // Defer so the fetch (and its setState) runs outside the effect body.
    queueMicrotask(() => void load());
  }, [load]);

  // Mock provider drives the demo health arc — silently re-pull every tick so
  // vitals/zone statuses visibly deteriorate and recover. REST stays static.
  useEffect(() => {
    if (provider?.kind !== "mock" || !crewId) return;
    const timer = setInterval(() => void load(true), SIM_TICK_MS);
    return () => clearInterval(timer);
  }, [provider, crewId, load]);

  /*
   * REST demo scenario player — START writes one real telemetry row per tick
   * (values sampled from data/sim-progress.json) via POST /telemetry/ingest,
   * then silently refreshes body-status and pings every telemetry hook so
   * tiles, zones and trend graphs visibly evolve. Simulated data — the feed
   * label switches to SIM FEED while running.
   */
  const [sim, setSim] = useState<SimState>({ running: false, inserts: 0 });
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const simStartAt = useRef(0);

  const stopSim = useCallback(() => {
    if (simTimer.current) clearInterval(simTimer.current);
    simTimer.current = null;
    setSim((s) => (s.running ? { ...s, running: false } : s));
  }, []);

  const startSim = useCallback(() => {
    if (!provider || !crewId || simTimer.current) return;
    simStartAt.current = Date.now();
    setSim({ running: true, inserts: 0 });
    const tick = async () => {
      const phase = (Date.now() - simStartAt.current) / SIM_TICK_MS;
      try {
        await provider.ingestTelemetry(simIngestPayload(crewId, phase));
        setSim((s) => ({ running: true, inserts: s.inserts + 1 }));
        window.dispatchEvent(new Event(SIM_TICK_EVENT));
        void load(true);
      } catch {
        // keep the player alive — a transient ingest failure shouldn't kill the demo
      }
    };
    void tick();
    simTimer.current = setInterval(() => void tick(), SIM_TICK_MS);
  }, [provider, crewId, load]);

  const toggleSim = useCallback(() => {
    if (simTimer.current) stopSim();
    else startSim();
  }, [startSim, stopSim]);

  // Player dies with the hook/provider swap.
  useEffect(() => () => stopSim(), [provider, crewId, stopSim]);

  return { ...state, refresh: () => void load(), sim, toggleSim };
}
