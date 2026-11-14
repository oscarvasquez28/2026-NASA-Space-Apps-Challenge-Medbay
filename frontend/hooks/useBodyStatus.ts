"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useProvider } from "./useProvider";
import type { BodyZone, CrewMember } from "@/types/health";

interface BodyStatus {
  member: CrewMember | null;
  zones: BodyZone[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Crew member + per-zone triage status for the anatomical explorer. */
export function useBodyStatus(crewId: string | undefined): BodyStatus {
  const provider = useProvider();
  const [state, setState] = useState<Omit<BodyStatus, "refresh">>({
    member: null,
    zones: [],
    loading: true,
    error: null,
  });
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!provider || !crewId) return;
    const mySeq = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
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
      setState({
        member: null,
        zones: [],
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load crew status.",
      });
    }
  }, [provider, crewId]);

  useEffect(() => {
    // Defer so the fetch (and its setState) runs outside the effect body.
    queueMicrotask(() => void load());
  }, [load]);

  return { ...state, refresh: () => void load() };
}
