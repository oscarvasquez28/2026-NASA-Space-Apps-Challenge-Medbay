"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { getAuthSessionState } from "@/lib/api";
import { getRuntimeConfig } from "@/lib/config";
import { DEFAULT_MASCOT, type MascotSkinId } from "@/data/mascots";
import type { CheckInRecord, LocalUser, UserRole } from "@/types/health";

/**
 * Local-only per-operator profile extras (kept apart from `users`, which the
 * backend session sync replaces wholesale).
 */
export interface OperatorExtras {
  /** Profile picture override (upload or premade icon); face credential untouched. */
  avatar?: string;
  mascotSkins: MascotSkinId[];
  equippedMascot: MascotSkinId;
  /** Skins the operator has already looked at (hides the NEW SKIN star). */
  seenMascots: MascotSkinId[];
}

export const DEFAULT_EXTRAS: OperatorExtras = {
  mascotSkins: [DEFAULT_MASCOT],
  equippedMascot: DEFAULT_MASCOT,
  seenMascots: [DEFAULT_MASCOT],
};

/**
 * Operator profiles + daily check-in + idle lock state.
 * Persists locally under `astro-lab:user` and synchronizes with FastAPI
 * `/api/v1/auth/*` and `face_credentials` when DATA_PROVIDER=rest.
 */

/** Spec cadence; the live value comes from runtime-config (WHEEL_CADENCE_DAYS). */
export const WHEEL_EVERY_N = 7;
export const DEFAULT_IDLE_TIMEOUT_MS = 180_000;

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
  /** Prize-drum spins already consumed (earned = one per 7-day streak). */
  wheelSpinsClaimed: number;
  /** Idle inactivity lock timeout in milliseconds (default 3 minutes). */
  idleTimeoutMs: number;
  /** Ephemeral lock-screen flag set when console sits idle. */
  sessionLocked: boolean;
  /** Ephemeral captured photo held when camera sees an unrecognized face. */
  unrecognizedFacePhoto: string | null;
  extras: Record<string, OperatorExtras>;

  hydrated: boolean;

  addUser: (
    u: Omit<LocalUser, "id" | "role" | "astronautId" | "createdAt"> & {
      id?: string;
      createdAt?: string;
      role?: UserRole;
      astronautId?: string;
    },
  ) => LocalUser;
  upsertServerUser: (u: LocalUser) => void;
  updateUser: (id: string, patch: Partial<LocalUser>) => void;
  removeUser: (id: string) => void;
  setActiveUser: (id: string | null) => void;
  /** Idempotent — one record per user+day. Returns true when it created a new record. */
  recordCheckIn: (userId: string, dayOverride?: string) => boolean;
  claimWheelSpin: () => void;
  setIdleTimeoutMs: (ms: number) => void;
  setSessionLocked: (locked: boolean) => void;
  setUnrecognizedFacePhoto: (photo: string | null) => void;
  setAvatar: (userId: string, avatar: string | undefined) => void;
  /** Unlocks a mascot skin; returns false when it was already owned. */
  unlockMascot: (userId: string, id: MascotSkinId) => boolean;
  equipMascot: (userId: string, id: MascotSkinId) => void;
  markMascotSeen: (userId: string, id: MascotSkinId) => void;
  syncFromServer: (payload: {
    users: LocalUser[];
    checkIns: CheckInRecord[];
  }) => void;
  setHydrated: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      users: [],
      activeUserId: null,
      checkIns: [],
      wheelSpinsClaimed: 0,
      idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
      sessionLocked: false,
      unrecognizedFacePhoto: null,
      extras: {},
      hydrated: false,

      addUser: (input) => {
        const users = get().users;
        const user: LocalUser = {
          id:
            input.id ??
            `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          // The first enrolled operator must hold medic clearance.
          role: users.length === 0 ? "medic" : (input.role ?? "user"),
          astronautId:
            input.astronautId?.trim() ||
            `AST-U${String(users.length + 1).padStart(2, "0")}`,
          createdAt: input.createdAt ?? new Date().toISOString(),
          name: input.name,
          callsign: input.callsign,
          facePhoto: input.facePhoto,
          wheelSpinsClaimed: input.wheelSpinsClaimed ?? 0,
        };
        set((s) => ({
          users: [...s.users, user],
          activeUserId: s.activeUserId ?? user.id,
        }));
        return user;
      },
      upsertServerUser: (u) =>
        set((s) => {
          const exists = s.users.some((x) => x.id === u.id);
          const users = exists
            ? s.users.map((x) => (x.id === u.id ? u : x))
            : [...s.users, u];
          return {
            users,
            activeUserId: s.activeUserId ?? u.id,
          };
        }),
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
      setActiveUser: (activeUserId) =>
        set((s) => {
          const target = s.users.find((u) => u.id === activeUserId);
          return {
            activeUserId,
            wheelSpinsClaimed:
              target?.wheelSpinsClaimed ?? s.wheelSpinsClaimed,
          };
        }),

      recordCheckIn: (userId, dayOverride) => {
        const day = dayOverride ?? todayKey();
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
        set((s) => ({
          wheelSpinsClaimed: s.wheelSpinsClaimed + 1,
          users: s.users.map((u) =>
            u.id === s.activeUserId
              ? { ...u, wheelSpinsClaimed: (u.wheelSpinsClaimed ?? 0) + 1 }
              : u,
          ),
        })),
      setIdleTimeoutMs: (idleTimeoutMs) => set({ idleTimeoutMs }),
      setSessionLocked: (sessionLocked) => set({ sessionLocked }),
      setUnrecognizedFacePhoto: (unrecognizedFacePhoto) =>
        set({ unrecognizedFacePhoto }),
      setAvatar: (userId, avatar) =>
        set((s) => ({
          extras: { ...s.extras, [userId]: { ...extrasOf(s.extras, userId), avatar } },
        })),
      unlockMascot: (userId, id) => {
        const cur = extrasOf(get().extras, userId);
        if (cur.mascotSkins.includes(id)) return false;
        set((s) => ({
          extras: { ...s.extras, [userId]: { ...cur, mascotSkins: [...cur.mascotSkins, id] } },
        }));
        return true;
      },
      equipMascot: (userId, id) =>
        set((s) => {
          const cur = extrasOf(s.extras, userId);
          if (!cur.mascotSkins.includes(id)) return s;
          return {
            extras: {
              ...s.extras,
              [userId]: {
                ...cur,
                equippedMascot: id,
                seenMascots: cur.seenMascots.includes(id) ? cur.seenMascots : [...cur.seenMascots, id],
              },
            },
          };
        }),
      markMascotSeen: (userId, id) =>
        set((s) => {
          const cur = extrasOf(s.extras, userId);
          if (cur.seenMascots.includes(id)) return s;
          return { extras: { ...s.extras, [userId]: { ...cur, seenMascots: [...cur.seenMascots, id] } } };
        }),
      syncFromServer: ({ users, checkIns }) =>
        set((s) => {
          const validActive =
            s.activeUserId && users.some((u) => u.id === s.activeUserId)
              ? s.activeUserId
              : (users[0]?.id ?? null);
          const activeObj = users.find((u) => u.id === validActive);
          return {
            users,
            checkIns,
            activeUserId: validActive,
            wheelSpinsClaimed:
              activeObj?.wheelSpinsClaimed ?? s.wheelSpinsClaimed,
          };
        }),
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
        idleTimeoutMs: s.idleTimeoutMs,
        extras: s.extras,
      }),
    },
  ),
);

/** Call once on mount (app shell) to rehydrate persisted user state & sync backend DB. */
export function hydrateUserStore() {
  void useUserStore.persist.rehydrate().then(async () => {
    try {
      const cfg = await getRuntimeConfig();
      if (cfg.dataProvider === "rest") {
        const remote = await getAuthSessionState();
        useUserStore.getState().syncFromServer({
          users: remote.users,
          checkIns: remote.check_ins,
        });
      }
    } catch {
      // Backend unreachable or mock/test mode — keep local persisted state
    } finally {
      useUserStore.getState().setHydrated();
    }
  });
}

export function extrasOf(
  extras: Record<string, OperatorExtras>,
  userId: string | null | undefined,
): OperatorExtras {
  return (userId && extras[userId]) || DEFAULT_EXTRAS;
}

/** Unseen mascot skins → the yellow NEW SKIN star (spec §2, §7). */
export function unseenMascots(x: OperatorExtras): MascotSkinId[] {
  return x.mascotSkins.filter((id) => !x.seenMascots.includes(id));
}

export function userStore() {
  return useUserStore.getState();
}

/**
 * Wheel milestones for one operator: one spin for every run of `everyN`
 * consecutive check-in days (a gap resets progress toward the next bonus).
 */
export function earnedSpinsFor(
  checkIns: CheckInRecord[],
  userId: string,
  everyN = WHEEL_EVERY_N,
): number {
  const days = new Set(
    checkIns.filter((c) => c.userId === userId).map((c) => c.day),
  );
  let earned = 0;
  for (const d of days) {
    // Start counting a run at its first day, then hit a milestone every
    // everyN-th day of that run.
    if (!days.has(dayKeyFrom(d, -1))) {
      let run = 0;
      let cursor = d;
      while (days.has(cursor)) {
        run += 1;
        if (run % everyN === 0) earned += 1;
        cursor = dayKeyFrom(cursor, 1);
      }
    }
  }
  return earned;
}

function dayKeyFrom(day: string, offset: number) {
  const [y, m, d2] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d2 + offset);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
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
