"use client";

import { create } from "zustand";

import type { ChatMessage } from "@/types/health";

/**
 * Shared Visual-AI conversation state. One conversation per subject
 * (`crewId`) so the mascot panel, the dashboard chat and /medic all show the
 * same thread, and the header LLM-status icon can read `lastProvider`.
 */
interface CompanionState {
  crewId: string | null;
  messages: ChatMessage[];
  thinking: boolean;
  error: string | null;
  /** `provider_used` of the latest reply (e.g. "google-genai:gemini"). */
  lastProvider: string | null;
  lastOffline: boolean;
  bindCrew: (id: string) => void;
  push: (m: ChatMessage) => void;
  setThinking: (v: boolean) => void;
  setError: (e: string | null) => void;
  setLastRoute: (provider: string | null, offline: boolean) => void;
  reset: () => void;
}

export const useCompanionStore = create<CompanionState>()((set, get) => ({
  crewId: null,
  messages: [],
  thinking: false,
  error: null,
  lastProvider: null,
  lastOffline: false,
  bindCrew: (id) => {
    if (get().crewId !== id) set({ crewId: id, messages: [], error: null, thinking: false });
  },
  push: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setThinking: (thinking) => set({ thinking }),
  setError: (error) => set({ error }),
  setLastRoute: (lastProvider, lastOffline) => set({ lastProvider, lastOffline }),
  reset: () => set({ messages: [], error: null, thinking: false }),
}));

/**
 * Live speech signal for mascot animation. Mutated from audio callbacks
 * (no React re-render); read inside rAF / useFrame loops.
 */
export const speechSignal = { speaking: false, level: 0 };
