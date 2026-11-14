"use client";

/**
 * /settings — persisted app preferences: render quality, auto-rotate,
 * reduced motion, view mode. Provider/env info surfaced for transparency.
 */

import { Eyebrow, Disclaimer } from "@/components/ui/primitives";
import { useAppStore, type Quality } from "@/stores/app-store";
import { useHealthStatus } from "@/hooks/useHealthStatus";

export default function SettingsPage() {
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const autoRotate = useAppStore((s) => s.autoRotate);
  const setAutoRotate = useAppStore((s) => s.setAutoRotate);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const setReduceMotion = useAppStore((s) => s.setReduceMotion);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const { providerKind } = useHealthStatus();

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
        <div className="micro-8" style={{ marginTop: 3 }}>{desc}</div>
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
    <div style={{ padding: "22px 26px", maxWidth: 640 }}>
      <Eyebrow>System / preferences</Eyebrow>

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
          "Data provider",
          "Active HealthDataProvider implementation",
          <span className="micro">{providerKind ?? "resolving…"}</span>,
        )}
      </div>

      <div style={{ marginTop: 22 }}>
        <Disclaimer>
          Preferences persist in localStorage (astro-lab:prefs). Provider is
          selected via NEXT_PUBLIC_DATA_PROVIDER / DATA_PROVIDER env.
        </Disclaimer>
      </div>
    </div>
  );
}
