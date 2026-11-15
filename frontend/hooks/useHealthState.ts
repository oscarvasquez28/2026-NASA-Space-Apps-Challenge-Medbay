"use client";

import { useEffect, useMemo } from "react";

import { useAppStore, type HealthState } from "@/stores/app-store";
import type { BodyZone, TriageLevel } from "@/types/health";

const RANK: Record<TriageLevel, number> = {
  NOMINAL: 0,
  CAUTION: 1,
  URGENT: 2,
  CRITICAL: 3,
};

/** Map a triage level onto the MEDBAY three-state model (spec §1). */
export function healthFromLevel(level: TriageLevel | undefined): HealthState {
  if (level === "CRITICAL") return "critical";
  if (level === "CAUTION" || level === "URGENT") return "risk";
  return "healthy";
}

export function worstZone(zones: BodyZone[]): BodyZone | undefined {
  return [...zones].sort((a, b) => (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0))[0];
}

export function healthOfZones(zones: BodyZone[]): HealthState {
  return healthFromLevel(worstZone(zones)?.status);
}

export const HEALTH_LABEL: Record<HealthState, string> = {
  healthy: "HEALTHY",
  risk: "RISKY",
  critical: "CRITICAL",
};

/**
 * Derive the subject's health state and publish it to the shell so the
 * `data-health` accent layer follows the subject being viewed.
 */
export function useSubjectHealth(zones: BodyZone[] | undefined): HealthState {
  const setSubjectHealth = useAppStore((s) => s.setSubjectHealth);
  const health = useMemo(() => (zones ? healthOfZones(zones) : "healthy"), [zones]);
  useEffect(() => {
    setSubjectHealth(health);
    return () => setSubjectHealth("healthy");
  }, [health, setSubjectHealth]);
  return health;
}
