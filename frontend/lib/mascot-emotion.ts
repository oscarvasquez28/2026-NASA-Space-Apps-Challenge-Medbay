import type { MascotEmotion } from "@/data/mascots";
import type { HealthState } from "@/stores/app-store";

export interface EmotionInput {
  thinking: boolean;
  health: HealthState;
  technical: boolean;
  /** Status attached to the latest assistant reply (backend `status`). */
  replyStatus?: string | null;
  replyText?: string | null;
}

const SAD_WORDS = /\b(sorry|unfortunately|worse|declin|deteriorat|concern|isolat|lonely|low mood|fatigue)/i;
const HAPPY_WORDS = /\b(great|good news|improv|better|nominal|well done|excellent|healthy|stable)/i;

/**
 * Deterministic, offline Visual-AI emotion (spec §7 — the model reacts to
 * the tone of what it says). Priority:
 *  THINKING (request in flight) → ANGRY (active critical alert) →
 *  SAD (risk/caution reply or sad wording) → SERIOUS (risk or technical
 *  content) → HAPPY (all nominal / upbeat reply).
 */
export function mascotEmotion(i: EmotionInput): MascotEmotion {
  if (i.thinking) return "thinking";
  const status = i.replyStatus?.toLowerCase();
  if (i.health === "critical" || status === "critical" || status === "urgent") return "angry";
  const text = i.replyText ?? "";
  if (text && HAPPY_WORDS.test(text) && i.health === "healthy" && !SAD_WORDS.test(text)) return "happy";
  if ((i.health === "risk" && status === "caution") || SAD_WORDS.test(text)) return "sad";
  if (i.health === "risk" || i.technical) return "serious";
  return "happy";
}
