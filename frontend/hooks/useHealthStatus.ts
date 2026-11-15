"use client";

import { useCallback, useEffect, useState } from "react";

import { useProvider } from "./useProvider";
import type { HealthResponse } from "@/types/health";

/** Periodic provider health probe for the topbar indicator. */
export function useHealthStatus(intervalMs = 30_000) {
  const provider = useProvider();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ok"; data: HealthResponse; partial: boolean }
    | { status: "error"; error: string }
  >({ status: "loading" });

  const probe = useCallback(async () => {
    if (!provider) return;
    try {
      const data = await provider.checkHealth();
      setState({
        status: "ok",
        data,
        partial: "partial" in provider && provider.partial === true,
      });
    } catch (e) {
      setState({
        status: "error",
        error: e instanceof Error ? e.message : "unreachable",
      });
    }
  }, [provider]);

  useEffect(() => {
    // Defer so the probe (and its setState) runs outside the effect body.
    queueMicrotask(() => void probe());
    const t = setInterval(() => void probe(), intervalMs);
    return () => clearInterval(t);
  }, [probe, intervalMs]);

  return { state, retry: () => void probe(), providerKind: provider?.kind };
}
