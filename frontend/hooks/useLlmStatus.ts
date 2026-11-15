"use client";

import { useAppStore } from "@/stores/app-store";
import { useCompanionStore } from "@/stores/companion-store";

/**
 * LLM status icon (spec §10): cloud = hosted LLM (Gemini), server = local
 * fallback (Ollama MedGemma / offline RAG). Forcing offline always shows
 * the server. Before any reply, the comm profile decides.
 */
export function useLlmStatus() {
  const forceOffline = useAppStore((s) => s.forceOffline);
  const liveProfile = useAppStore((s) => s.liveLocationProfile);
  const lastProvider = useCompanionStore((s) => s.lastProvider);
  const lastOffline = useCompanionStore((s) => s.lastOffline);

  const local =
    forceOffline ||
    (lastProvider ? !lastProvider.startsWith("google") || lastOffline : Boolean(liveProfile?.offlineFallbackActive));

  return {
    local,
    label: local ? "Using the Fallback AI Hosted Locally" : "Using AI Hosted on the Cloud",
    provider: lastProvider,
  };
}
