/**
 * Curated crew dataset for the mock provider.
 * Entity ≠ 3D model: each CrewMember declares zones whose `partIds` link
 * the data layer to selectable geometry in the procedural astronaut model.
 * All readings are simulated — never certified medical data.
 */

import type { BodyZone, CrewMember, VitalReading, ZoneId } from "@/types/health";

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
    head: ["helmet", "head"],
    chest: ["chest"],
    spine: ["spine"],
    gut: ["abdomen"],
    limbs: ["arm_l", "arm_r", "leg_l", "leg_r"],
    skin: ["visor", "plss", "collar"],
  };
  return { ...partial, partIds: partIds[partial.id] };
}

function baseZones(): BodyZone[] {
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
        vital("radiation_msv_hr", "Radiation", 0.021, "mSv/h", "NOMINAL", 5),
        vital("skin_temp", "Skin temp", 33.4, "°C", "NOMINAL", 8),
      ],
    }),
  ];
}

export const CREW: CrewMember[] = [
  {
    id: "AST-01",
    name: "Cmdr. Elena Voss",
    callsign: "VOSS",
    role: "Mission Commander",
    mission: "AURORA-9",
    subtitle: "PRIMARY SUBJECT / LONG-DURATION CREW",
    modelKind: "suit",
    description:
      "Expedition commander on day 142 of the AURORA-9 rotation. All monitored zones are tracking inside the mission reference envelope.",
    biometrics: [
      { label: "Height", value: "171", unit: "cm" },
      { label: "Body mass", value: "63.8", unit: "kg" },
      { label: "VO2 max", value: "44.2", unit: "mL/kg/min" },
      { label: "Resting HR", value: "58", unit: "bpm" },
      { label: "Blood type", value: "A-" },
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
    ],
    protocols: [
      { label: "Exercise", value: "ARED 90 min + T2 treadmill 45 min" },
      { label: "Sleep window", value: "21:30–06:00 UTC" },
      { label: "Fluid target", value: "2.5 L/day" },
      { label: "Med check", value: "Weekly ultrasound, monthly blood panel" },
    ],
    checks: [
      { label: "Last full panel", value: "SOL 138 — within reference" },
      { label: "Sensor sync", value: "OK — 6/6 zones streaming" },
      { label: "Suit fit check", value: "Due SOL 150" },
    ],
    insights: [
      {
        category: "Cardio",
        title: "HRV trending stable",
        description:
          "Heart-rate variability holds inside the crew baseline corridor; autonomic balance looks nominal for this mission phase.",
        zoneId: "chest",
      },
      {
        category: "Musculoskeletal",
        title: "Grip retention nominal",
        description:
          "Grip-strength retention at 96% of pre-flight baseline — consistent with the current countermeasure schedule.",
        zoneId: "limbs",
      },
    ],
    readiness: { score: 93, label: "MISSION READY" },
  },
  {
    id: "AST-02",
    name: "Dr. Marcus Reid",
    callsign: "REID",
    role: "Flight Surgeon / EVA Lead",
    mission: "AURORA-9",
    subtitle: "WATCH SUBJECT / POST-EVA RECOVERY",
    modelKind: "suit",
    description:
      "EVA lead recovering from yesterday's 7.2-hour excursion. Chest-zone telemetry is under watch — elevated heart rate with borderline saturation after the radiation-belt pass.",
    biometrics: [
      { label: "Height", value: "183", unit: "cm" },
      { label: "Body mass", value: "81.4", unit: "kg" },
      { label: "VO2 max", value: "47.9", unit: "mL/kg/min" },
      { label: "Resting HR", value: "62", unit: "bpm" },
      { label: "Blood type", value: "O+" },
    ],
    zones: baseZones().map((z) => {
      if (z.id === "chest") {
        return {
          ...z,
          status: "CAUTION" as const,
          vitals: [
            vital("heart_rate_bpm", "Heart rate", 128, "bpm", "CAUTION", 1),
            vital("spo2_percent", "SpO2", 93.6, "%", "CAUTION", 1),
            vital("systolic_bp_mmhg", "Systolic BP", 132, "mmHg", "CAUTION", 6),
          ],
        };
      }
      if (z.id === "limbs") {
        return {
          ...z,
          status: "CAUTION" as const,
          vitals: [
            vital("exertion", "Exertion", 78, "idx", "CAUTION", 4),
            vital("grip", "Grip strength", 88, "%", "NOMINAL", 240),
          ],
        };
      }
      return z;
    }),
    risks: [
      {
        name: "Post-EVA exertion debt",
        cause: "Extended suit work at 4.3 psi with heavy tool handling.",
        mitigation: "24h reduced-load schedule + hydration/electrolyte protocol.",
        zoneId: "limbs",
      },
      {
        name: "Borderline desaturation",
        cause: "Belt-pass exposure and elevated workload during EVA-3.",
        mitigation: "Re-check oximetry every 30 min; escalate if SpO2 < 90%.",
        zoneId: "chest",
      },
    ],
    protocols: [
      { label: "Recovery", value: "Light duty until SOL 144" },
      { label: "Oximetry", value: "Every 30 min while CAUTION persists" },
      { label: "Fluid target", value: "3.0 L/day + electrolytes" },
      { label: "Med check", value: "Daily until flags clear" },
    ],
    checks: [
      { label: "Last full panel", value: "SOL 141 — post-EVA draw" },
      { label: "Sensor sync", value: "OK — 6/6 zones streaming" },
      { label: "Suit fit check", value: "Completed SOL 140" },
    ],
    insights: [
      {
        category: "Cardio",
        title: "Elevated post-EVA heart rate",
        description:
          "Resting HR is tracking above the crew corridor after EVA-3. Consistent with exertion debt rather than a primary cardiac event in the simulated record.",
        zoneId: "chest",
      },
      {
        category: "Radiation",
        title: "Belt-pass dose logged",
        description:
          "The 11:40 belt pass added a measurable dose-rate spike; cumulative exposure remains inside the mission envelope.",
        zoneId: "skin",
      },
    ],
    readiness: { score: 71, label: "CONDITIONAL" },
  },
  {
    id: "AST-03",
    name: "Lt. Aiko Tanaka",
    callsign: "TANAKA",
    role: "Payload Specialist",
    mission: "AURORA-9",
    subtitle: "PRIMARY SUBJECT / SCIENCE OPS",
    modelKind: "suit",
    description:
      "Payload specialist running the materials-science rack. Gut-zone microbiome diversity is being watched after the diet transition last week.",
    biometrics: [
      { label: "Height", value: "162", unit: "cm" },
      { label: "Body mass", value: "55.1", unit: "kg" },
      { label: "VO2 max", value: "41.6", unit: "mL/kg/min" },
      { label: "Resting HR", value: "60", unit: "bpm" },
      { label: "Blood type", value: "B+" },
    ],
    zones: baseZones().map((z) =>
      z.id === "gut"
        ? {
            ...z,
            status: "CAUTION" as const,
            vitals: [
              vital("glucose", "Glucose", 104, "mg/dL", "NOMINAL", 30),
              vital("microbiome", "Microbiome div.", 0.68, "idx", "CAUTION", 480),
              vital("hydration", "Hydration", 88, "%", "NOMINAL", 45),
            ],
          }
        : z,
    ),
    risks: [
      {
        name: "Microbiome diversity dip",
        cause: "Diet transition to shelf-stable ration cycle B.",
        mitigation: "Prebiotic supplement + fresh-produce allotment priority.",
        zoneId: "gut",
      },
      {
        name: "Isolation mood load",
        cause: "Day-140+ crew monotony profile.",
        mitigation: "Scheduled comms window + leisure block rotation.",
        zoneId: "head",
      },
    ],
    protocols: [
      { label: "Exercise", value: "ARED 60 min + cycle 30 min" },
      { label: "Sleep window", value: "22:00–06:30 UTC" },
      { label: "Fluid target", value: "2.2 L/day" },
      { label: "Med check", value: "Standard weekly" },
    ],
    checks: [
      { label: "Last full panel", value: "SOL 139 — within reference" },
      { label: "Sensor sync", value: "OK — 6/6 zones streaming" },
      { label: "Suit fit check", value: "Due SOL 155" },
    ],
    insights: [
      {
        category: "Nutrition",
        title: "Diversity index recovering",
        description:
          "Microbiome diversity bottomed at 0.66 and is climbing since the prebiotic protocol started — keep the current ration mix.",
        zoneId: "gut",
      }
    ],
    readiness: { score: 88, label: "MISSION READY" },
  },
  {
    id: "AST-04",
    name: "Eng. Petr Novak",
    callsign: "NOVAK",
    role: "Systems Engineer",
    mission: "AURORA-9",
    subtitle: "ESCALATED SUBJECT / SUIT ANOMALY",
    modelKind: "suit",
    description:
      "Systems engineer flagged by the autonomous triage engine during the last telemetry pass — low suit-pressure reading and elevated dose rate on the suit layer.",
    biometrics: [
      { label: "Height", value: "188", unit: "cm" },
      { label: "Body mass", value: "92.0", unit: "kg" },
      { label: "VO2 max", value: "39.8", unit: "mL/kg/min" },
      { label: "Resting HR", value: "66", unit: "bpm" },
      { label: "Blood type", value: "AB+" },
    ],
    zones: baseZones().map((z) => {
      if (z.id === "skin") {
        return {
          ...z,
          status: "CRITICAL" as const,
          vitals: [
            vital("suit_pressure_kpa", "Suit pressure", 21.8, "kPa", "CRITICAL", 1),
            vital("radiation_msv_hr", "Radiation", 0.14, "mSv/h", "URGENT", 1),
            vital("skin_temp", "Skin temp", 35.1, "°C", "NOMINAL", 8),
          ],
        };
      }
      if (z.id === "chest") {
        return {
          ...z,
          status: "URGENT" as const,
          vitals: [
            vital("heart_rate_bpm", "Heart rate", 142, "bpm", "URGENT", 1),
            vital("spo2_percent", "SpO2", 91.8, "%", "URGENT", 1),
            vital("systolic_bp_mmhg", "Systolic BP", 148, "mmHg", "URGENT", 4),
          ],
        };
      }
      return z;
    }),
    risks: [
      {
        name: "Suit pressure leak",
        cause: "Sustained reading below 25 kPa on the suit-contact layer.",
        mitigation: "Emergency depressurization protocol — return to airlock.",
        zoneId: "skin",
      },
      {
        name: "Acute radiation exposure",
        cause: "Dose rate 7× above corridor during belt pass.",
        mitigation: "Shelter-in-storm-cell + dosimetry review.",
        zoneId: "skin",
      },
      {
        name: "Hypoxemia escalation",
        cause: "SpO2 trending toward 90% under elevated workload.",
        mitigation: "Verify O2 supply and mask seal; continuous oximetry.",
        zoneId: "chest",
      },
    ],
    protocols: [
      { label: "Duty status", value: "RESTRICTED — airlock standby" },
      { label: "Oximetry", value: "Continuous monitoring" },
      { label: "Suit check", value: "Full integrity inspection required" },
      { label: "Med check", value: "Immediate evaluation" },
    ],
    checks: [
      { label: "Last full panel", value: "SOL 142 — flagged" },
      { label: "Sensor sync", value: "DEGRADED — suit layer intermittent" },
      { label: "Suit fit check", value: "FAILED — pressure seal audit" },
    ],
    insights: [
      {
        category: "Environment",
        title: "Suit-loop anomaly",
        description:
          "The pressure drop is consistent with a small leak at the wrist-ring seal in the simulated record. The triage engine escalated this to CRITICAL.",
        zoneId: "skin",
      },
      {
        category: "Radiation",
        title: "Dose-rate excursion",
        description:
          "Belt-pass exposure peaked at 0.14 mSv/h. Cumulative mission dose is still inside the envelope, but EVA time should be restricted until reviewed.",
        zoneId: "skin",
      },
    ],
    readiness: { score: 34, label: "NOT CLEARED" },
  },
];

export function getCrewMember(id: string): CrewMember | undefined {
  return CREW.find((c) => c.id === id);
}

export const DEFAULT_CREW_ID = "AST-01";
