"use client";

/**
 * Location tile (spec §10): small 3D model of the location + its name.
 * The location is detected automatically (GET /context/location); the user
 * can toggle Station / Ship / Ground. When the choice differs from what the
 * app detected, the tile stroke turns red. Toggling re-themes the console.
 */

import dynamic from "next/dynamic";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LOCATION_IDS, LOCATION_THEME } from "@/data/mission";
import { useLocationTheme } from "@/hooks/useLocationTheme";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

const LocationMiniCanvas = dynamic(() => import("@/components/three/environments/LocationMiniCanvas"), {
  ssr: false,
});

export function LocationTile({ size = 160, className }: { size?: number; className?: string }) {
  const { chosen, detected, mismatch, choose, followDetected } = useLocationTheme();
  const hydrated = useAppStore((s) => s.hydrated);
  const theme = LOCATION_THEME[chosen];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex flex-col border-2 bg-black text-left transition-colors",
            mismatch ? "border-critical" : "border-input hover:border-highlight",
            className,
          )}
          style={{ width: size, height: size }}
          aria-label={`Location: ${theme.tile}${mismatch ? " (differs from detected location)" : ""}. Change location`}
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 z-[5] h-10 bg-gradient-to-b from-black/80 to-transparent"
          />
          <span className="medbay-micro absolute left-2 top-1.5 z-10 max-w-[85%] text-[10px] leading-tight">
            {theme.tile}
          </span>
          <span className="absolute inset-0">{hydrated && <LocationMiniCanvas location={chosen} />}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60">
        <div className="medbay-micro mb-2 text-foreground/70">Location</div>
        <div className="grid grid-cols-3 gap-1">
          {LOCATION_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              className={cn(
                "border px-1 py-2 font-display text-[10px] uppercase",
                id === chosen ? "border-highlight bg-highlight text-white" : "border-input hover:border-highlight",
              )}
              style={id === chosen ? undefined : { color: `var(--medbay-${id === "station" ? "station" : id === "spacecraft" ? "ship" : "ground"})` }}
            >
              {LOCATION_THEME[id].group}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-foreground/80">
          Detected: <b>{LOCATION_THEME[detected].tile}</b>
          {mismatch && (
            <>
              <br />
              <span className="text-critical">Your choice differs from the detected location.</span>{" "}
              <button type="button" className="underline hover:text-highlight" onClick={followDetected}>
                Use detected
              </button>
            </>
          )}
        </p>
      </PopoverContent>
    </Popover>
  );
}
