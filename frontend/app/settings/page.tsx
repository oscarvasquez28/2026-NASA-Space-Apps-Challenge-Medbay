"use client";

/**
 * /settings — persisted app preferences + baseline data reset.
 */

import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useHealthStatus } from "@/hooks/useHealthStatus";
import { useLocationContext } from "@/hooks/useLocationContext";
import { useProvider } from "@/hooks/useProvider";
import { getAuthSessionState } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppStore, type Quality } from "@/stores/app-store";
import { useUserStore } from "@/stores/user-store";
import type { DatabaseSnapshotRestoreResponse } from "@/types/health";

export default function SettingsPage() {
  const provider = useProvider();
  const { refresh: refreshLocation } = useLocationContext();
  const setLocationSynced = useAppStore((s) => s.setLocationSynced);

  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const autoRotate = useAppStore((s) => s.autoRotate);
  const setAutoRotate = useAppStore((s) => s.setAutoRotate);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const setReduceMotion = useAppStore((s) => s.setReduceMotion);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const idleTimeoutMs = useUserStore((s) => s.idleTimeoutMs);
  const setIdleTimeoutMs = useUserStore((s) => s.setIdleTimeoutMs);
  const setSessionLocked = useUserStore((s) => s.setSessionLocked);
  const { providerKind } = useHealthStatus();

  const [restoring, setRestoring] = useState(false);
  const [restoreRes, setRestoreRes] = useState<DatabaseSnapshotRestoreResponse | null>(null);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);

  const handleRestore = async () => {
    if (!provider || restoring) return;
    setRestoring(true);
    setRestoreErr(null);
    try {
      const res = await provider.restoreDatabaseSnapshot();
      setRestoreRes(res);
      setLocationSynced(false);
      await refreshLocation();
      if (providerKind === "rest") {
        const remote = await getAuthSessionState().catch(() => null);
        if (remote) {
          useUserStore.getState().syncFromServer({
            users: remote.users,
            checkIns: remote.check_ins,
          });
          useUserStore.getState().setSessionLocked(false);
        }
      }
    } catch (e) {
      setRestoreErr(e instanceof Error ? e.message : "Database snapshot restore failed.");
    } finally {
      setRestoring(false);
    }
  };

  const segment = (
    options: { label: string; active: boolean; onClick: () => void }[],
    label: string,
  ) => (
    <div className="flex border border-input" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.label}
          aria-pressed={o.active}
          onClick={o.onClick}
          className={cn("medbay-micro px-3 py-2", o.active ? "bg-foreground text-black" : "hover:text-state")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const row = (label: string, desc: string, control: React.ReactNode) => (
    <div className="flex items-center gap-4 border-b border-input py-3.5">
      <div className="flex-1">
        <div className="medbay-display text-[14px]">{label}</div>
        <div className="medbay-micro mt-1 text-foreground/60">{desc}</div>
      </div>
      {control}
    </div>
  );

  const toggle = (v: boolean, set: (x: boolean) => void, label: string) =>
    segment(
      [
        { label: "ON", active: v, onClick: () => set(true) },
        { label: "OFF", active: !v, onClick: () => set(false) },
      ],
      label,
    );

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto px-6 py-5">
      <h1 className="medbay-display text-xl tracking-widest">Settings</h1>
      <span className="medbay-micro text-foreground/60">preferences · database control</span>

      <div className="mt-3 max-w-3xl">
        {row(
          "Render quality",
          "Shadows + device pixel ratio for 3D viewports",
          segment(
            (["high", "balanced"] as Quality[]).map((q) => ({
              label: q.toUpperCase(),
              active: quality === q,
              onClick: () => setQuality(q),
            })),
            "Render quality",
          ),
        )}
        {row("Auto-rotate viewports", "Idle turntable until first interaction", toggle(autoRotate, setAutoRotate, "Toggle auto-rotate"))}
        {row("Reduced motion", "Camera jumps instead of animated transitions", toggle(reduceMotion, setReduceMotion, "Toggle reduced motion"))}
        {row(
          "Default view mode",
          "High-level guidance vs clinical telemetry",
          segment(
            [
              { label: "HIGH-LEVEL", active: viewMode === "high_level", onClick: () => setViewMode("high_level") },
              { label: "TECHNICAL", active: viewMode === "technical", onClick: () => setViewMode("technical") },
            ],
            "View mode",
          ),
        )}
        {row(
          "Idle biometric lock timeout",
          "Engage camera lock screen after inactivity",
          <div className="flex items-center gap-2">
            {segment(
              [
                { label: "1 MIN", active: idleTimeoutMs === 60_000, onClick: () => setIdleTimeoutMs(60_000) },
                { label: "3 MIN", active: idleTimeoutMs === 180_000, onClick: () => setIdleTimeoutMs(180_000) },
                { label: "5 MIN", active: idleTimeoutMs === 300_000, onClick: () => setIdleTimeoutMs(300_000) },
                { label: "OFF", active: idleTimeoutMs === 0, onClick: () => setIdleTimeoutMs(0) },
              ],
              "Idle lock timeout",
            )}
            <Button variant="outline" size="sm" onClick={() => setSessionLocked(true)}>
              Lock now
            </Button>
          </div>,
        )}
        {row("Data provider", "Active HealthDataProvider implementation", <span className="medbay-micro">{providerKind ?? "resolving…"}</span>)}
        {row(
          "Mission baseline data",
          "Restore operators, telemetry, context, gamification, and alert queue to the saved snapshot point (falls back to seeder baseline when no snapshot exists)",
          <Button variant="outline" size="sm" disabled={!provider || restoring} onClick={() => void handleRestore()}>
            <RotateCcw size={11} />
            {restoring ? "Restoring…" : "Reset baseline"}
          </Button>,
        )}
      </div>

      {restoreErr && (
        <p className="medbay-micro mt-3 text-risk" role="alert">{restoreErr}</p>
      )}

      {restoreRes && (
        <div className="mt-3 max-w-3xl border border-ok p-3" role="status">
          <div className="medbay-micro text-ok">
            Baseline restored · {restoreRes.default_astronaut_id} · {restoreRes.default_location_setting} ·{" "}
            {new Date(restoreRes.restored_at).toLocaleTimeString()}
          </div>
          <p className="mt-1.5 text-[12px] text-foreground/70">
            {viewMode === "technical" ? restoreRes.technical : restoreRes.high_level}
          </p>
          <div className="medbay-micro mt-1.5 text-foreground/50">
            Baseline records:{" "}
            {Object.entries(restoreRes.seeded_counts)
              .map(([k, v]) => `${k}=${v}`)
              .join(" · ")}
          </div>
        </div>
      )}

      <p className="medbay-micro mt-4 max-w-3xl text-foreground/45">
        Preferences persist in localStorage (astro-lab:prefs). Provider is selected via
        NEXT_PUBLIC_DATA_PROVIDER / DATA_PROVIDER env (default rest).
      </p>
    </div>
  );
}
