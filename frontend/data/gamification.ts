import type { SkinDef } from "@/types/health";

export interface DailyChecklistTemplate {
  id: string;
  label: string;
  frequency: string;
  category: string;
  description: string;
}

export const DAILY_CHECKLIST: DailyChecklistTemplate[] = [
  {
    id: "task_morning_vitals",
    label: "Morning Vitals & Weight",
    frequency: "Daily",
    category: "Vitals",
    description: "Log baseline HR, BP, SpO2, core temperature, and body mass.",
  },
  {
    id: "task_ared_exercise",
    label: "ARED / Resistive Exercise",
    frequency: "Daily",
    category: "Musculoskeletal",
    description: "Complete prescribed microgravity resistive and aerobic loading.",
  },
  {
    id: "task_hydration_nutrition",
    label: "Hydration & Nutrition Check",
    frequency: "Daily",
    category: "Metabolic",
    description: "Record fluid intake and post-meal blood glucose targets.",
  },
  {
    id: "task_sans_visual",
    label: "SANS Visual Acuity Self-Check",
    frequency: "Weekly",
    category: "Neuro-Ocular",
    description: "Run static logMAR chart / Amsler grid optic check.",
  },
  {
    id: "task_weekly_dosimetry_skin",
    label: "Radiation Dosimetry & Skin Log",
    frequency: "Weekly",
    category: "Radiation / Integumentary",
    description: "Sync cumulative mSv dosimeter readout and inspect skin irritation.",
  },
];

export const SKIN_PALETTES: Record<string, { suit: string; accent: string }> = {
  skin_standard_suit: { suit: "#d9e2ec", accent: "#3b82f6" },
  skin_flight_suit: { suit: "#2563eb", accent: "#60a5fa" },
  skin_exercise_apparel: { suit: "#334155", accent: "#38bdf8" },
  skin_lunar_explorer: { suit: "#e2e8f0", accent: "#f59e0b" },
  skin_martian_pioneer: { suit: "#c2410c", accent: "#fb923c" },
  skin_apollo_heritage: { suit: "#f1f5f9", accent: "#ef4444" },
  skin_bioluminescent_pulse: { suit: "#0f172a", accent: "#22d3ee" },
  skin_solar_flare_shield: { suit: "#b45309", accent: "#fde047" },
  skin_cybernetic_visor: { suit: "#1e293b", accent: "#a855f7" },
  skin_deep_space_quantum: { suit: "#090d16", accent: "#c084fc" },
  skin_mars_vanguard: { suit: "#7c2d12", accent: "#f43f5e" },
  skin_canadarm_cybershell: { suit: "#94a3b8", accent: "#10b981" },
  // Legacy mock fallbacks
  "skin-nominal": { suit: "#d9e2ec", accent: "#3b82f6" },
  "skin-orbital": { suit: "#334155", accent: "#38bdf8" },
  "skin-lunar": { suit: "#e2e8f0", accent: "#f59e0b" },
  "skin-eva": { suit: "#f1f5f9", accent: "#ef4444" },
  "skin-aurochs": { suit: "#0f172a", accent: "#22d3ee" },
  "skin-medic": { suit: "#090d16", accent: "#10b981" },
};

export function getSkinPalette(skinId: string): { suit: string; accent: string } {
  return SKIN_PALETTES[skinId] ?? SKIN_PALETTES.skin_standard_suit;
}

export const COMPANION_SKINS: SkinDef[] = [
  {
    id: "skin_standard_suit",
    name: "Standard IVA Flight Suit",
    rarity: "common",
    description: "Default pressurized crew flight garment for orbital ops.",
    palette: SKIN_PALETTES.skin_standard_suit,
    unlocked: true,
    equipped: true,
    probabilityPercent: 20,
  },
  {
    id: "skin_flight_suit",
    name: "Command Cobalt Flight Suit",
    rarity: "common",
    description: "High-visibility mission operations utility uniform.",
    palette: SKIN_PALETTES.skin_flight_suit,
    unlocked: false,
    equipped: false,
    probabilityPercent: 20,
  },
  {
    id: "skin_exercise_apparel",
    name: "ARED Countermeasure Kit",
    rarity: "common",
    description: "Breathable thermal-wicking suit for resistive training.",
    palette: SKIN_PALETTES.skin_exercise_apparel,
    unlocked: false,
    equipped: false,
    probabilityPercent: 20,
  },
  {
    id: "skin_lunar_explorer",
    name: "Artemis Lunar Regolith Suit",
    rarity: "rare",
    description: "Dust-repellent outerweave tuned for 1/6g South Pole EVAs.",
    palette: SKIN_PALETTES.skin_lunar_explorer,
    unlocked: false,
    equipped: false,
    probabilityPercent: 8.33,
  },
  {
    id: "skin_martian_pioneer",
    name: "Ares 3/8g Traverse Shell",
    rarity: "rare",
    description: "Thermal-buffered habitat rover shell for Martian sorties.",
    palette: SKIN_PALETTES.skin_martian_pioneer,
    unlocked: false,
    equipped: false,
    probabilityPercent: 8.33,
  },
  {
    id: "skin_apollo_heritage",
    name: "Heritage A7L Commemorative",
    rarity: "rare",
    description: "Classic silver-white EVA shell with red command stripes.",
    palette: SKIN_PALETTES.skin_apollo_heritage,
    unlocked: false,
    equipped: false,
    probabilityPercent: 8.33,
  },
  {
    id: "skin_bioluminescent_pulse",
    name: "Bioluminescent Telemetry Weave",
    rarity: "epic",
    description: "Optical fiber shell pulsing synchronously with cardiac HRV.",
    palette: SKIN_PALETTES.skin_bioluminescent_pulse,
    unlocked: false,
    equipped: false,
    probabilityPercent: 4,
  },
  {
    id: "skin_solar_flare_shield",
    name: "SPE Radiation Faraday Shell",
    rarity: "epic",
    description: "Boron-nitride reinforced storm shelter armor trim.",
    palette: SKIN_PALETTES.skin_solar_flare_shield,
    unlocked: false,
    equipped: false,
    probabilityPercent: 4,
  },
  {
    id: "skin_cybernetic_visor",
    name: "SANS Optic HUD Visor",
    rarity: "epic",
    description: "Gold-iridium ophthalmic telemetry visor for neuro-ocular checks.",
    palette: SKIN_PALETTES.skin_cybernetic_visor,
    unlocked: false,
    equipped: false,
    probabilityPercent: 4,
  },
  {
    id: "skin_deep_space_quantum",
    name: "Deep Space Quantum Carbon",
    rarity: "legendary",
    description: "Ultra-light graphene radiation shield for Gateway transit.",
    palette: SKIN_PALETTES.skin_deep_space_quantum,
    unlocked: false,
    equipped: false,
    probabilityPercent: 1,
  },
  {
    id: "skin_mars_vanguard",
    name: "Mars Vanguard Command Rig",
    rarity: "legendary",
    description: "Autonomous medical trauma-stabilizing Exo-Rig.",
    palette: SKIN_PALETTES.skin_mars_vanguard,
    unlocked: false,
    equipped: false,
    probabilityPercent: 1,
  },
  {
    id: "skin_canadarm_cybershell",
    name: "Robotic Surgeon Cybershell",
    rarity: "legendary",
    description: "Precision telemetry exoskeleton synced with ground surgery.",
    palette: SKIN_PALETTES.skin_canadarm_cybershell,
    unlocked: false,
    equipped: false,
    probabilityPercent: 1,
  },
];
