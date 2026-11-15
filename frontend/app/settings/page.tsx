"use client";

/**
 * /settings — persisted app preferences + baseline data reset.
 */

import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { Disclaimer, Eyebrow } from "@/components/ui/primitives";
import { useHealthStatus } from "@/hooks/useHealthStatus";
import { useLocationContext } from "@/hooks/useLocationContext";
import { useProvider } from "@/hooks/useProvider";
import { getAuthSessionState } from "@/lib/api";
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
  const [restoreRes, setRestoreRes] =
    useState<DatabaseSnapshotRestoreResponse | null>(null);
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
      setRestoreErr(
        e instanceof Error ? e.message : "Database snapshot restore failed.",
      );
    } finally {
      setRestoring(false);
    }
  };

  const row = (
    label: string,
    desc: string,
    control: React.ReactNode,
  ) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 0",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13 }}>{label}</div>
        <div className="micro-8" style={{ marginTop: 3 }}>
          {desc}
        </div>
      </div>
      {control}
    </div>
  );

  const toggle = (v: boolean, set: (x: boolean) => void, label: string) => (
    <button
      className="camera-preset"
      aria-pressed={v}
      onClick={() => set(!v)}
      aria-label={label}
    >
      {v ? "ON" : "OFF"}
    </button>
  );

  return (
    <div style={{ padding: "22px 26px", maxWidth: 680 }}>
      <Eyebrow>System / preferences &amp; database control</Eyebrow>

      <div style={{ marginTop: 14 }}>
        {row(
          "Render quality",
          "Shadows + device pixel ratio for 3D viewports",
          <div className="view-toggle">
            {(["high", "balanced"] as Quality[]).map((q) => (
              <button
                key={q}
                aria-pressed={quality === q}
                onClick={() => setQuality(q)}
              >
                {q.toUpperCase()}
              </button>
            ))}
          </div>,
        )}
        {row(
          "Auto-rotate viewports",
          "Idle turntable until first interaction",
          toggle(autoRotate, setAutoRotate, "Toggle auto-rotate"),
        )}
        {row(
          "Reduced motion",
          "Camera jumps instead of animated transitions",
          toggle(reduceMotion, setReduceMotion, "Toggle reduced motion"),
        )}
        {row(
          "Default view mode",
          "High-level guidance vs clinical telemetry",
          <div className="view-toggle">
            <button
              aria-pressed={viewMode === "high_level"}
              onClick={() => setViewMode("high_level")}
            >
              HIGH-LEVEL
            </button>
            <button
              aria-pressed={viewMode === "technical"}
              onClick={() => setViewMode("technical")}
            >
              TECHNICAL
            </button>
          </div>,
        )}
        {row(
          "Idle biometric lock timeout",
          "Engage camera lock screen after inactivity",
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="view-toggle">
              {[
                { label: "1 MIN", ms: 60_000 },
                { label: "3 MIN", ms: 180_000 },
                { label: "5 MIN", ms: 300_000 },
                { label: "OFF", ms: 0 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  aria-pressed={idleTimeoutMs === opt.ms}
                  onClick={() => setIdleTimeoutMs(opt.ms)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              className="btn"
              onClick={() => setSessionLocked(true)}
            >
              Lock now
            </button>
          </div>,
        )}
        {row(
          "Data provider",
          "Active HealthDataProvider implementation",
          <span className="micro">{providerKind ?? "resolving…"}</span>,
        )}
        {row(
          "Mission baseline data",
          "Reset telemetry history, location context, gamification, and telemedicine queue to baseline defaults",
          <button
            className="btn"
            disabled={!provider || restoring}
            onClick={() => void handleRestore()}
          >
            <RotateCcw size={11} />
            {restoring ? "Restoring…" : "Reset Baseline"}
          </button>,
        )}
      </div>

      {restoreErr && (
        <p
          className="micro"
          role="alert"
          style={{ marginTop: 14, color: "var(--status-critical)" }}
        >
          {restoreErr}
        </p>
      )}

      {restoreRes && (
        <div className="callout" style={{ marginTop: 14 }} role="status">
          <div className="micro-8" style={{ color: "var(--status-nominal)" }}>
            BASELINE RESTORED · {restoreRes.default_astronaut_id} ·{" "}
            {restoreRes.default_location_setting} ·{" "}
            {new Date(restoreRes.restored_at).toLocaleTimeString()}
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
            {viewMode === "technical"
              ? restoreRes.technical
              : restoreRes.high_level}
          </p>
          <div className="micro-8" style={{ marginTop: 6, color: "var(--dim)" }}>
            BASELINE RECORDS:{" "}
            {Object.entries(restoreRes.seeded_counts)
              .map(([k, v]) => `${k}=${v}`)
              .join(" · ")}
          </div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <Disclaimer>
          Preferences persist in localStorage (astro-lab:prefs). Provider is
          selected via NEXT_PUBLIC_DATA_PROVIDER / DATA_PROVIDER env (default
          rest).
        </Disclaimer>
      </div>
    </div>
  );
}
