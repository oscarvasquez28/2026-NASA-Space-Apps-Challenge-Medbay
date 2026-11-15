/**
 * Gamification datasets: daily checklist and companion "suit skin" rewards.
 */

import type { SkinDef } from "@/types/health";

export const DAILY_CHECKLIST = [
  { id: "vitals", label: "Log morning vitals" },
  { id: "sleep", label: "Record sleep cycle" },
  { id: "hydration", label: "Confirm hydration intake" },
  { id: "exercise", label: "Complete exercise block" },
  { id: "scan", label: "Review zone monitor" },
] as const;

export const COMPANION_SKINS: SkinDef[] = [
  {
    id: "skin-nominal",
    name: "Nominal White",
    rarity: "common",
    description: "Standard-issue lab livery for the companion avatar.",
    palette: { suit: "#3a3f47", accent: "#8badfa" },
  },
  {
    id: "skin-orbital",
    name: "Orbital Dawn",
    rarity: "common",
    description: "Warm sunrise palette inspired by 16 daily sunrises.",
    palette: { suit: "#4a3f35", accent: "#c98a6b" },
  },
  {
    id: "skin-lunar",
    name: "Lunar Regolith",
    rarity: "rare",
    description: "Dust-grey finish marking a surface excursion streak.",
    palette: { suit: "#2f333b", accent: "#9ebaa3" },
  },
  {
    id: "skin-eva",
    name: "EVA High-Vis",
    rarity: "rare",
    description: "High-visibility accents for spacewalk operations.",
    palette: { suit: "#45413a", accent: "#b4a38d" },
  },
  {
    id: "skin-aurochs",
    name: "Aurora",
    rarity: "legendary",
    description: "Ionospheric glow edition. Awarded for sustained streaks.",
    palette: { suit: "#20302c", accent: "#7fd4b4" },
  },
  {
    id: "skin-medic",
    name: "Flight Surgeon",
    rarity: "legendary",
    description: "Deep-space medical corps livery.",
    palette: { suit: "#2c3140", accent: "#c17a7a" },
  },
];
