/**
 * Curated procedural organ atlas — drill-down anatomy for the explorer.
 * Shared across all crew members (anatomy is static); an organ's triage
 * status is inherited at render time from the parent BodyZone of the
 * member being viewed. Positions are MODEL-LOCAL (inside the astronaut
 * group at MODEL_GROUP_OFFSET). All simulated — not a medical device.
 */

import type { Organ, VitalReading } from "@/types/health";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function vital(
  key: string,
  label: string,
  value: number,
  unit: string,
  status: VitalReading["status"] = "NOMINAL",
  minAgo = 4,
): VitalReading {
  return { key, label, value, unit, status, updatedAt: ago(minAgo) };
}

export const ORGANS: Organ[] = [
  /* -------------------------------- head -------------------------------- */
  {
    id: "brain",
    name: "Brain / CNS",
    zoneId: "head",
    position: [0, 1.5, 0.01],
    geo: { kind: "sphere", args: [0.078, 20, 16] },
    scale: [1, 0.82, 0.94],
    description:
      "Cranial vault — neuro-cognitive load, sleep pressure and intracranial fluid-shift markers.",
    vitals: [
      vital("cog_load", "Cognitive load", 38, "idx"),
      vital("icp_shift", "Fluid shift", 0.4, "idx", "NOMINAL", 30),
    ],
  },
  {
    id: "eye_l",
    name: "Left eye",
    zoneId: "head",
    position: [-0.045, 1.52, 0.082],
    geo: { kind: "sphere", args: [0.02, 14, 10] },
    description:
      "Ocular globe — SANS (spaceflight neuro-ocular syndrome) watch item; visual acuity and intraocular pressure.",
    vitals: [vital("iop", "Intraocular P", 13.1, "mmHg", "NOMINAL", 120)],
  },
  {
    id: "eye_r",
    name: "Right eye",
    zoneId: "head",
    position: [0.045, 1.52, 0.082],
    geo: { kind: "sphere", args: [0.02, 14, 10] },
    description:
      "Ocular globe — paired SANS monitor; fundoscopic scans in the weekly panel.",
    vitals: [vital("iop", "Intraocular P", 13.4, "mmHg", "NOMINAL", 120)],
  },

  /* -------------------------------- chest ------------------------------- */
  {
    id: "heart",
    name: "Heart",
    zoneId: "chest",
    position: [-0.035, 1.2, 0.045],
    geo: { kind: "sphere", args: [0.052, 20, 16] },
    scale: [0.88, 1.12, 0.9],
    description:
      "Cardiac muscle — rate, rhythm and stroke-volume surrogate from the suit ECG/PPG loop.",
    vitals: [
      vital("heart_rate_bpm", "Heart rate", 71, "bpm"),
      vital("hrv", "HRV", 64, "ms", "NOMINAL", 3),
    ],
  },
  {
    id: "lung_l",
    name: "Left lung",
    zoneId: "chest",
    position: [-0.075, 1.2, 0.005],
    geo: { kind: "sphere", args: [0.068, 18, 14] },
    scale: [0.72, 1.08, 0.78],
    description:
      "Left pulmonary field — tidal volume and SpO2 uptake tracked via the respiratory band.",
    vitals: [vital("resp_rate", "Resp rate", 13.2, "brpm")],
  },
  {
    id: "lung_r",
    name: "Right lung",
    zoneId: "chest",
    position: [0.075, 1.2, 0.005],
    geo: { kind: "sphere", args: [0.068, 18, 14] },
    scale: [0.72, 1.08, 0.78],
    description:
      "Right pulmonary field — paired with SpO2 telemetry and cabin-CO2 exposure logs.",
    vitals: [vital("resp_rate", "Resp rate", 13.2, "brpm")],
  },

  /* -------------------------------- spine ------------------------------- */
  {
    id: "vert_c",
    name: "Cervical spine",
    zoneId: "spine",
    position: [0, 1.32, -0.15],
    geo: { kind: "cylinder", args: [0.028, 0.028, 0.075, 10] },
    description:
      "Neck segment — posture-strain markers from helmet mass and monitor posture.",
    vitals: [vital("posture_idx", "Posture strain", 22, "idx", "NOMINAL", 60)],
  },
  {
    id: "vert_t",
    name: "Thoracic spine",
    zoneId: "spine",
    position: [0, 1.14, -0.155],
    geo: { kind: "cylinder", args: [0.03, 0.03, 0.08, 10] },
    description:
      "Mid-back segment — axial load distribution under suit and PLSS mass.",
    vitals: [vital("spinal_load", "Spinal load", 24, "idx", "NOMINAL", 12)],
  },
  {
    id: "vert_l",
    name: "Lumbar spine",
    zoneId: "spine",
    position: [0, 0.96, -0.145],
    geo: { kind: "cylinder", args: [0.032, 0.032, 0.08, 10] },
    description:
      "Lower-back segment — primary microgravity deconditioning site; disc-height loss tracked weekly.",
    vitals: [
      vital("disc_height", "Disc height", 96.8, "%", "NOMINAL", 1440),
      vital("bone_marker", "Bone turnover", 0.9, "idx", "NOMINAL", 60),
    ],
  },

  /* -------------------------------- limbs ------------------------------- */
  {
    id: "bicep_l",
    name: "Left biceps",
    zoneId: "limbs",
    position: [-0.27, 1.18, 0.02],
    rotation: [0, 0, 0.28],
    geo: { kind: "capsule", args: [0.026, 0.09, 4, 10] },
    description:
      "Upper-arm musculature — EMG-derived exertion and atrophy retention vs pre-flight baseline.",
    vitals: [vital("emg_tone", "EMG tone", 88, "%", "NOMINAL", 20)],
  },
  {
    id: "bicep_r",
    name: "Right biceps",
    zoneId: "limbs",
    position: [0.27, 1.18, 0.02],
    rotation: [0, 0, -0.28],
    geo: { kind: "capsule", args: [0.026, 0.09, 4, 10] },
    description:
      "Upper-arm musculature — dominant-arm load profile from EVA tool handling.",
    vitals: [vital("emg_tone", "EMG tone", 91, "%", "NOMINAL", 20)],
  },
  {
    id: "femur_l",
    name: "Left femur",
    zoneId: "limbs",
    position: [-0.09, 0.55, 0],
    geo: { kind: "capsule", args: [0.02, 0.24, 4, 10] },
    description:
      "Load-bearing long bone — bone-density decline is the canonical 0g risk; DEXA surrogate index.",
    vitals: [vital("bmd_idx", "Bone density", 93.5, "%", "NOMINAL", 2880)],
  },
  {
    id: "femur_r",
    name: "Right femur",
    zoneId: "limbs",
    position: [0.09, 0.55, 0],
    geo: { kind: "capsule", args: [0.02, 0.24, 4, 10] },
    description:
      "Load-bearing long bone — paired density index feeding the deconditioning model.",
    vitals: [vital("bmd_idx", "Bone density", 93.8, "%", "NOMINAL", 2880)],
  },

  /* --------------------------------- gut -------------------------------- */
  {
    id: "stomach",
    name: "Stomach",
    zoneId: "gut",
    position: [-0.045, 0.98, 0.04],
    geo: { kind: "sphere", args: [0.052, 16, 12] },
    scale: [0.78, 1, 1.12],
    description:
      "Gastric chamber — motility and appetite markers under altered fluid distribution.",
    vitals: [vital("appetite", "Appetite idx", 82, "idx", "NOMINAL", 360)],
  },
  {
    id: "liver",
    name: "Liver",
    zoneId: "gut",
    position: [0.045, 1.0, 0.04],
    geo: { kind: "sphere", args: [0.058, 16, 12] },
    scale: [1.18, 0.68, 0.78],
    description:
      "Hepatic mass — metabolic panel surrogate; processes ration-cycle nutrients and medications.",
    vitals: [vital("alt_idx", "ALT surrogate", 24, "U/L", "NOMINAL", 720)],
  },
  {
    id: "gut_loop",
    name: "Intestinal loop",
    zoneId: "gut",
    position: [0, 0.88, 0.035],
    rotation: [Math.PI / 2.4, 0, 0],
    geo: { kind: "torus", args: [0.048, 0.016, 10, 22] },
    description:
      "Small-intestine segment — microbiome diversity sampling site for the diet-transition study.",
    vitals: [vital("microbiome", "Microbiome div.", 0.82, "idx", "NOMINAL", 480)],
  },

  /* --------------------------------- skin ------------------------------- */
  {
    id: "dermis",
    name: "Dermal layer (abdomen)",
    zoneId: "skin",
    position: [0, 1.0, 0.128],
    rotation: [Math.PI / 2, 0, 0],
    geo: { kind: "cylinder", args: [0.048, 0.048, 0.012, 16] },
    description:
      "Skin-contact patch — surface temperature, pressure-chafe and suit-contact integrity.",
    vitals: [vital("skin_temp", "Skin temp", 33.4, "°C", "NOMINAL", 8)],
  },
  {
    id: "dermis_arm",
    name: "Dermal layer (forearm)",
    zoneId: "skin",
    position: [-0.3, 0.93, 0.045],
    rotation: [Math.PI / 2, 0, 0.28],
    geo: { kind: "cylinder", args: [0.032, 0.032, 0.01, 14] },
    description:
      "Forearm patch — radiation-dose film-badge analogue plus micro-abrasion watch after EVA.",
    vitals: [
      vital("radiation_msv_hr", "Dose rate", 0.021, "mSv/h", "NOMINAL", 5),
    ],
  },
];

export function organsOf(zoneId: string | null): Organ[] {
  if (!zoneId) return [];
  return ORGANS.filter((o) => o.zoneId === zoneId);
}

export function getOrgan(id: string | null): Organ | undefined {
  if (!id) return undefined;
  return ORGANS.find((o) => o.id === id);
}
