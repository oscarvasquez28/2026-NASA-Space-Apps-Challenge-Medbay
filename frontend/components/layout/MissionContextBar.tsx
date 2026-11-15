"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { MISSION_DAY, MISSION_NAME } from "@/data/mission";
import { useCrew } from "@/hooks/useCrew";
import { useLocationContext } from "@/hooks/useLocationContext";
import { useAppStore } from "@/stores/app-store";
import type { LocationId, ViewMode } from "@/types/health";

function crewIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/crew\/([^/]+)/);
  return m ? m[1] : null;
}

/**
 * Mission context strip (module B): crew chip, mission day, comm latency /
 * blackout indicator, readiness score, location selector, view-mode toggle.
 */
export function MissionContextBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { crew } = useCrew();
  const { locations, locationId, profile, setLocation } =
    useLocationContext();
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const hydrated = useAppStore((s) => s.hydrated);
  const [missionClock, setMissionClock] = useState("");

  const routeCrewId = crewIdFromPath(pathname);
  const active = crew.find((c) => c.id === routeCrewId) ?? crew[0];

  const hazards = Object.entries(profile.hazards) as [
    keyof typeof profile.hazards,
    number,
  ][];
  const dominant = hazards.reduce((a, b) => (b[1] > a[1] ? b : a));

  useEffect(() => {
    const update = () =>
      setMissionClock(
        new Date().toISOString().slice(11, 19).replace(/-/g, ":"),
      );
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="ctxbar" role="region" aria-label="Mission context">
      <div className="ctx-chip" title={MISSION_NAME}>
        <span className="tiny-square" aria-hidden />
        <select
          className="ctx-select"
          aria-label="Crew member"
          value={active?.id ?? ""}
          onChange={(e) => router.push(`/crew/${e.target.value}`)}
        >
          {!crew.length && <option>LOADING…</option>}
          {crew.map((c) => (
            <option key={c.id} value={c.id}>
              {c.callsign} · {c.id}
            </option>
          ))}
        </select>
      </div>

      <div className="ctx-chip" title="Mission elapsed time">
        SOL {MISSION_DAY} · T+{missionClock || "--:--:--"}
      </div>

      <div
        className="ctx-chip"
        title={`Comm profile for ${profile.label}: latency ${profile.commLatencySec}s, blackout risk ${profile.blackoutRisk}`}
      >
        LAT {profile.commLatencySec}s · BLK {profile.blackoutRisk}
        {profile.linkMode === "local" ? " · OFFLINE-SIM" : ""}
      </div>

      <div
        className="ctx-chip"
        title={`Hazard weights @ ${profile.label}: ${hazards
          .map(([k, v]) => `${k} ${v}`)
          .join(" · ")}`}
      >
        HAZ
        {hazards.map(([k, v]) => (
          <span
            key={k}
            className="micro-8"
            style={{
              color:
                k === dominant[0]
                  ? v >= 70
                    ? "var(--status-critical)"
                    : v >= 45
                      ? "var(--status-caution)"
                      : "var(--status-nominal)"
                  : "var(--dim)",
            }}
          >
            {k.slice(0, 3).toUpperCase()} {v}
          </span>
        ))}
      </div>

      {active && (
        <div
          className="ctx-chip"
          title={`Mission readiness for ${active.name}`}
        >
          RDY {active.readiness.score}
          <span className="micro-8">{active.readiness.label}</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div className="ctx-chip">
        <select
          className="ctx-select"
          aria-label="Mission location"
          value={locationId}
          onChange={(e) => setLocation(e.target.value as LocationId)}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className="view-toggle"
        role="group"
        aria-label="View mode"
        suppressHydrationWarning
      >
        <button
          aria-pressed={hydrated && viewMode === "high_level"}
          onClick={() => setViewMode("high_level" as ViewMode)}
        >
          High-Level
        </button>
        <button
          aria-pressed={hydrated && viewMode === "technical"}
          onClick={() => setViewMode("technical" as ViewMode)}
        >
          Technical
        </button>
      </div>
    </div>
  );
}
