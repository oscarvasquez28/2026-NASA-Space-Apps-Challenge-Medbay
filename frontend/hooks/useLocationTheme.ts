"use client";

import { useCallback } from "react";

import { LOCATION_THEME } from "@/data/mission";
import { useAppStore } from "@/stores/app-store";
import type { LocationId } from "@/types/health";

/**
 * MEDBAY location theme (spec §10).
 * - `detected`: location reported by GET /api/v1/context/location.
 * - `chosen`: the user's pick on the location tile (falls back to detected).
 * - `mismatch`: chosen ≠ detected → the tile stroke turns red.
 * Choosing only re-themes the console + 3D environment; posting a new mission
 * context to the backend stays in the technical mission controls.
 */
export function useLocationTheme() {
  const detected = useAppStore((s) => s.locationId);
  const themeLocation = useAppStore((s) => s.themeLocation);
  const setThemeLocation = useAppStore((s) => s.setThemeLocation);

  const chosen: LocationId = themeLocation ?? detected;
  const choose = useCallback(
    (id: LocationId) => setThemeLocation(id === detected ? null : id),
    [detected, setThemeLocation],
  );

  return {
    detected,
    chosen,
    mismatch: chosen !== detected,
    theme: LOCATION_THEME[chosen],
    choose,
    followDetected: () => setThemeLocation(null),
  };
}
