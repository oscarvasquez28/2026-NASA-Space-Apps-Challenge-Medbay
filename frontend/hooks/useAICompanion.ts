"use client";

import { useCallback, useEffect } from "react";

import { useAppStore } from "@/stores/app-store";
import { useCompanionStore } from "@/stores/companion-store";
import type { AssistantResponse, ZoneId } from "@/types/health";
import { useProvider } from "./useProvider";

export interface SendChatOptions {
  forceOffline?: boolean;
  includeVoice?: boolean;
  diagnosticImageBase64?: string | null;
}

// Store actions are stable; reading them once at module scope is safe.
const store = useCompanionStore.getState();

let idSeq = 0;
const nextId = () => `m${++idSeq}`;
// Shared across hook instances so any surface can cancel the in-flight call.
let seq = 0;
let inflight: AbortController | null = null;

/**
 * AI companion conversation wired to POST /api/v1/ai/chat. State lives in the
 * shared companion store (one thread per subject).
 */
export function useAICompanion(crewId: string | undefined) {
  const provider = useProvider();
  const locationId = useAppStore((s) => s.locationId);
  const viewMode = useAppStore((s) => s.viewMode);
  const messages = useCompanionStore((s) => s.messages);
  const thinking = useCompanionStore((s) => s.thinking);
  const error = useCompanionStore((s) => s.error);

  useEffect(() => {
    if (crewId) store.bindCrew(crewId);
  }, [crewId]);

  const send = useCallback(
    async (
      prompt: string,
      contextZoneId?: ZoneId | null,
      onResponse?: (r: AssistantResponse) => void,
      opts?: SendChatOptions,
    ) => {
      if (!provider || !crewId || !prompt.trim()) return;
      const mySeq = ++seq;
      const controller = new AbortController();
      inflight = controller;

      store.push({
        id: nextId(),
        role: "user",
        text: prompt.trim(),
        contextZoneId: contextZoneId ?? undefined,
        hasImage: Boolean(opts?.diagnosticImageBase64),
      });
      store.setThinking(true);
      store.setError(null);

      try {
        const response = await provider.ask(
          crewId,
          {
            prompt: prompt.trim(),
            contextZoneId,
            locationId,
            viewMode,
            forceOffline: opts?.forceOffline,
            includeVoice: opts?.includeVoice,
            diagnosticImageBase64: opts?.diagnosticImageBase64,
          },
          controller.signal,
        );
        if (mySeq !== seq) return;
        store.push({ id: nextId(), role: "assistant", text: response.message, response });
        store.setLastRoute(response.providerUsed ?? null, Boolean(response.offlineMode));
        onResponse?.(response);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (mySeq !== seq) return;
        store.setError(e instanceof Error ? e.message : "Companion request failed.");
      } finally {
        if (mySeq === seq) store.setThinking(false);
      }
    },
    [provider, crewId, locationId, viewMode],
  );

  const cancel = useCallback(() => {
    seq++;
    inflight?.abort();
    inflight = null;
    store.setThinking(false);
  }, []);

  const reset = useCallback(() => {
    cancel();
    store.reset();
  }, [cancel]);

  return { messages, thinking, error, send, cancel, reset };
}
