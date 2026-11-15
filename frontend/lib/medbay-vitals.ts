/**
 * MEDBAY vitals tiles (spec §3, §6) mapped onto vitals the backend actually
 * reports (body-status `linked_vitals` + telemetry trends). Spec vitals with
 * no backend feed (height/weight, HRV, ECG, BrPM, VO2 max) are not fabricated —
 * their slots were reassigned to real telemetry (BMD, vision, suit pressure,
 * cabin CO2). See doc/front/medbay-design.md deferred list.
 */

import type {
  BodyZone,
  CrewMember,
  TelemetryIngestRequest,
  TelemetryMetric,
  TriageLevel,
  VitalReading,
} from "@/types/health";

export type VitalTileId =
  | "bmd"
  | "sleep"
  | "temp"
  | "spo2"
  | "hr"
  | "bp"
  | "glucose"
  | "radiation"
  | "vision"
  | "suit"
  | "co2";

export interface VitalTileDef {
  id: VitalTileId;
  title: string;
  /** Lower-case noun used in "Your temperature is high". */
  noun: string;
  keys: string[];
  unit: string;
  metric?: TelemetryMetric;
  ingestField?: keyof TelemetryIngestRequest;
  technicalOnly?: boolean;
  /**
   * Wording hint only: decides "high" vs "low" once the provider has already
   * flagged the reading. Risk itself always comes from the provider status.
   */
  band?: { low: number; high: number };
  decimals?: number;
}

export const VITAL_TILES: VitalTileDef[] = [
  {
    id: "bmd",
    title: "Bone density",
    noun: "bone density",
    keys: ["bone_mineral_density_t_score"],
    unit: "T",
    metric: "bone_density",
    ingestField: "bone_mineral_density_t_score",
    band: { low: -1.0, high: 1.5 },
    decimals: 1,
  },
  {
    id: "sleep",
    title: "Sleep avg",
    noun: "sleep average",
    keys: ["sleep_hours"],
    unit: "h",
    metric: "sleep",
    ingestField: "sleep_hours",
    band: { low: 6, high: 10 },
    decimals: 1,
  },
  {
    id: "temp",
    title: "Temperature",
    noun: "temperature",
    keys: ["core_temp_c"],
    unit: "°C",
    metric: "core_temp",
    ingestField: "core_temp_c",
    band: { low: 36, high: 37.5 },
    decimals: 1,
  },
  {
    id: "spo2",
    title: "Oxygen saturation",
    noun: "oxygen saturation",
    keys: ["spo2_percent"],
    unit: "%",
    metric: "spo2",
    ingestField: "spo2_percent",
    band: { low: 94, high: 100.1 },
  },
  {
    id: "hr",
    title: "Heart rate",
    noun: "heart rate",
    keys: ["heart_rate_bpm"],
    unit: "bpm",
    metric: "heart_rate",
    ingestField: "heart_rate_bpm",
    band: { low: 50, high: 100 },
  },
  {
    id: "bp",
    title: "Blood pressure",
    noun: "blood pressure",
    keys: ["systolic_bp_mmhg"],
    unit: "mmHg",
    metric: "systolic_bp",
    ingestField: "systolic_bp_mmhg",
    technicalOnly: true,
    band: { low: 90, high: 130 },
  },
  {
    id: "glucose",
    title: "Blood sugar",
    noun: "sugar levels",
    keys: ["blood_sugar_mg_dl", "glucose"],
    unit: "mg/dL",
    metric: "blood_sugar",
    ingestField: "blood_sugar_mg_dl",
    technicalOnly: true,
    band: { low: 70, high: 140 },
  },
  {
    id: "radiation",
    title: "Radiation",
    noun: "radiation dose",
    keys: ["radiation_dose_msv"],
    unit: "mSv",
    metric: "radiation",
    ingestField: "radiation_dose_msv",
    technicalOnly: true,
    decimals: 2,
  },
  {
    id: "vision",
    title: "Visual acuity",
    noun: "visual acuity",
    keys: ["visual_acuity_logmar"],
    unit: "logMAR",
    metric: "visual_acuity",
    ingestField: "visual_acuity_logmar",
    technicalOnly: true,
    band: { low: -0.1, high: 0.2 },
    decimals: 2,
  },
  {
    id: "suit",
    title: "Suit pressure",
    noun: "suit pressure",
    keys: ["suit_pressure_kpa"],
    unit: "kPa",
    metric: "suit_pressure",
    ingestField: "suit_pressure_kpa",
    technicalOnly: true,
    band: { low: 26, high: 33 },
    decimals: 1,
  },
  {
    id: "co2",
    title: "Cabin CO2",
    noun: "cabin CO2",
    keys: ["co2_partial_pressure_mmhg"],
    unit: "mmHg",
    metric: "cabin_co2",
    ingestField: "co2_partial_pressure_mmhg",
    technicalOnly: true,
    band: { low: 0, high: 6 },
    decimals: 1,
  },
];

export function tileDef(id: VitalTileId): VitalTileDef {
  return VITAL_TILES.find((t) => t.id === id)!;
}

export function readVital(zones: BodyZone[], keys: string[]): VitalReading | undefined {
  for (const k of keys) {
    for (const z of zones) {
      const v = z.vitals.find((x) => x.key === k);
      if (v) return v;
    }
  }
  return undefined;
}

export type Verdict = "ok" | "high" | "low" | "flagged" | "none";

export function vitalVerdict(def: VitalTileDef, reading: VitalReading | undefined): Verdict {
  if (!reading) return "none";
  if (reading.status === "NOMINAL") return "ok";
  if (def.band) {
    if (reading.value > def.band.high) return "high";
    if (reading.value < def.band.low) return "low";
  }
  return "flagged";
}

export function atRisk(v: Verdict) {
  return v === "high" || v === "low" || v === "flagged";
}

export function formatVital(def: VitalTileDef, reading: VitalReading | undefined): string {
  if (!reading) return "—";
  return reading.value.toFixed(def.decimals ?? 0);
}

/** "Your temperature is high" — spec single-vital headline. */
export function verdictSentence(def: VitalTileDef, v: Verdict): string {
  switch (v) {
    case "high":
      return `Your ${def.noun} is high`;
    case "low":
      return `Your ${def.noun} is low`;
    case "flagged":
      return `Your ${def.noun} needs attention`;
    case "ok":
      return `Your ${def.noun} is normal`;
    default:
      return `No ${def.noun} reading yet`;
  }
}

export interface TileState {
  def: VitalTileDef;
  reading?: VitalReading;
  verdict: Verdict;
}

export function tileStates(member: CrewMember | null, technical: boolean): TileState[] {
  const zones = member?.zones ?? [];
  return VITAL_TILES.filter((d) => technical || !d.technicalOnly).map((def) => {
    const reading = readVital(zones, def.keys);
    return { def, reading, verdict: vitalVerdict(def, reading) };
  });
}

export function worstLevel(levels: TriageLevel[]): TriageLevel {
  const order: TriageLevel[] = ["NOMINAL", "CAUTION", "URGENT", "CRITICAL"];
  return levels.reduce<TriageLevel>((w, l) => (order.indexOf(l) > order.indexOf(w) ? l : w), "NOMINAL");
}
