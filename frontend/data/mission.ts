/**
 * Mission context datasets: location profiles, mission clock, telemetry events.
 * All values are curated/simulated — owned by the mock provider.
 */

import type { LocationId, LocationProfile, MissionEvent } from "@/types/health";

export const MISSION_DAY = 142;
export const MISSION_NAME = "AURORA-9 · ISS EXPEDITION";

export const LOCATION_PROFILES: LocationProfile[] = [
  {
    id: "station",
    label: "International Station",
    commLatencySec: 0.6,
    blackoutRisk: "LOW",
    linkMode: "advisory",
    hazards: { radiation: 0.35, isolation: 0.4, gravity: 0.85, workload: 0.5 },
  },
  {
    id: "spacecraft",
    label: "Artemis II",
    commLatencySec: 4.2,
    blackoutRisk: "MEDIUM",
    linkMode: "advisory",
    hazards: { radiation: 0.6, isolation: 0.55, gravity: 0.95, workload: 0.45 },
  },
  {
    id: "mars",
    label: "Mars",
    commLatencySec: 272,
    blackoutRisk: "HIGH",
    linkMode: "local",
    hazards: { radiation: 0.8, isolation: 0.95, gravity: 0.5, workload: 0.7 },
  },
];

export const DEFAULT_LOCATION: LocationId = "station";

/** MEDBAY theme metadata per location (logo subtitle, toggle label, gravity). */
export const LOCATION_THEME: Record<
  LocationId,
  { care: string; group: "Station" | "Ship" | "Ground"; tile: string; gravity: number }
> = {
  station: { care: "STATION CARE", group: "Station", tile: "International Station", gravity: 0 },
  spacecraft: { care: "SHIP CARE", group: "Ship", tile: "Artemis II", gravity: 0 },
  mars: { care: "GROUND CARE", group: "Ground", tile: "Mars", gravity: 0.38 },
};

export const LOCATION_IDS: LocationId[] = ["station", "spacecraft", "mars"];

export function getLocationProfile(id: LocationId): LocationProfile {
  return (
    LOCATION_PROFILES.find((l) => l.id === id) ??
    LOCATION_PROFILES.find((l) => l.id === DEFAULT_LOCATION)!
  );
}

/** Curated mission events overlaid on the last 24h of telemetry. */
export function missionEvents(now: Date): MissionEvent[] {
  const at = (hoursAgo: number) =>
    new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();
  return [
    { t: at(22), label: "SLEEP PERIOD", kind: "sleep" },
    { t: at(14), label: "EVA-3 WINDOW", kind: "eva" },
    { t: at(11.5), label: "RADIATION BELT PASS", kind: "radiation" },
    { t: at(8), label: "GRAVITY TRANSITION SIM", kind: "gravity" },
    { t: at(4), label: "EXERCISE BLOCK", kind: "exercise" },
  ];
}
