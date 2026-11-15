/**
 * Visual AI Model skins (spec §7 + design/AI_Model.jpeg).
 * `orb` is the default companion every operator owns; the other three are
 * WEEKLY CHECK IN BONUS prizes, one per wheel tier.
 */

export type MascotEmotion = "happy" | "serious" | "thinking" | "angry" | "sad";
export type MascotRarity = "common" | "rare" | "mythic";
export type MascotSkinId = "orb" | "tv-bot" | "wave-cat" | "rubber-hose";

export interface MascotSkinDef {
  id: MascotSkinId;
  name: string;
  rarity: MascotRarity | "default";
  blurb: string;
}

export const MASCOT_SKINS: MascotSkinDef[] = [
  {
    id: "orb",
    name: "Pulse Orb",
    rarity: "default",
    blurb: "A calm sphere of light whose waves follow the voice.",
  },
  {
    id: "tv-bot",
    name: "Retro Tele-Bot",
    rarity: "common",
    blurb: "A little CRT with antennae. No animation — its face switches with each feeling.",
  },
  {
    id: "wave-cat",
    name: "Waveform Cat",
    rarity: "rare",
    blurb: "Its fur is made of audio waveforms that ripple while it speaks.",
  },
  {
    id: "rubber-hose",
    name: "Cap'n Comet",
    rarity: "mythic",
    blurb: "An original 1930s rubber-hose cartoon spacefarer who whistles while thinking.",
  },
];

export const DEFAULT_MASCOT: MascotSkinId = "orb";

export function mascotDef(id: MascotSkinId): MascotSkinDef {
  return MASCOT_SKINS.find((m) => m.id === id) ?? MASCOT_SKINS[0];
}

/* ------------------------- weekly bonus wheel ------------------------- */

export const WHEEL_TIERS: MascotRarity[] = ["common", "rare", "mythic"];

/** Spec wheel odds: COMMON 60 / RARE 30 / MYTHIC 10. */
export const WHEEL_WEIGHTS: Record<MascotRarity, number> = {
  common: 60,
  rare: 30,
  mythic: 10,
};

export function rollWheelTier(rand: () => number = Math.random): MascotRarity {
  const total = WHEEL_TIERS.reduce((n, t) => n + WHEEL_WEIGHTS[t], 0);
  let r = rand() * total;
  for (const t of WHEEL_TIERS) {
    r -= WHEEL_WEIGHTS[t];
    if (r < 0) return t;
  }
  return "common";
}

export function mascotForTier(tier: MascotRarity): MascotSkinDef {
  return MASCOT_SKINS.find((m) => m.rarity === tier)!;
}
