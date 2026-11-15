"use client";

import { Bone, CloudFog, Droplet, Eye, Gauge, Radiation } from "lucide-react";
import type { ComponentType } from "react";

import {
  BedIcon,
  HeartIcon,
  HistoryIcon,
  OxygenIcon,
  PredictionIcon,
  TemperatureIcon,
  type MedbayIconProps,
} from "@/components/icons/medbay";
import { Eyebrow, StatusDot } from "@/components/ui/primitives";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { atRisk, formatVital, type TileState, type VitalTileId } from "@/lib/medbay-vitals";
import { cn } from "@/lib/utils";
import type { HealthState } from "@/stores/app-store";
import type { GraphMode } from "./VitalGraph";

type IconC = ComponentType<MedbayIconProps>;
function lucide(C: ComponentType<{ size?: number | string; className?: string }>): IconC {
  return function Icon({ size = 16, className }: MedbayIconProps) {
    return <C size={Number(size)} className={className} />;
  };
}

export const TILE_ICON: Record<VitalTileId, IconC> = {
  bmd: lucide(Bone),
  sleep: BedIcon,
  temp: TemperatureIcon,
  spo2: OxygenIcon,
  hr: HeartIcon,
  bp: HeartIcon,
  glucose: lucide(Droplet),
  radiation: lucide(Radiation),
  vision: lucide(Eye),
  suit: lucide(Gauge),
  co2: lucide(CloudFog),
};

function tileLines(t: TileState): string[] {
  const v = formatVital(t.def, t.reading);
  switch (t.def.id) {
    case "bmd":
      return [`BMD: ${v}`, "T-score"];
    case "sleep": {
      if (!t.reading) return ["Sleep avg", "— Hrs", "— Mins"];
      const h = Math.floor(t.reading.value);
      const m = Math.round((t.reading.value - h) * 60);
      return ["Sleep avg", `${h} Hrs`, `${m} Mins`];
    }
    case "temp":
      return [`${v} C°`];
    case "spo2":
      return [`SpO₂: ${v}%`];
    case "hr":
      return [`HR: ${v}`];
    case "bp":
      return [`BP: ${v}`, "mmHg"];
    case "glucose":
      return [`Sugar: ${v}`, "mg/dL"];
    case "radiation":
      return [`Dose: ${v}`, "mSv"];
    case "vision":
      return [`Acuity: ${v}`, "logMAR"];
    case "suit":
      return [`Suit: ${v}`, "kPa"];
    case "co2":
      return [`CO₂: ${v}`, "mmHg"];
  }
}

export function VitalTile({
  tile,
  onSelect,
  health,
  className,
}: {
  tile: TileState;
  onSelect?: (id: VitalTileId) => void;
  health: HealthState;
  className?: string;
}) {
  const Icon = TILE_ICON[tile.def.id];
  const risky = atRisk(tile.verdict);
  const tone = risky ? (health === "critical" && tile.reading?.status === "CRITICAL" ? "critical" : "risk") : null;
  const lines = tileLines(tile);
  const vertical = tile.def.id === "temp";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(tile.def.id)}
      className={cn(
        "medbay-surface flex min-h-[74px] items-center gap-3 px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-highlight/60 hover:shadow-[0_10px_24px_rgba(0,0,0,0.5),0_0_16px_var(--accent-soft)]",
        vertical && "flex-col justify-center gap-2 text-center",
        tone === "risk" && "medbay-surface-risk text-risk",
        tone === "critical" && "medbay-surface-critical text-critical",
        className,
      )}
      aria-label={`${tile.def.title}: ${lines.join(" ")}`}
    >
      <Icon size={vertical ? 30 : 34} className={cn("shrink-0", !tone && "text-state")} />
      <span className="medbay-copy flex flex-col text-[13px] uppercase leading-tight">
        {lines.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </span>
    </button>
  );
}

export function GraphToggles({
  mode,
  onMode,
  vertical,
  size = 34,
}: {
  mode: GraphMode | null;
  onMode: (m: GraphMode) => void;
  vertical?: boolean;
  size?: number;
}) {
  return (
    <div className={cn("flex gap-2", vertical && "flex-col")}>
      {(
        [
          ["history", HistoryIcon, "Historical graph"],
          ["prediction", PredictionIcon, "Prediction"],
        ] as const
      ).map(([m, Icon, label]) => (
        <Tooltip key={m}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-pressed={mode === m}
              aria-label={label}
              onClick={() => onMode(m)}
              className={cn(
                "grid place-items-center border transition-colors",
                mode === m
                  ? "border-state bg-state text-black shadow-[0_0_14px_var(--accent-soft)]"
                  : "border-input bg-black/60 text-foreground/70 hover:border-state hover:text-state",
              )}
              style={{ width: size, height: size }}
            >
              <Icon size={Math.round(size * 0.62)} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {m === "history"
              ? "Historical graph of the vitals (or of the selected vital)"
              : "Prediction of how the vitals should evolve, from previous progression"}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function VitalsPanel({
  tiles,
  health,
  feed = "LIVE FEED",
  sim,
  onSelect,
  onDashboard,
}: {
  tiles: TileState[];
  health: HealthState;
  /** Provenance tag — "SIM FEED" when the mock provider drives the demo arc. */
  feed?: string;
  /** REST scenario player — START/STOP real telemetry inserts (mock self-drives). */
  sim?: { running: boolean; inserts: number; onToggle: () => void };
  onSelect: (id: VitalTileId) => void;
  onDashboard: (m: GraphMode) => void;
}) {
  return (
    <div
      className={cn(
        "crosshair flex min-h-0 flex-col gap-2 overflow-hidden p-4 pt-3",
        health === "risk" ? "bg-[color-mix(in_srgb,var(--medbay-risk)_22%,black)]" : "bg-[var(--panel-tint)]",
      )}
    >
      <div className="flex shrink-0 items-center gap-3 px-1">
        <Eyebrow>VITAL SIGNS · REV. 01</Eyebrow>
        <StatusDot level={health === "critical" ? "CRITICAL" : health === "risk" ? "URGENT" : "NOMINAL"} />
        <span className="micro ml-auto text-[8px] text-[var(--dim)]">{feed}</span>
        {sim && (
          <button
            type="button"
            onClick={sim.onToggle}
            className={cn(
              "micro text-[8px] border px-2 py-0.5 tracking-widest transition-colors",
              sim.running
                ? "border-[var(--medbay-risk)] text-[var(--medbay-risk)]"
                : "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black",
            )}
            aria-pressed={sim.running}
          >
            {sim.running ? `■ STOP · ${sim.inserts} INS` : "▶ RUN SIM"}
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-3 overflow-y-auto pr-1">
          {tiles.map((t) => (
            <VitalTile key={t.def.id} tile={t} onSelect={onSelect} health={health} />
          ))}
        </div>
        <GraphToggles mode={null} onMode={onDashboard} vertical />
      </div>
    </div>
  );
}
