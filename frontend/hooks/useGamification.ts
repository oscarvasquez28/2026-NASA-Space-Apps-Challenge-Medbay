"use client";

import { useCallback, useEffect, useState } from "react";

import { DAILY_CHECKLIST } from "@/data/gamification";
import { useProvider } from "./useProvider";
import { useAppStore } from "@/stores/app-store";
import type { GamificationState, SkinDef } from "@/types/health";

/**
 * Daily checklist + gachapon reward flow. Completion state persists in the
 * app store; catalog/server state comes from the provider.
 */
export function useGamification(crewId: string | undefined) {
  const provider = useProvider();
  const checklistDone = useAppStore((s) => s.checklistDone);
  const streakDays = useAppStore((s) => s.streakDays);
  const ownedSkinIds = useAppStore((s) => s.ownedSkinIds);
  const toggleChecklist = useAppStore((s) => s.toggleChecklist);
  const bumpStreak = useAppStore((s) => s.bumpStreak);
  const rewardSkin = useAppStore((s) => s.rewardSkin);

  const [serverState, setServerState] = useState<GamificationState | null>(null);
  const [pulling, setPulling] = useState(false);
  const [lastPull, setLastPull] = useState<SkinDef | null>(null);

  useEffect(() => {
    if (!provider || !crewId) return;
    let cancelled = false;
    void provider.getGamification(crewId).then((s) => {
      if (!cancelled) setServerState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, crewId]);

  const checklist = DAILY_CHECKLIST.map((c) => ({
    ...c,
    done: checklistDone.includes(c.id),
  }));
  const allDone = checklist.every((c) => c.done);

  const pull = useCallback(async () => {
    if (!provider || !crewId || pulling) return null;
    setPulling(true);
    setLastPull(null);
    try {
      const skin = await provider.pullGachapon(crewId);
      rewardSkin(skin.id);
      bumpStreak();
      setLastPull(skin);
      return skin;
    } finally {
      setPulling(false);
    }
  }, [provider, crewId, pulling, rewardSkin, bumpStreak]);

  return {
    checklist,
    allDone,
    toggleChecklist,
    streakDays: Math.max(streakDays, serverState?.streakDays ?? 0),
    ownedSkinIds,
    pulling,
    lastPull,
    pull,
  };
}
