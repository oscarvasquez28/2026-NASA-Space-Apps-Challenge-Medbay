"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CheckInRecord, LocalUser, UserRole } from "@/types/health";

/**
 * Local operator profiles + daily check-in (frontend-only persistence —
 * `astro-lab:user` in localStorage). Face photos stay on-device; the visual
 * ID flow is simulated until a real recognition adapter lands.
 */

export const WHEEL_EVERY_N = 5;

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function dayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface UserState {
  users: LocalUser[];
  activeUserId: string | null;
  checkIns: CheckInRecord[];
  /** Prize-drum spins already consumed (earned = floor(checkIns/WHEEL_EVERY_N)). */
  wheelSpinsClaimed: number;

  hydrated: boolean;

  addUser: (
    u: Omit<LocalUser, "id" | "role" | "astronautId" | "createdAt"> & {
      role?: UserRole;
      astronautId?: string;
    },
  ) => LocalUser;
  updateUser: (id: string, patch: Partial<LocalUser>) => void;
  removeUser: (id: string) => void;
  setActiveUser: (id: string | null) => void;
  /** Idempotent — one record per user+day. Returns true when it created a new record. */
  recordCheckIn: (userId: string) => boolean;
  claimWheelSpin: () => void;
  setHydrated: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      users: [],
      activeUserId: null,
      checkIns: [],
      wheelSpinsClaimed: 0,
      hydrated: false,

      addUser: (input) => {
        const users = get().users;
        const user: LocalUser = {
          id: `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          // The first enrolled operator must hold medic clearance.
          role: users.length === 0 ? "medic" : (input.role ?? "user"),
          astronautId:
            input.astronautId?.trim() ||
            `AST-U${String(users.length + 1).padStart(2, "0")}`,
          createdAt: new Date().toISOString(),
          name: input.name,
          callsign: input.callsign,
          facePhoto: input.facePhoto,
        };
        set((s) => ({
          users: [...s.users, user],
          activeUserId: s.activeUserId ?? user.id,
        }));
        return user;
      },
      updateUser: (id, patch) =>
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        })),
      removeUser: (id) =>
        set((s) => ({
          users: s.users.filter((u) => u.id !== id),
          checkIns: s.checkIns.filter((c) => c.userId !== id),
          activeUserId: s.activeUserId === id ? null : s.activeUserId,
        })),
      setActiveUser: (activeUserId) => set({ activeUserId }),

      recordCheckIn: (userId) => {
        const day = todayKey();
        const exists = get().checkIns.some(
          (c) => c.userId === userId && c.day === day,
        );
        if (exists) return false;
        set((s) => ({
          checkIns: [
            ...s.checkIns,
            { userId, day, at: new Date().toISOString() },
          ],
          activeUserId: userId,
        }));
        return true;
      },
      claimWheelSpin: () =>
        set((s) => ({ wheelSpinsClaimed: s.wheelSpinsClaimed + 1 })),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "astro-lab:user",
      skipHydration: true,
      partialize: (s) => ({
        users: s.users,
        activeUserId: s.activeUserId,
        checkIns: s.checkIns,
        wheelSpinsClaimed: s.wheelSpinsClaimed,
      }),
    },
  ),
);

/** Call once on mount (app shell) to rehydrate persisted user state. */
export function hydrateUserStore() {
  void useUserStore.persist.rehydrate().then(() => {
    useUserStore.getState().setHydrated();
  });
}

export function userStore() {
  return useUserStore.getState();
}

/** Consecutive-day streak ending today (or yesterday if today is missing). */
export function streakFor(checkIns: CheckInRecord[], userId: string): number {
  const days = new Set(
    checkIns.filter((c) => c.userId === userId).map((c) => c.day),
  );
  if (days.size === 0) return 0;
  let streak = 0;
  let cursor = days.has(todayKey()) ? 0 : -1;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}
