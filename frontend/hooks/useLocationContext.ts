"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getLocationProfile, LOCATION_PROFILES } from "@/data/mission";
import { useAppStore } from "@/stores/app-store";
import type {
  LocationContextUpdate,
  LocationId,
  LocationProfile,
} from "@/types/health";
import { useProvider } from "./useProvider";

/**
 * Global mission-location context & 5-Hazards state synced with
 * GET/POST /api/v1/context/location.
 */
export function useLocationContext() {
  const provider = useProvider();
  const locationId = useAppStore((s) => s.locationId);
  const setLocationId = useAppStore((s) => s.setLocationId);
  const liveProfile = useAppStore((s) => s.liveLocationProfile);
  const setLiveProfile = useAppStore((s) => s.setLiveLocationProfile);
  const locationSynced = useAppStore((s) => s.locationSynced);
  const setLocationSynced = useAppStore((s) => s.setLocationSynced);

  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!provider) return;
    try {
      const active = await provider.getActiveLocation();
      setLiveProfile(active);
      setLocationId(active.id);
      setLocationSynced(true);
      setError(null);
    } catch (e) {
      setLocationSynced(true);
      setError(e instanceof Error ? e.message : "Failed to fetch location context.");
    }
  }, [provider, setLiveProfile, setLocationId, setLocationSynced]);

  useEffect(() => {
    if (!provider || locationSynced) return;
    let cancelled = false;
    provider.getActiveLocation().then(
      (active) => {
        if (!cancelled) {
          setLiveProfile(active);
          setLocationId(active.id);
          setLocationSynced(true);
          setError(null);
        }
      },
      (e) => {
        if (!cancelled) {
          setLocationSynced(true);
          setError(
            e instanceof Error ? e.message : "Failed to fetch location context.",
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [provider, locationSynced, setError, setLiveProfile, setLocationId, setLocationSynced]);

  const updateLocation = useCallback(
    async (id: LocationId, updates?: Partial<LocationContextUpdate>) => {
      setLocationId(id);
      if (!provider) return;
      setUpdating(true);
      setError(null);
      try {
        const updated = await provider.updateLocationProfile(id, updates);
        setLiveProfile(updated);
        setLocationId(updated.id);
        setLocationSynced(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update location context.");
      } finally {
        setUpdating(false);
      }
    },
    [provider, setLocationId, setLiveProfile, setLocationSynced],
  );

  const setLocation = useCallback(
    (id: LocationId) => {
      void updateLocation(id);
    },
    [updateLocation],
  );

  const profile: LocationProfile = useMemo(() => {
    if (liveProfile && liveProfile.id === locationId) {
      return liveProfile;
    }
    return getLocationProfile(locationId);
  }, [liveProfile, locationId]);

  const locations: LocationProfile[] = useMemo(
    () =>
      LOCATION_PROFILES.map((loc) =>
        liveProfile && liveProfile.id === loc.id ? liveProfile : loc,
      ),
    [liveProfile],
  );

  return {
    locations,
    locationId,
    profile,
    updating,
    error,
    setLocation,
    updateLocation,
    refresh,
  };
}
