"use client";

import { useCallback, useRef, useState } from "react";

import { useAppStore } from "@/stores/app-store";
import type {
  AssistantResponse,
  ChatMessage,
  ZoneId,
} from "@/types/health";
import { useProvider } from "./useProvider";

export interface SendChatOptions {
  forceOffline?: boolean;
  includeVoice?: boolean;
  diagnosticImageBase64?: string | null;
}

/**
 * AI companion conversation state wired to POST /api/v1/ai/chat.
 */
export function useAICompanion(crewId: string | undefined) {
  const provider = useProvider();
  const locationId = useAppStore((s) => s.locationId);
  const viewMode = useAppStore((s) => s.viewMode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  const idRef = useRef(0);

  const nextId = () => `m${++idRef.current}`;

  const send = useCallback(
    async (
      prompt: string,
      contextZoneId?: ZoneId | null,
      onResponse?: (r: AssistantResponse) => void,
      opts?: SendChatOptions,
    ) => {
      if (!provider || !crewId || !prompt.trim()) return;
      const seq = ++seqRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: "user",
          text: prompt.trim(),
          contextZoneId: contextZoneId ?? undefined,
          hasImage: Boolean(opts?.diagnosticImageBase64),
        },
      ]);
      setThinking(true);
      setError(null);

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
        if (seq !== seqRef.current) return;
        setMessages((m) => [
          ...m,
          { id: nextId(), role: "assistant", text: response.message, response },
        ]);
        onResponse?.(response);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (seq !== seqRef.current) return;
        setError(
          e instanceof Error ? e.message : "Companion request failed.",
        );
      } finally {
        if (seq === seqRef.current) setThinking(false);
      }
    },
    [provider, crewId, locationId, viewMode],
  );

  const cancel = useCallback(() => {
    seqRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    setThinking(false);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setMessages([]);
    setError(null);
  }, [cancel]);

  return { messages, thinking, error, send, cancel, reset };
}
