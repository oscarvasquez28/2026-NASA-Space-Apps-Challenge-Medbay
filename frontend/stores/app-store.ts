"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_LOCATION, LOCATION_IDS } from "@/data/mission";
import type { LocationId, LocationProfile, ViewMode, ZoneId } from "@/types/health";

export type Quality = "high" | "balanced";

/** MEDBAY subject health state — drives accents via `data-health`. */
export type HealthState = "healthy" | "risk" | "critical";

interface AppState {
  /* persisted preferences */
  viewMode: ViewMode;
  locationId: LocationId;
  quality: Quality;
  reduceMotion: boolean;
  autoRotate: boolean;
  streakDays: number;
  checklistDay: string;
  checklistDone: string[];
  ownedSkinIds: string[];
  /** Location the user picked on the tile; null = follow the detected one. */
  themeLocation: LocationId | null;
  /** Visual AI toggles (spec §7): force local fallback LLM, speak replies. */
  forceOffline: boolean;
  ttsEnabled: boolean;

  /* ephemeral ui state */
  subjectHealth: HealthState;
  /** Wheel cadence from runtime-config (WHEEL_CADENCE_DAYS); 7 until resolved. */
  wheelCadenceDays: number;
  hydrated: boolean;
  commandOpen: boolean;
  chatOpen: boolean;
  chatContextZoneId: ZoneId | null;
  booted: boolean;
  liveLocationProfile: LocationProfile | null;
  locationSynced: boolean;

  setViewMode: (m: ViewMode) => void;
  setThemeLocation: (id: LocationId | null) => void;
  setForceOffline: (v: boolean) => void;
  setTtsEnabled: (v: boolean) => void;
  setSubjectHealth: (h: HealthState) => void;
  setLocationId: (id: LocationId) => void;
  setLiveLocationProfile: (p: LocationProfile | null) => void;
  setLocationSynced: (v: boolean) => void;
  setQuality: (q: Quality) => void;
  setReduceMotion: (v: boolean) => void;
  setAutoRotate: (v: boolean) => void;
  toggleChecklist: (id: string) => void;
  rewardSkin: (id: string) => void;
  bumpStreak: () => void;
  setCommandOpen: (v: boolean) => void;
  openChat: (zoneId?: ZoneId | null) => void;
  closeChat: () => void;
  setWheelCadenceDays: (n: number) => void;
  setHydrated: () => void;
  setBooted: () => void;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      viewMode: "high_level",
      locationId: DEFAULT_LOCATION,
      quality: "high",
      reduceMotion: false,
      autoRotate: true,
      streakDays: 0,
      checklistDay: todayKey(),
      checklistDone: [],
      ownedSkinIds: ["skin_standard_suit"],
      themeLocation: null,
      forceOffline: false,
      ttsEnabled: false,

      subjectHealth: "healthy",
      wheelCadenceDays: 7,
      hydrated: false,
      commandOpen: false,
      chatOpen: false,
      chatContextZoneId: null,
      booted: false,
      liveLocationProfile: null,
      locationSynced: false,

      setViewMode: (viewMode) => set({ viewMode }),
      setThemeLocation: (themeLocation) => set({ themeLocation }),
      setForceOffline: (forceOffline) => set({ forceOffline }),
      setTtsEnabled: (ttsEnabled) => set({ ttsEnabled }),
      setSubjectHealth: (subjectHealth) => set({ subjectHealth }),
      setLocationId: (locationId) => set({ locationId }),
      setLiveLocationProfile: (liveLocationProfile) => set({ liveLocationProfile }),
      setLocationSynced: (locationSynced) => set({ locationSynced }),
      setQuality: (quality) => set({ quality }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setAutoRotate: (autoRotate) => set({ autoRotate }),

      toggleChecklist: (id) =>
        set((s) => {
          const day = todayKey();
          const done = s.checklistDay === day ? s.checklistDone : [];
          return {
            checklistDay: day,
            checklistDone: done.includes(id)
              ? done.filter((d) => d !== id)
              : [...done, id],
          };
        }),
      rewardSkin: (id) =>
        set((s) => ({
          ownedSkinIds: s.ownedSkinIds.includes(id)
            ? s.ownedSkinIds
            : [...s.ownedSkinIds, id],
        })),
      bumpStreak: () => set((s) => ({ streakDays: s.streakDays + 1 })),

      setCommandOpen: (commandOpen) => set({ commandOpen }),
      openChat: (zoneId = null) =>
        set({ chatOpen: true, chatContextZoneId: zoneId }),
      closeChat: () => set({ chatOpen: false, chatContextZoneId: null }),
      setWheelCadenceDays: (n) =>
        set({ wheelCadenceDays: Number.isFinite(n) && n >= 1 ? Math.floor(n) : 7 }),
      setHydrated: () => set({ hydrated: true }),
      setBooted: () => set({ booted: true }),
    }),
    {
      name: "astro-lab:prefs",
      skipHydration: true,
      partialize: (s) => ({
        viewMode: s.viewMode,
        locationId: s.locationId,
        quality: s.quality,
        reduceMotion: s.reduceMotion,
        autoRotate: s.autoRotate,
        streakDays: s.streakDays,
        checklistDay: s.checklistDay,
        checklistDone: s.checklistDone,
        ownedSkinIds: s.ownedSkinIds,
        themeLocation: s.themeLocation,
        forceOffline: s.forceOffline,
        ttsEnabled: s.ttsEnabled,
      }),
      // Legacy prefs may hold the retired "moon"/"eva" locations.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        const valid = (id: unknown): id is LocationId =>
          LOCATION_IDS.includes(id as LocationId);
        return {
          ...current,
          ...p,
          locationId: valid(p.locationId) ? p.locationId : DEFAULT_LOCATION,
          themeLocation: valid(p.themeLocation) ? p.themeLocation : null,
        };
      },
    },
  ),
);

/** Call once on mount (app shell) to rehydrate persisted prefs. */
export function hydrateAppStore() {
  void useAppStore.persist.rehydrate().then(() => {
    useAppStore.getState().setHydrated();
  });
  // Runtime wheel cadence (WHEEL_CADENCE_DAYS) — keeps client spin math in
  // sync with the backend without a rebuild.
  void import("@/lib/config").then(({ getRuntimeConfig }) =>
    getRuntimeConfig().then((c) =>
      useAppStore.getState().setWheelCadenceDays(c.wheelCadenceDays),
    ),
  );
}

export function appStore() {
  return useAppStore.getState();
}
