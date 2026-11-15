/**
 * Curated procedural organ atlas — drill-down anatomy for the explorer.
 * Shared across all crew members (anatomy is static); an organ's triage
 * status is inherited at render time from the parent BodyZone of the
 * member being viewed. Positions are MODEL-LOCAL (inside the astronaut
 * group at MODEL_GROUP_OFFSET); meshes come from
 * components/three/organ-geometry.ts. The model faces +z, so patient-left
 * is +x (`side: 1`). All simulated — not a medical device.
 */

import type { BodyZone, Organ, TriageLevel, VitalReading } from "@/types/health";
import { TRIAGE_LEVELS } from "@/types/health";

import { ARM_ABDUCTION, armPoint, HIP_X } from "./suit-rig";

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

/** Limb anatomy rides the suit rig (data/suit-rig.ts) so it always sits
 * inside the arm/leg shells. */

export const ORGANS: Organ[] = [
  /* -------------------------------- head -------------------------------- */
  {
    id: "brain",
    name: "Brain / CNS",
    zoneId: "head",
    position: [0, 1.515, 0],
    shape: "brain",
    focusDistance: 0.5,
    description:
      "Cerebrum, cerebellum and brainstem — neuro-cognitive load, sleep pressure and intracranial fluid-shift markers.",
    vitals: [
      vital("cog_load", "Cognitive load", 38, "idx"),
      vital("icp_shift", "Fluid shift", 0.4, "idx", "NOMINAL", 30),
      vital("sleep_pressure", "Sleep pressure", 31, "idx", "NOMINAL", 45),
    ],
  },
  {
    id: "eye_l",
    name: "Left eye",
    zoneId: "head",
    side: 1,
    position: [0.033, 1.497, 0.083],
    shape: "eye",
    focusDistance: 0.2,
    description:
      "Ocular globe, optic nerve and extra-ocular muscles — SANS (spaceflight neuro-ocular syndrome) watch item.",
    vitals: [
      vital("iop", "Intraocular P", 13.1, "mmHg", "NOMINAL", 120),
      vital("acuity", "Visual acuity", 1.0, "dec", "NOMINAL", 1440),
    ],
  },
  {
    id: "eye_r",
    name: "Right eye",
    zoneId: "head",
    side: -1,
    position: [-0.033, 1.497, 0.083],
    shape: "eye",
    focusDistance: 0.2,
    description:
      "Ocular globe — paired SANS monitor; choroidal folds checked in the weekly fundoscopic scan.",
    vitals: [
      vital("iop", "Intraocular P", 13.4, "mmHg", "NOMINAL", 120),
      vital("acuity", "Visual acuity", 1.0, "dec", "NOMINAL", 1440),
    ],
  },

  /* -------------------------------- chest ------------------------------- */
  {
    id: "heart",
    name: "Heart",
    zoneId: "chest",
    position: [0.022, 1.16, 0.048],
    shape: "heart",
    anim: "heartbeat",
    focusDistance: 0.5,
    description:
      "Four-chamber myocardium with aortic arch, pulmonary trunk and coronary vessels — rate, rhythm and stroke-volume surrogate from the suit ECG/PPG loop.",
    vitals: [
      vital("heart_rate_bpm", "Heart rate", 71, "bpm"),
      vital("hrv", "HRV", 64, "ms", "NOMINAL", 3),
      vital("systolic_bp_mmhg", "Systolic BP", 118, "mmHg", "NOMINAL", 15),
    ],
  },
  {
    id: "lung_l",
    name: "Left lung",
    zoneId: "chest",
    side: 1,
    position: [0.08, 1.2, -0.012],
    shape: "lung",
    anim: "breath",
    focusDistance: 0.62,
    description:
      "Two-lobe left lung with cardiac notch and oblique fissure — tidal volume and SpO2 uptake via the respiratory band.",
    vitals: [
      vital("resp_rate", "Resp rate", 13.2, "brpm"),
      vital("spo2_percent", "SpO2", 98, "%", "NOMINAL", 2),
    ],
  },
  {
    id: "lung_r",
    name: "Right lung",
    zoneId: "chest",
    side: -1,
    position: [-0.08, 1.2, -0.012],
    shape: "lung",
    anim: "breath",
    focusDistance: 0.62,
    description:
      "Three-lobe right lung (oblique + horizontal fissures) — paired with SpO2 telemetry and cabin-CO2 exposure logs.",
    vitals: [
      vital("resp_rate", "Resp rate", 13.2, "brpm"),
      vital("co2_exposure", "Cabin CO2", 2.6, "mmHg", "NOMINAL", 10),
    ],
  },
  {
    id: "trachea",
    name: "Trachea / bronchi",
    zoneId: "chest",
    position: [0, 1.3, -0.012],
    shape: "trachea",
    focusDistance: 0.45,
    description:
      "Cartilage-ringed airway branching into the lobar bronchi — airway resistance proxy from the suit mic + flow sensor.",
    vitals: [vital("airway_res", "Airway resist.", 1.6, "cmH2O/L/s", "NOMINAL", 30)],
  },
  {
    id: "esophagus",
    name: "Esophagus",
    zoneId: "chest",
    position: [0, 1.2, -0.048],
    shape: "esophagus",
    focusDistance: 0.68,
    description:
      "Muscular food tube behind the trachea — reflux and swallow-transit markers under microgravity fluid shift.",
    vitals: [vital("reflux_idx", "Reflux idx", 0.12, "idx", "NOMINAL", 240)],
  },
  {
    id: "diaphragm",
    name: "Diaphragm",
    zoneId: "chest",
    position: [0, 1.075, -0.005],
    shape: "diaphragm",
    anim: "breath",
    focusDistance: 0.72,
    description:
      "Dome-shaped respiratory muscle with central tendon — excursion amplitude drives the tidal-volume estimate.",
    vitals: [vital("excursion", "Excursion", 4.1, "cm", "NOMINAL", 6)],
  },

  /* -------------------------------- spine ------------------------------- */
  {
    id: "vert_c",
    name: "Cervical spine (C3–C7)",
    zoneId: "spine",
    position: [0, 1.33, -0.018],
    shape: "spine_cervical",
    focusDistance: 0.4,
    description:
      "Neck vertebrae with discs and neural arches — posture strain from helmet mass and monitor posture.",
    vitals: [vital("posture_idx", "Posture strain", 22, "idx", "NOMINAL", 60)],
  },
  {
    id: "vert_t",
    name: "Thoracic spine (T3–T10)",
    zoneId: "spine",
    position: [0, 1.16, -0.08],
    shape: "spine_thoracic",
    focusDistance: 0.6,
    description:
      "Mid-back column — axial load distribution under suit and PLSS mass; kyphosis tracked from IMU posture.",
    vitals: [vital("spinal_load", "Spinal load", 24, "idx", "NOMINAL", 12)],
  },
  {
    id: "vert_l",
    name: "Lumbar spine (L1–L5)",
    zoneId: "spine",
    position: [0, 0.985, -0.075],
    shape: "spine_lumbar",
    focusDistance: 0.5,
    description:
      "Lower-back segment — primary microgravity deconditioning site; disc-height loss tracked weekly.",
    vitals: [
      vital("disc_height", "Disc height", 96.8, "%", "NOMINAL", 1440),
      vital("bone_marker", "Bone turnover", 0.9, "idx", "NOMINAL", 60),
    ],
  },
  {
    id: "pelvis",
    name: "Pelvis / sacrum",
    zoneId: "spine",
    position: [0, 0.82, -0.055],
    shape: "pelvis",
    focusDistance: 0.62,
    description:
      "Iliac wings, sacrum and pubic ring — load path to the femoral heads; trabecular density from DEXA surrogate.",
    vitals: [vital("bmd_idx", "Bone density", 95.1, "%", "NOMINAL", 2880)],
  },

  /* -------------------------------- limbs ------------------------------- */
  {
    id: "biceps_l",
    name: "Left upper arm",
    zoneId: "limbs",
    side: 1,
    position: armPoint(1, -0.13, 0.03),
    rotation: [0, 0, ARM_ABDUCTION],
    shape: "biceps",
    focusDistance: 0.5,
    description:
      "Biceps brachii over the humerus — EMG-derived exertion and atrophy retention vs pre-flight baseline.",
    vitals: [
      vital("emg_tone", "EMG tone", 88, "%", "NOMINAL", 20),
      vital("muscle_vol", "Muscle volume", 97.2, "%", "NOMINAL", 2880),
    ],
  },
  {
    id: "biceps_r",
    name: "Right upper arm",
    zoneId: "limbs",
    side: -1,
    position: armPoint(-1, -0.13, 0.03),
    rotation: [0, 0, -ARM_ABDUCTION],
    shape: "biceps",
    focusDistance: 0.5,
    description:
      "Biceps brachii — dominant-arm load profile from EVA tool handling.",
    vitals: [
      vital("emg_tone", "EMG tone", 91, "%", "NOMINAL", 20),
      vital("muscle_vol", "Muscle volume", 98.0, "%", "NOMINAL", 2880),
    ],
  },
  {
    id: "femur_l",
    name: "Left femur",
    zoneId: "limbs",
    side: 1,
    position: [HIP_X, 0.6, 0],
    shape: "femur",
    focusDistance: 0.85,
    description:
      "Load-bearing long bone with femoral head, trochanters and condyles — bone-density decline is the canonical 0g risk.",
    vitals: [vital("bmd_idx", "Bone density", 93.5, "%", "NOMINAL", 2880)],
  },
  {
    id: "femur_r",
    name: "Right femur",
    zoneId: "limbs",
    side: -1,
    position: [-HIP_X, 0.6, 0],
    shape: "femur",
    focusDistance: 0.85,
    description:
      "Load-bearing long bone — paired density index feeding the deconditioning model.",
    vitals: [vital("bmd_idx", "Bone density", 93.8, "%", "NOMINAL", 2880)],
  },

  /* --------------------------------- gut -------------------------------- */
  {
    id: "liver",
    name: "Liver",
    zoneId: "gut",
    position: [-0.045, 1.02, 0.03],
    shape: "liver",
    focusDistance: 0.6,
    description:
      "Right + left hepatic lobes split by the falciform ligament — metabolic panel surrogate for ration-cycle nutrients and medications.",
    vitals: [
      vital("alt_idx", "ALT surrogate", 24, "U/L", "NOMINAL", 720),
      vital("glucose", "Glucose", 92, "mg/dL", "NOMINAL", 90),
    ],
  },
  {
    id: "gallbladder",
    name: "Gallbladder",
    zoneId: "gut",
    position: [-0.04, 0.975, 0.085],
    shape: "gallbladder",
    focusDistance: 0.3,
    description:
      "Bile reservoir under the liver — gallstone risk rises with bone-loss calcium load; ultrasound surrogate.",
    vitals: [vital("bile_idx", "Bile stasis", 0.18, "idx", "NOMINAL", 1440)],
  },
  {
    id: "stomach",
    name: "Stomach / duodenum",
    zoneId: "gut",
    position: [0.035, 0.98, 0.057],
    shape: "stomach",
    anim: "peristalsis",
    focusDistance: 0.5,
    description:
      "J-shaped gastric chamber (fundus → pylorus) with the duodenal C-loop — motility and appetite under altered fluid distribution.",
    vitals: [
      vital("appetite", "Appetite idx", 82, "idx", "NOMINAL", 360),
      vital("gastric_empty", "Gastric emptying", 96, "min", "NOMINAL", 360),
    ],
  },
  {
    id: "spleen",
    name: "Spleen",
    zoneId: "gut",
    position: [0.105, 1.0, -0.055],
    shape: "spleen",
    focusDistance: 0.4,
    description:
      "Lymphoid filter behind the stomach — immune-dysregulation watch item; WBC surrogate from the weekly panel.",
    vitals: [vital("wbc", "WBC", 6.4, "10³/µL", "NOMINAL", 1440)],
  },
  {
    id: "pancreas",
    name: "Pancreas",
    zoneId: "gut",
    position: [0, 0.955, -0.015],
    shape: "pancreas",
    focusDistance: 0.48,
    description:
      "Head-in-duodenum to tail-at-spleen gland — insulin response and digestive-enzyme surrogates from CGM data.",
    vitals: [vital("insulin_sens", "Insulin sens.", 0.86, "idx", "NOMINAL", 180)],
  },
  {
    id: "kidney_l",
    name: "Left kidney",
    zoneId: "gut",
    side: 1,
    position: [0.068, 0.938, -0.085],
    shape: "kidney",
    focusDistance: 0.48,
    description:
      "Retroperitoneal kidney with renal vessels, adrenal cap and ureter — renal-stone risk is elevated by bone-calcium release in 0g.",
    vitals: [
      vital("egfr", "eGFR", 104, "mL/min", "NOMINAL", 1440),
      vital("stone_risk", "Stone risk", 0.31, "idx", "NOMINAL", 720),
    ],
  },
  {
    id: "kidney_r",
    name: "Right kidney",
    zoneId: "gut",
    side: -1,
    position: [-0.068, 0.926, -0.085],
    shape: "kidney",
    focusDistance: 0.48,
    description:
      "Sits slightly lower than the left (liver above) — hydration status from urine specific-gravity logs.",
    vitals: [
      vital("egfr", "eGFR", 102, "mL/min", "NOMINAL", 1440),
      vital("urine_sg", "Urine SG", 1.018, "", "NOMINAL", 240),
    ],
  },
  {
    id: "small_intestine",
    name: "Small intestine",
    zoneId: "gut",
    position: [0, 0.865, 0.035],
    shape: "small_intestine",
    anim: "peristalsis",
    focusDistance: 0.55,
    description:
      "Jejunum + ileum coils — nutrient absorption and microbiome diversity sampling site for the diet-transition study.",
    vitals: [vital("microbiome", "Microbiome div.", 0.82, "idx", "NOMINAL", 480)],
  },
  {
    id: "colon",
    name: "Large intestine",
    zoneId: "gut",
    position: [0, 0.87, 0.035],
    shape: "colon",
    focusDistance: 0.75,
    description:
      "Haustrated colon framing the small bowel (cecum + appendix → rectum) — transit time and hydration recovery.",
    vitals: [vital("transit", "Transit time", 31, "h", "NOMINAL", 1440)],
  },
  {
    id: "bladder",
    name: "Urinary bladder",
    zoneId: "gut",
    position: [0, 0.765, 0.04],
    shape: "bladder",
    focusDistance: 0.32,
    description:
      "Pelvic reservoir fed by both ureters — void-volume logging (MAG telemetry during EVA).",
    vitals: [vital("void_vol", "Void volume", 310, "mL", "NOMINAL", 120)],
  },

  /* --------------------------------- skin ------------------------------- */
  {
    id: "dermis",
    name: "Skin sample (abdomen)",
    zoneId: "skin",
    position: [0, 1.0, 0.165],
    shape: "skin_section",
    focusDistance: 0.3,
    description:
      "Cross-section: epidermis / dermis / hypodermis with follicles, sweat gland and vessels — surface temperature and suit-contact chafe.",
    vitals: [
      vital("skin_temp", "Skin temp", 33.4, "°C", "NOMINAL", 8),
      vital("hydration_skin", "Skin hydration", 41, "AU", "NOMINAL", 60),
    ],
  },
  {
    id: "dermis_arm",
    name: "Skin sample (L forearm)",
    zoneId: "skin",
    side: 1,
    position: armPoint(1, -0.43, 0.074),
    rotation: [0, 0, ARM_ABDUCTION],
    shape: "skin_section",
    focusDistance: 0.3,
    description:
      "Forearm cross-section — radiation-dose film-badge analogue plus micro-abrasion watch after EVA.",
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

/** Vertical half-FOV of the explorer camera (fov 38°) — framing maths. */
const HALF_FOV = (19 * Math.PI) / 180;

/**
 * Camera framing for a drilled zone: centre + distance that fit the zone's
 * organ anchors (+ padding for the meshes around them). Zone anchors in the
 * crew data mark the suit surface (e.g. skin → PLSS on the back), which is
 * the wrong target once the shell ghosts and the anatomy is what's on show.
 * Model-local; null when the zone has no organs.
 */
export function zoneFraming(
  zoneId: string | null,
): { center: [number, number, number]; distance: number } | null {
  // the skin zone shows the full-body skin layer, not just its samples
  if (zoneId === "skin") return { center: [0, 0.86, 0.02], distance: 2.6 };
  const organs = organsOf(zoneId);
  if (organs.length === 0) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const o of organs) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], o.position[k]);
      max[k] = Math.max(max[k], o.position[k]);
    }
  }
  const center = [0, 1, 2].map((k) => (min[k] + max[k]) / 2) as [number, number, number];
  const halfDiag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
  const radius = halfDiag + 0.15; // meshes extend past their anchors (femur, ribs)
  const distance = Math.min(2.2, Math.max(0.5, radius / Math.sin(HALF_FOV)));
  return { center, distance };
}

/**
 * Zone vitals that drive each organ's status, beyond its own vital keys.
 * An organ lights up when any watched zone reading is off-nominal — so a
 * URGENT chest flags the heart (HR/BP) and lungs (SpO2), not the trachea.
 */
const ORGAN_WATCH: Record<string, string[]> = {
  brain: ["sleep_debt", "cog_load"],
  heart: ["heart_rate_bpm", "systolic_bp_mmhg", "hrv"],
  lung_l: ["spo2_percent", "resp_rate"],
  lung_r: ["spo2_percent", "resp_rate"],
  liver: ["glucose"],
  pancreas: ["glucose"],
  small_intestine: ["microbiome"],
  colon: ["microbiome", "hydration"],
  kidney_l: ["hydration"],
  kidney_r: ["hydration"],
  biceps_l: ["exertion", "grip"],
  biceps_r: ["exertion", "grip"],
  vert_t: ["spinal_load"],
  vert_l: ["bone_marker", "spinal_load"],
  dermis: ["skin_temp", "suit_pressure_kpa"],
  dermis_arm: ["radiation_msv_hr"],
};

const rank = (l: TriageLevel) => TRIAGE_LEVELS.indexOf(l);

/** Organ vitals with the member's live zone readings overlaid (same key),
 * followed by any watched zone readings the organ doesn't list itself. */
export function organVitals(organ: Organ, zone: BodyZone | undefined): VitalReading[] {
  if (!zone) return organ.vitals;
  const byKey = new Map(zone.vitals.map((v) => [v.key, v]));
  const own = organ.vitals.map((v) => byKey.get(v.key) ?? v);
  const ownKeys = new Set(own.map((v) => v.key));
  const watched = (ORGAN_WATCH[organ.id] ?? [])
    .filter((k) => !ownKeys.has(k))
    .map((k) => byKey.get(k))
    .filter((v): v is VitalReading => v != null);
  return [...own, ...watched];
}

/** Worst triage level across the organ's (live) vitals. */
export function organStatus(organ: Organ, zone: BodyZone | undefined): TriageLevel {
  return organVitals(organ, zone).reduce<TriageLevel>(
    (worst, v) => (rank(v.status) > rank(worst) ? v.status : worst),
    "NOMINAL",
  );
}
