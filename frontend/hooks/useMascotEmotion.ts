"use client";

import { mascotEmotion } from "@/lib/mascot-emotion";
import { useAppStore } from "@/stores/app-store";
import { useCompanionStore } from "@/stores/companion-store";

export function useMascotEmotion() {
  const thinking = useCompanionStore((s) => s.thinking);
  const last = useCompanionStore((s) =>
    [...s.messages].reverse().find((m) => m.role === "assistant"),
  );
  const health = useAppStore((s) => s.subjectHealth);
  const technical = useAppStore((s) => s.viewMode === "technical");
  return mascotEmotion({
    thinking,
    health,
    technical,
    replyStatus: last?.response?.status ?? null,
    replyText: last?.text ?? null,
  });
}
