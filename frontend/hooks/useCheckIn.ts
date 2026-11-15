"use client";

import { useCallback, useMemo } from "react";

import { useAppStore } from "@/stores/app-store";
import { dayKey, earnedSpinsFor, streakFor, useUserStore } from "@/stores/user-store";

const todayKey = () => dayKey(0);

/**
 * Daily check-in session state: active operator, simulated visual-ID session,
 * streak math and prize-drum spin entitlement.
 */
export function useCheckIn() {
  const users = useUserStore((s) => s.users);
  const activeUserId = useUserStore((s) => s.activeUserId);
  const checkIns = useUserStore((s) => s.checkIns);
  const wheelSpinsClaimed = useUserStore((s) => s.wheelSpinsClaimed);
  const hydrated = useUserStore((s) => s.hydrated);
  const recordCheckIn = useUserStore((s) => s.recordCheckIn);
  const claimWheelSpin = useUserStore((s) => s.claimWheelSpin);
  const setActiveUser = useUserStore((s) => s.setActiveUser);

  const activeUser = useMemo(
    () => users.find((u) => u.id === activeUserId) ?? null,
    [users, activeUserId],
  );
  const isMedic = activeUser?.role === "medic";

  const todayDone = useMemo(() => {
    if (!activeUser) return false;
    const day = todayKey();
    return checkIns.some((c) => c.userId === activeUser.id && c.day === day);
  }, [checkIns, activeUser]);

  const userCheckIns = useCallback(
    (userId: string) => checkIns.filter((c) => c.userId === userId),
    [checkIns],
  );
  const checkedInToday = useCallback(
    (userId: string) =>
      checkIns.some((c) => c.userId === userId && c.day === todayKey()),
    [checkIns],
  );
  const streak = useCallback(
    (userId: string) => streakFor(checkIns, userId),
    [checkIns],
  );
  const totalCheckIns = useCallback(
    (userId: string) => checkIns.filter((c) => c.userId === userId).length,
    [checkIns],
  );

  // Runtime cadence (WHEEL_CADENCE_DAYS) — mirrors the backend rule.
  const wheelEveryN = useAppStore((s) => s.wheelCadenceDays);

  const pendingSpins = useMemo(() => {
    if (!activeUser) return 0;
    return Math.max(
      0,
      earnedSpinsFor(checkIns, activeUser.id, wheelEveryN) - wheelSpinsClaimed,
    );
  }, [checkIns, activeUser, wheelSpinsClaimed, wheelEveryN]);

  /**
   * Record today's check-in for `userId`. Returns whether it was a new
   * record and whether that record earned a drum spin.
   */
  const checkIn = useCallback(
    (userId: string): { isNewDay: boolean; earnedSpin: boolean } => {
      const isNewDay = recordCheckIn(userId);
      if (!isNewDay) return { isNewDay, earnedSpin: false };
      // Milestone = today's check-in completed a wheelEveryN-day run.
      const streak = streakFor(useUserStore.getState().checkIns, userId);
      return { isNewDay, earnedSpin: streak > 0 && streak % wheelEveryN === 0 };
    },
    [recordCheckIn, wheelEveryN],
  );

  const canViewUser = useCallback(
    (userId: string) => isMedic || userId === activeUserId,
    [isMedic, activeUserId],
  );

  return {
    hydrated,
    users,
    activeUser,
    isMedic,
    todayDone,
    pendingSpins,
    wheelEveryN,
    checkIn,
    claimWheelSpin,
    setActiveUser,
    checkedInToday,
    streak,
    totalCheckIns,
    userCheckIns,
    canViewUser,
  };
}
