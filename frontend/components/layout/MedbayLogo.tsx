"use client";

import { LogoGroundIcon, LogoShipIcon, LogoStationIcon } from "@/components/icons/medbay";
import type { LocationId } from "@/types/health";

const LOGOS = {
  station: LogoStationIcon,
  spacecraft: LogoShipIcon,
  mars: LogoGroundIcon,
} as const;

/** MEDBAY wordmark — subtitle (STATION / SHIP / GROUND CARE) follows location. */
export function MedbayLogo({
  location,
  size = 34,
  className,
}: {
  location: LocationId;
  size?: number;
  className?: string;
}) {
  const Logo = LOGOS[location];
  // The logo keeps the location highlight even in critical state (spec §5).
  return (
    <Logo
      size={size}
      className={className}
      style={{ color: "var(--highlight)" }}
      role="img"
      aria-label={`MEDBAY ${location}`}
    />
  );
}
