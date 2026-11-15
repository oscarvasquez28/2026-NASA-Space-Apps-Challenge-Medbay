"use client";

import { useCallback, useEffect, useState } from "react";

import { COMPANION_SKINS, DAILY_CHECKLIST, getSkinPalette } from "@/data/gamification";
import { useAppStore } from "@/stores/app-store";
import type {
  CheckupCompleteResponse,
  ChecklistItem,
  GamificationState,
  SkinDef,
} from "@/types/health";
import { useProvider } from "./useProvider";

/**
 * Routine checkup checklist, token reward economy, and suit skin gachapon
 * synchronized with GET /api/v1/gamification/status and
 * POST /api/v1/gamification/checkup-complete.
 */
export function useGamification(crewId: string | undefined) {
  const provider = useProvider();
  const checklistDone = useAppStore((s) => s.checklistDone);
  const streakDays = useAppStore((s) => s.streakDays);
  const ownedSkinIds = useAppStore((s) => s.ownedSkinIds);
  const localToggleChecklist = useAppStore((s) => s.toggleChecklist);
  const rewardSkin = useAppStore((s) => s.rewardSkin);

  const [serverState, setServerState] = useState<GamificationState | null>(null);
  const [pulling, setPulling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastPull, setLastPull] = useState<SkinDef | null>(null);
  const [lastResult, setLastResult] = useState<CheckupCompleteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!provider || !crewId) return;
    try {
      const s = await provider.getGamification(crewId);
      setServerState(s);
      s.ownedSkinIds.forEach((id) => rewardSkin(id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load gamification status.");
    }
  }, [provider, crewId, rewardSkin]);

  useEffect(() => {
    if (!provider || !crewId) return;
    let cancelled = false;
    provider.getGamification(crewId).then(
      (s) => {
        if (!cancelled) {
          setServerState(s);
          s.ownedSkinIds.forEach((id) => rewardSkin(id));
          setError(null);
        }
      },
      (e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load gamification status.",
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [provider, crewId, rewardSkin]);

  const checklist: ChecklistItem[] =
    serverState?.checklist ??
    DAILY_CHECKLIST.map((c) => ({
      ...c,
      done: checklistDone.includes(c.id),
    }));

  const allDone = checklist.length > 0 && checklist.every((c) => c.done);

  const toggleChecklist = useCallback(
    async (taskId: string) => {
      localToggleChecklist(taskId);
      const currentCompleted = checklist
        .filter((c) => (c.id === taskId ? !c.done : c.done))
        .map((c) => c.id);

      setServerState((prev) =>
        prev
          ? {
              ...prev,
              checklist: prev.checklist.map((c) =>
                c.id === taskId ? { ...c, done: !c.done } : c,
              ),
            }
          : prev,
      );

      if (!provider || !crewId) return;
      setSaving(true);
      try {
        const res = await provider.completeCheckup({
          astronaut_id: crewId,
          completed_tasks: currentCompleted,
          perform_gachapon_roll: false,
        });
        setLastResult(res);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save checkup task.");
      } finally {
        setSaving(false);
      }
    },
    [checklist, crewId, localToggleChecklist, provider, refresh],
  );

  const completeAndRoll = useCallback(
    async (opts?: { deterministicSeed?: number | null }) => {
      if (!provider || !crewId || pulling) return null;
      setPulling(true);
      setLastPull(null);
      setError(null);
      try {
        const completedIds = checklist.filter((c) => c.done).map((c) => c.id);
        const tasksToSubmit =
          completedIds.length > 0
            ? completedIds
            : [checklist[0]?.id ?? "task_morning_vitals"];

        const res = await provider.completeCheckup({
          astronaut_id: crewId,
          completed_tasks: tasksToSubmit,
          perform_gachapon_roll: true,
          deterministic_seed: opts?.deterministicSeed ?? null,
        });
        setLastResult(res);

        if (res.roll_result?.rolled_skin) {
          const rs = res.roll_result.rolled_skin;
          const mapped: SkinDef = {
            id: rs.skin_id,
            name: rs.name,
            rarity: rs.rarity.toLowerCase() as SkinDef["rarity"],
            description: rs.description,
            palette: getSkinPalette(rs.skin_id),
            unlocked: rs.unlocked,
            equipped: rs.equipped,
            probabilityPercent: rs.probability_percent,
          };
          rewardSkin(mapped.id);
          setLastPull(mapped);
          await refresh();
          return mapped;
        }
        await refresh();
        return null;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gachapon roll failed.");
        return null;
      } finally {
        setPulling(false);
      }
    },
    [checklist, crewId, provider, pulling, refresh, rewardSkin],
  );

  const equipSkin = useCallback(
    async (skinId: string) => {
      if (!provider || !crewId) return;
      setSaving(true);
      setError(null);
      try {
        const completedIds = checklist.filter((c) => c.done).map((c) => c.id);
        const res = await provider.completeCheckup({
          astronaut_id: crewId,
          completed_tasks: completedIds,
          perform_gachapon_roll: false,
          equip_skin_id: skinId,
        });
        setLastResult(res);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to equip suit skin.");
      } finally {
        setSaving(false);
      }
    },
    [checklist, crewId, provider, refresh],
  );

  return {
    checklist,
    allDone,
    toggleChecklist,
    streakDays: serverState?.streakDays ?? streakDays,
    totalCheckupsCompleted: serverState?.totalCheckupsCompleted ?? 0,
    gachaponTokens: serverState?.gachaponTokens ?? 0,
    complianceRatePercent: serverState?.complianceRatePercent ?? 0,
    ownedSkinIds: serverState?.ownedSkinIds ?? ownedSkinIds,
    equippedSkinId: serverState?.equippedSkinId ?? "skin_standard_suit",
    catalog: serverState?.catalog ?? COMPANION_SKINS,
    highLevel: serverState?.highLevel,
    technical: serverState?.technical,
    pulling,
    saving,
    lastPull,
    lastResult,
    error,
    pull: () => completeAndRoll(),
    completeAndRoll,
    equipSkin,
    refresh,
  };
}
