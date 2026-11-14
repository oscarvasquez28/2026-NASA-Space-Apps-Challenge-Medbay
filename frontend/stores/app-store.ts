"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_LOCATION } from "@/data/mission";
import type { LocationId, ViewMode, ZoneId } from "@/types/health";

export type Quality = "high" | "balanced";

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

  /* ephemeral ui state */
  hydrated: boolean;
  commandOpen: boolean;
  chatOpen: boolean;
  chatContextZoneId: ZoneId | null;
  booted: boolean;

  setViewMode: (m: ViewMode) => void;
  setLocationId: (id: LocationId) => void;
  setQuality: (q: Quality) => void;
  setReduceMotion: (v: boolean) => void;
  setAutoRotate: (v: boolean) => void;
  toggleChecklist: (id: string) => void;
  rewardSkin: (id: string) => void;
  bumpStreak: () => void;
  setCommandOpen: (v: boolean) => void;
  openChat: (zoneId?: ZoneId | null) => void;
  closeChat: () => void;
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
      ownedSkinIds: ["skin-nominal"],

      hydrated: false,
      commandOpen: false,
      chatOpen: false,
      chatContextZoneId: null,
      booted: false,

      setViewMode: (viewMode) => set({ viewMode }),
      setLocationId: (locationId) => set({ locationId }),
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
      }),
    },
  ),
);

/** Call once on mount (app shell) to rehydrate persisted prefs. */
export function hydrateAppStore() {
  void useAppStore.persist.rehydrate().then(() => {
    useAppStore.getState().setHydrated();
  });
}

export function appStore() {
  return useAppStore.getState();
}
