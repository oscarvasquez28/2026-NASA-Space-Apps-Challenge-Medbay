"use client";

import { useEffect, useState } from "react";

import { useProvider } from "./useProvider";
import type { CrewMember } from "@/types/health";

/** Full crew roster for the /crew explorer page. */
export function useCrew() {
  const provider = useProvider();
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!provider) return;
    let cancelled = false;
    provider
      .getCrew()
      .then((list) => {
        if (!cancelled) {
          setCrew(list);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  return { crew, loading, error };
}
