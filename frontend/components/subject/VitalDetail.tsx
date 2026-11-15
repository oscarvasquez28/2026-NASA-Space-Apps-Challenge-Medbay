"use client";

/**
 * Single vital view (spec §6, ASTRONAUT VIEW - RISK - AI OPTIONS): title +
 * status, current value, graph with globe/eye toggles. When no live feed is
 * present the value can be entered manually (POST /api/v1/telemetry/ingest).
 */

import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProvider } from "@/hooks/useProvider";
import {
  atRisk,
  formatVital,
  readVital,
  type TileState,
  type VitalTileId,
  verdictSentence,
} from "@/lib/medbay-vitals";
import { cn } from "@/lib/utils";
import type { BodyZone, TelemetryIngestRequest } from "@/types/health";
import { type GraphMode, VitalGraph } from "./VitalGraph";
import { GraphToggles, TILE_ICON } from "./VitalTiles";

/** Zone anchor (x,y in the 240×300 figure viewBox) each vital belongs to. */
const TILE_ZONE_POINT: Record<VitalTileId, [number, number]> = {
  bmd: [140, 140],
  sleep: [198, 160],
  temp: [140, 46],
  spo2: [140, 104],
  hr: [140, 104],
  bp: [140, 104],
  glucose: [140, 158],
  radiation: [186, 96],
  vision: [140, 46],
  suit: [186, 96],
  co2: [140, 46],
};

/**
 * Technical astronaut figure crossing the chart (same geometry as the 2D
 * WebGL fallback), with a callout ring on the zone the vital belongs to.
 */
function GraphFigure({ tileId }: { tileId: VitalTileId }) {
  const [zx, zy] = TILE_ZONE_POINT[tileId];
  return (
    <svg
      viewBox="0 0 240 300"
      aria-hidden
      className="pointer-events-none absolute right-10 top-1/2 h-[138%] -translate-y-1/2"
      style={{ opacity: 0.3 }}
    >
      <g fill="none" stroke="var(--accent)" strokeWidth="1.4">
        <line x1="30" y1="20" x2="30" y2="280" opacity="0.6" />
        <line x1="26" y1="20" x2="34" y2="20" opacity="0.6" />
        <line x1="26" y1="280" x2="34" y2="280" opacity="0.6" />
        <circle cx="140" cy="46" r="24" />
        <ellipse cx="140" cy="120" rx="34" ry="52" />
        <line x1="140" y1="70" x2="140" y2="168" strokeDasharray="4 3" />
        <line x1="106" y1="92" x2="82" y2="160" />
        <line x1="174" y1="92" x2="198" y2="160" />
        <line x1="128" y1="172" x2="122" y2="250" />
        <line x1="152" y1="172" x2="158" y2="250" />
        <rect x="172" y="90" width="22" height="40" transform="skewY(-4)" />
      </g>
      <circle cx={zx} cy={zy} r="6" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      <circle cx={zx} cy={zy} r="12" fill="none" stroke="var(--accent)" strokeDasharray="3 3" opacity="0.75" />
    </svg>
  );
}

export function VitalDetail({
  tile,
  crewId,
  zones,
  mode,
  onMode,
  onBack,
  onSaved,
}: {
  tile: TileState;
  crewId: string | undefined;
  zones: BodyZone[];
  mode: GraphMode;
  onMode: (m: GraphMode) => void;
  onBack: () => void;
  onSaved: () => void;
}) {
  const provider = useProvider();
  const Icon = TILE_ICON[tile.def.id];
  const risky = atRisk(tile.verdict);
  const live = Boolean(tile.reading);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    const value = Number.parseFloat(draft);
    if (!provider || !crewId || !tile.def.ingestField || !Number.isFinite(value)) return;
    const hr = tile.def.id === "hr" ? value : (readVital(zones, ["heart_rate_bpm"])?.value ?? 70);
    const payload = {
      astronaut_id: crewId,
      heart_rate_bpm: hr,
      [tile.def.ingestField]: value,
      symptoms: [],
    } as TelemetryIngestRequest;
    setSaving(true);
    setMsg(null);
    try {
      await provider.ingestTelemetry(payload);
      setDraft("");
      setMsg("Saved — vitals refreshed.");
      onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Manual entry failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-3 p-4",
        risky ? "bg-[color-mix(in_srgb,var(--medbay-risk)_22%,black)]" : "bg-[var(--panel-tint)]",
      )}
    >
      <div className={cn("medbay-surface flex flex-1 flex-col gap-3 p-4", risky && "medbay-surface-risk")}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Back to vitals" className="hover:text-state">
            <ArrowLeft size={18} />
          </button>
          <Icon size={30} className={risky ? "text-risk" : undefined} />
          <h2 className="medbay-display flex-1 text-lg">{verdictSentence(tile.def, tile.verdict)}</h2>
          <GraphToggles mode={mode} onMode={onMode} />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_auto] gap-4">
          <div className="relative min-h-[180px] overflow-hidden border border-input bg-black/40 p-2">
            <VitalGraph crewId={crewId} metric={tile.def.metric} mode={mode} />
            <GraphFigure tileId={tile.def.id} />
          </div>
          <div className="flex w-36 flex-col items-end justify-between gap-3">
            <div className={cn("medbay-display text-right text-xl", risky ? "text-risk" : "text-foreground")}>
              {formatVital(tile.def, tile.reading)} {tile.def.unit}
            </div>
            {tile.def.ingestField && (
              <form
                className="flex w-full flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <label className="medbay-micro text-foreground/70" htmlFor="manual-vital">
                  {live ? "Live feed · override" : "No live feed · enter value"}
                </label>
                <Input
                  id="manual-vital"
                  inputMode="decimal"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={tile.def.unit}
                />
                <Button type="submit" size="sm" variant="outline" disabled={saving || !draft.trim()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                {msg && <span className="medbay-micro text-foreground/70">{msg}</span>}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
