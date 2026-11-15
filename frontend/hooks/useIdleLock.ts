"use client";

import { useEffect } from "react";

import { useUserStore } from "@/stores/user-store";

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

/**
 * Monitors user interaction and engages the biometric idle lock screen
 * after `idleTimeoutMs` of inactivity whenever an operator session is active.
 */
export function useIdleLock() {
  const hydrated = useUserStore((s) => s.hydrated);
  const usersCount = useUserStore((s) => s.users.length);
  const activeUserId = useUserStore((s) => s.activeUserId);
  const sessionLocked = useUserStore((s) => s.sessionLocked);
  const idleTimeoutMs = useUserStore((s) => s.idleTimeoutMs);
  const setSessionLocked = useUserStore((s) => s.setSessionLocked);

  useEffect(() => {
    if (!hydrated || usersCount === 0 || !activeUserId || sessionLocked) return;
    if (idleTimeoutMs <= 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setSessionLocked(true);
      }, idleTimeoutMs);
    };

    resetTimer();
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, resetTimer, { passive: true });
    }

    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, resetTimer);
      }
    };
  }, [
    hydrated,
    usersCount,
    activeUserId,
    sessionLocked,
    idleTimeoutMs,
    setSessionLocked,
  ]);
}
