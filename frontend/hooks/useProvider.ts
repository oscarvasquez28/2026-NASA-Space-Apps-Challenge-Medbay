"use client";

import { useEffect, useState } from "react";

import { getProvider } from "@/services/provider";
import type { HealthDataProvider } from "@/services/health-provider";

/** Resolved HealthDataProvider (mock by default, rest via env config). */
export function useProvider(): HealthDataProvider | null {
  const [provider, setProvider] = useState<HealthDataProvider | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getProvider().then((p) => {
      if (!cancelled) setProvider(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return provider;
}
