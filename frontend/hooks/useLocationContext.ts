"use client";

import { useMemo } from "react";

import { getLocationProfile, LOCATION_PROFILES } from "@/data/mission";
import { useAppStore } from "@/stores/app-store";
import type { LocationId, LocationProfile } from "@/types/health";

/**
 * Global mission-location context: profile (comm latency, blackout risk,
 * link mode) + hazard weights, driven by the persisted app-store selection.
 */
export function useLocationContext() {
  const locationId = useAppStore((s) => s.locationId);
  const setLocationId = useAppStore((s) => s.setLocationId);

  const profile: LocationProfile = useMemo(
    () => getLocationProfile(locationId),
    [locationId],
  );

  return {
    locations: LOCATION_PROFILES,
    locationId,
    profile,
    setLocation: (id: LocationId) => setLocationId(id),
  };
}
