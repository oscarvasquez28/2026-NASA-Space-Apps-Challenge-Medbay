"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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

function hazardColor(val: number, isDominant: boolean): string {
  if (!isDominant) return "var(--dim)";
  // Support both backend hazard multipliers (~1.0-2.5x) and mock 0-100 weights
  const high = val > 10 ? val >= 70 : val >= 2.0;
  const mid = val > 10 ? val >= 45 : val >= 1.4;
  if (high) return "var(--status-critical)";
  if (mid) return "var(--status-caution)";
  return "var(--status-nominal)";
}

/**
 * Mission context strip (module B): crew chip, mission day, comm latency /
 * blackout indicator, 5-Hazard multipliers + ECLSS override popover,
 * readiness score, location selector, view-mode toggle.
 */
export function MissionContextBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { crew } = useCrew();
  const { locations, locationId, profile, updating, error, updateLocation } =
    useLocationContext();
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const hydrated = useAppStore((s) => s.hydrated);
  const [missionClock, setMissionClock] = useState("");
  const [eclssOpen, setEclssOpen] = useState(false);

  const [co2, setCo2] = useState("2.3");
  const [pressure, setPressure] = useState("101.3");
  const [temp, setTemp] = useState("21.5");
  const [noise, setNoise] = useState("58");
  const [lux, setLux] = useState("420");
  const [microbes, setMicrobes] = useState("45");
  const [latencySec, setLatencySec] = useState("0.6");
  const [offlineFallback, setOfflineFallback] = useState(false);

  const syncEclssDraftFromProfile = () => {
    setCo2(String(profile.eclss?.co2_mmhg ?? 2.3));
    setPressure(String(profile.eclss?.pressure_kpa ?? 101.3));
    setTemp(String(profile.eclss?.temperature_c ?? 21.5));
    setNoise(String(profile.eclss?.noise_dba ?? 58));
    setLux(String(profile.eclss?.lighting_lux ?? 420));
    setMicrobes(String(profile.eclss?.microbial_cfu_m3 ?? 45));
    setLatencySec(String(profile.commLatencySec ?? 0.6));
    setOfflineFallback(Boolean(profile.offlineFallbackActive));
  };

  const routeCrewId = crewIdFromPath(pathname);
  const active = crew.find((c) => c.id === routeCrewId) ?? crew[0];

  const hazards = (
    Object.entries(profile.hazards) as [
      keyof typeof profile.hazards,
      number | undefined,
    ][]
  ).filter((entry): entry is [keyof typeof profile.hazards, number] =>
    typeof entry[1] === "number",
  );
  const dominant = hazards.reduce(
    (a, b) => (b[1] > a[1] ? b : a),
    hazards[0],
  );

  useEffect(() => {
    const update = () =>
      setMissionClock(
        new Date().toISOString().slice(11, 19).replace(/-/g, ":"),
      );
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  const applyEclss = async () => {
    const num = (s: string) => {
      const n = Number.parseFloat(s);
      return Number.isFinite(n) ? n : undefined;
    };
    await updateLocation(locationId, {
      co2_mmhg: num(co2),
      pressure_kpa: num(pressure),
      temperature_c: num(temp),
      noise_dba: num(noise),
      lighting_lux: num(lux),
      microbial_cfu_m3: num(microbes),
      earth_comm_latency_sec: num(latencySec),
      offline_fallback_active: offlineFallback,
    });
    setEclssOpen(false);
  };

  return (
    <div
      className="ctxbar"
      role="region"
      aria-label="Mission context"
      style={{ position: "relative" }}
    >
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
        title={
          (viewMode === "technical" ? profile.technical : profile.highLevel) ??
          `Comm profile for ${profile.label}: latency ${profile.commLatencySec}s, blackout risk ${profile.blackoutRisk}`
        }
      >
        LAT {profile.commLatencySec}s ·{" "}
        {profile.gravityG !== undefined ? `${profile.gravityG}g · ` : ""}
        BLK {profile.blackoutRisk}
        {profile.linkMode === "local" || profile.offlineFallbackActive
          ? " · OFFLINE"
          : ""}
      </div>

      <div
        className="ctx-chip"
        title={`NASA 5-Hazards @ ${profile.label}: ${hazards
          .map(([k, v]) => `${k} ${v}`)
          .join(" · ")}`}
      >
        HAZ
        {hazards.map(([k, v]) => (
          <span
            key={k}
            className="micro-8"
            style={{
              color: hazardColor(v, dominant ? k === dominant[0] : false),
            }}
          >
            {k.slice(0, 3).toUpperCase()} {v > 10 ? v : `${v}x`}
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

      {error && (
        <span
          className="micro-8"
          style={{ color: "var(--status-caution)" }}
          title={error}
        >
          CTX WARN
        </span>
      )}

      <div className="ctx-chip">
        <select
          className="ctx-select"
          aria-label="Mission location"
          value={locationId}
          disabled={updating}
          onChange={(e) => void updateLocation(e.target.value as LocationId)}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <button
        className="ctx-chip"
        aria-expanded={eclssOpen}
        aria-label="ECLSS environment overrides"
        onClick={() => {
          if (!eclssOpen) syncEclssDraftFromProfile();
          setEclssOpen((v) => !v);
        }}
        style={{ cursor: "pointer" }}
        title="Configure ECLSS CO2, cabin pressure, temperature, latency & offline mode"
      >
        <SlidersHorizontal size={11} />
        ECLSS
      </button>

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

      {eclssOpen && (
        <div
          className="panel"
          role="dialog"
          aria-label="ECLSS parameters"
          style={{
            position: "absolute",
            top: "100%",
            right: 16,
            marginTop: 6,
            width: 340,
            padding: 16,
            zIndex: 50,
            background: "var(--bg-1, #0b101b)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span className="micro-8">ECLSS / ENV OVERRIDE ({profile.label})</span>
            <button
              onClick={() => setEclssOpen(false)}
              aria-label="Close ECLSS panel"
              style={{ color: "var(--dim)" }}
            >
              <X size={12} />
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <label className="field">
              <span className="field-label">ppCO2 (mmHg)</span>
              <input
                type="number"
                step="0.1"
                value={co2}
                onChange={(e) => setCo2(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Pressure (kPa)</span>
              <input
                type="number"
                step="0.1"
                value={pressure}
                onChange={(e) => setPressure(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Temp (°C)</span>
              <input
                type="number"
                step="0.1"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Latency (s)</span>
              <input
                type="number"
                step="0.5"
                value={latencySec}
                onChange={(e) => setLatencySec(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Noise (dBA)</span>
              <input
                type="number"
                value={noise}
                onChange={(e) => setNoise(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Microbes (CFU/m³)</span>
              <input
                type="number"
                value={microbes}
                onChange={(e) => setMicrobes(e.target.value)}
              />
            </label>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 10,
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            <input
              type="checkbox"
              checked={offlineFallback}
              onChange={(e) => setOfflineFallback(e.target.checked)}
            />
            Force offline fallback mode (Earth blackout)
          </label>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 12,
            }}
          >
            <button className="btn" onClick={() => setEclssOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={updating}
              onClick={() => void applyEclss()}
            >
              {updating ? "Applying…" : "Apply ECLSS"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
