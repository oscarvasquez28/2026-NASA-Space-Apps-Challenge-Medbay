/**
 * Crew-member factory: enrolled console operators are the monitored crew.
 * Entity ≠ 3D model: each CrewMember declares zones whose `partIds` link
 * the data layer to selectable geometry in the procedural astronaut model.
 * All readings are simulated — never certified medical data.
 */

import type {
  BodyZone,
  CrewMember,
  LocalUser,
  VitalReading,
  ZoneId,
} from "@/types/health";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function vital(
  key: string,
  label: string,
  value: number,
  unit: string,
  status: VitalReading["status"] = "NOMINAL",
  minAgo = 2,
): VitalReading {
  return { key, label, value, unit, status, updatedAt: ago(minAgo) };
}

function zone(partial: Omit<BodyZone, "partIds"> & { id: ZoneId }): BodyZone {
  const partIds: Record<ZoneId, string[]> = {
    head: ["helmet", "head", "visor", "collar"],
    chest: ["chest"],
    spine: ["spine"],
    gut: ["abdomen"],
    limbs: ["arm_l", "arm_r", "leg_l", "leg_r"],
    // full-body skin layer under the suit + the PLSS (suit pressure loop)
    skin: ["skin_body", "plss"],
  };
  return { ...partial, partIds: partIds[partial.id] };
}

/** Shared nominal 6-zone anatomical template for every enrolled operator. */
export function baseZones(): BodyZone[] {
  return [
    zone({
      id: "head",
      name: "Head / Neuro",
      position: [0, 1.6, 0.16],
      description:
        "Helmet enclosure and cranial region — neuro-cognitive load and sleep-debt indicators.",
      status: "NOMINAL",
      vitals: [
        vital("hrv", "HRV", 64, "ms", "NOMINAL", 3),
        vital("sleep_debt", "Sleep debt", 1.2, "h", "NOMINAL", 90),
        vital("cog_load", "Cognitive load", 38, "idx"),
        vital("core_temp_c", "Core temp", 36.6, "°C"),
        vital("visual_acuity_logmar", "Visual acuity", 0.0, "logMAR"),
        vital("co2_partial_pressure_mmhg", "Cabin CO2", 3.0, "mmHg"),
      ],
    }),
    zone({
      id: "chest",
      name: "Chest / Cardio-respiratory",
      position: [0, 1.24, 0.17],
      description:
        "Thoracic region — heart rate, oxygen saturation and blood pressure telemetry.",
      status: "NOMINAL",
      vitals: [
        vital("heart_rate_bpm", "Heart rate", 71, "bpm"),
        vital("spo2_percent", "SpO2", 98.4, "%"),
        vital("systolic_bp_mmhg", "Systolic BP", 118, "mmHg", "NOMINAL", 7),
      ],
    }),
    zone({
      id: "spine",
      name: "Spine / Skeletal",
      position: [0, 1.18, -0.16],
      description:
        "Axial skeleton — microgravity deconditioning and posture-strain tracking.",
      status: "NOMINAL",
      vitals: [
        vital("spinal_load", "Spinal load", 24, "idx", "NOMINAL", 12),
        vital("bone_marker", "Bone turnover", 0.9, "idx", "NOMINAL", 60),
        vital("bone_mineral_density_t_score", "BMD T-score", -0.6, "T"),
      ],
    }),
    zone({
      id: "limbs",
      name: "Limbs / Musculoskeletal",
      position: [0.44, 1.02, 0.04],
      description:
        "Arms and legs — exertion, muscle fatigue and grip-strength retention.",
      status: "NOMINAL",
      vitals: [
        vital("exertion", "Exertion", 41, "idx"),
        vital("grip", "Grip strength", 96, "%", "NOMINAL", 240),
        vital("sleep_hours", "Sleep duration", 7.5, "h"),
      ],
    }),
    zone({
      id: "gut",
      name: "Gut / Microbiome",
      position: [0, 0.97, 0.15],
      description:
        "Abdominal region — glucose, hydration and microbiome diversity markers.",
      status: "NOMINAL",
      vitals: [
        vital("blood_sugar_mg_dl", "Blood glucose", 92, "mg/dL", "NOMINAL", 30),
        vital("glucose", "Glucose", 92, "mg/dL", "NOMINAL", 30),
        vital("microbiome", "Microbiome div.", 0.82, "idx", "NOMINAL", 480),
        vital("hydration", "Hydration", 91, "%", "NOMINAL", 45),
      ],
    }),
    zone({
      id: "skin",
      name: "Skin / Suit layer",
      position: [0, 1.3, -0.34],
      description:
        "Dermal surface and suit-contact layer — pressure, radiation and surface temperature.",
      status: "NOMINAL",
      vitals: [
        vital("suit_pressure_kpa", "Suit pressure", 29.6, "kPa"),
        vital("radiation_dose_msv", "Radiation dose", 0.5, "mSv", "NOMINAL", 5),
        vital("radiation_msv_hr", "Radiation", 0.021, "mSv/h", "NOMINAL", 5),
        vital("skin_temp", "Skin temp", 33.4, "°C", "NOMINAL", 8),
      ],
    }),
  ];
}

export const OPERATOR_MISSION = "AURORA-9";

const OPERATOR_ROLES: Record<LocalUser["role"], string> = {
  medic: "Flight Surgeon",
  user: "Mission Crew",
};

/**
 * Build the monitored CrewMember for an enrolled operator. Zones start on the
 * shared nominal baseline — the provider merges live `body-status` on top, so
 * readings stay nominal until real telemetry lands under `astronautId`.
 */
export function crewMemberFromOperator(user: LocalUser): CrewMember {
  const enrolled = new Date(user.createdAt);
  const enrolledLabel = Number.isNaN(enrolled.getTime())
    ? "—"
    : enrolled.toISOString().slice(0, 10);
  return {
    id: user.astronautId,
    name: user.name,
    callsign: (user.callsign ?? user.name).toUpperCase(),
    role: OPERATOR_ROLES[user.role] ?? "Mission Crew",
    mission: OPERATOR_MISSION,
    subtitle: "ENROLLED OPERATOR / VISUAL-ID CREW",
    modelKind: "suit",
    description: `${OPERATOR_ROLES[user.role] ?? "Mission crew"} enrolled via visual-ID check-in aboard ${OPERATOR_MISSION}. Zone telemetry syncs from the triage engine — readings hold at the nominal baseline until sensor data arrives under ${user.astronautId}.`,
    biometrics: [
      { label: "Operator ID", value: user.astronautId },
      { label: "Enrolled", value: enrolledLabel },
      { label: "Clearance", value: user.role.toUpperCase() },
    ],
    zones: baseZones(),
    risks: [
      {
        name: "Microgravity bone loss",
        cause: "Sustained 0g load removal on the axial skeleton.",
        mitigation: "ARED resistance block daily + bisphosphonate protocol.",
        zoneId: "spine",
      },
      {
        name: "Cardiovascular deconditioning",
        cause: "Fluid shift and reduced orthostatic demand.",
        mitigation: "Lower-body negative pressure sessions twice weekly.",
        zoneId: "chest",
      },
      {
        name: "Cumulative radiation dose",
        cause: "Galactic cosmic ray background accumulates over the rotation.",
        mitigation: "Dosimetry review each SOL; storm-shelter protocol on belt passes.",
        zoneId: "skin",
      },
    ],
    protocols: [
      { label: "Exercise", value: "ARED 90 min + treadmill 45 min daily" },
      { label: "Sleep window", value: "8 h circadian block, visor dark cycle" },
      { label: "Fluid target", value: "2.5 L/day + electrolytes" },
      { label: "Check-in", value: "Daily visual-ID confirmation required" },
    ],
    checks: [
      { label: "Enrollment", value: `${enrolledLabel} — face credential on file` },
      { label: "Sensor sync", value: "Awaiting first telemetry pass" },
      { label: "Suit fit check", value: "Due at first EVA assignment" },
    ],
    insights: [],
    readiness: { score: 100, label: "MISSION READY" },
    facePhoto: user.facePhoto,
  };
}

export function crewFromOperators(users: LocalUser[]): CrewMember[] {
  return users.map(crewMemberFromOperator);
}
