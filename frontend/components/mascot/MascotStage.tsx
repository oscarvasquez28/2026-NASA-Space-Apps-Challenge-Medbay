"use client";

import type { MascotEmotion, MascotSkinId } from "@/data/mascots";
import { OrbSkin } from "./OrbSkin";
import { RubberHoseSkin } from "./RubberHoseSkin";
import { TvBotSkin } from "./TvBotSkin";
import { WaveCatSkin } from "./WaveCatSkin";

/** Renders a Visual AI Model skin in a given emotion. */
export function MascotStage({
  skin,
  emotion,
  size = 160,
}: {
  skin: MascotSkinId;
  emotion: MascotEmotion;
  size?: number;
}) {
  switch (skin) {
    case "tv-bot":
      return <TvBotSkin emotion={emotion} size={size} />;
    case "wave-cat":
      return <WaveCatSkin emotion={emotion} size={size} />;
    case "rubber-hose":
      return <RubberHoseSkin emotion={emotion} size={size} />;
    default:
      return <OrbSkin emotion={emotion} size={size} />;
  }
}
