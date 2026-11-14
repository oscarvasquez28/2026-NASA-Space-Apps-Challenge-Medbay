"use client";

import { useCallback, useRef, useState } from "react";

import { useProvider } from "./useProvider";
import { useAppStore } from "@/stores/app-store";
import type {
  AssistantResponse,
  ChatMessage,
  ZoneId,
} from "@/types/health";

/**
 * AI companion conversation state. Owns the message list, thinking/cancel
 * lifecycle and returns AssistantResponse contracts ({message,
 * referencedZoneIds, actions, assumptions}) the caller renders — including
 * focus actions that drive the 3D viewer.
 */
export function useAICompanion(crewId: string | undefined) {
  const provider = useProvider();
  const locationId = useAppStore((s) => s.locationId);
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
        },
      ]);
      setThinking(true);
      setError(null);

      try {
        const response = await provider.ask(
          crewId,
          { prompt: prompt.trim(), contextZoneId, locationId },
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
    [provider, crewId, locationId],
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
