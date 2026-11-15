"use client";

import { useCallback, useMemo } from "react";

import { dayKey, streakFor, useUserStore, WHEEL_EVERY_N } from "@/stores/user-store";

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

  const pendingSpins = useMemo(() => {
    if (!activeUser) return 0;
    const earned = Math.floor(
      checkIns.filter((c) => c.userId === activeUser.id).length / WHEEL_EVERY_N,
    );
    return Math.max(0, earned - wheelSpinsClaimed);
  }, [checkIns, activeUser, wheelSpinsClaimed]);

  /**
   * Record today's check-in for `userId`. Returns whether it was a new
   * record and whether that record earned a drum spin.
   */
  const checkIn = useCallback(
    (userId: string): { isNewDay: boolean; earnedSpin: boolean } => {
      const isNewDay = recordCheckIn(userId);
      if (!isNewDay) return { isNewDay, earnedSpin: false };
      const total = useUserStore
        .getState()
        .checkIns.filter((c) => c.userId === userId).length;
      return { isNewDay, earnedSpin: total % WHEEL_EVERY_N === 0 };
    },
    [recordCheckIn],
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
