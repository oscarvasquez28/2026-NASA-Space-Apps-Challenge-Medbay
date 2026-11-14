"use client";

/**
 * TTS adapter slot — STUB.
 *
 * Reserved for the hands-free voice-alert layer (doc/front/tts/overview.md):
 * prioritized spoken announcements on URGENT/CRITICAL triage transitions,
 * with an offline-capable synthesis path for degraded comms.
 *
 * The interface is intentionally stable so a real engine (Web Speech API /
 * local assets) can drop in without touching call sites.
 */

export interface SpeechAdapter {
  /** Whether a real synthesis engine is wired (false = stub). */
  readonly available: boolean;
  /** "local" = offline-capable synth; "advisory" = relay-assisted; "stub". */
  readonly mode: "stub" | "local" | "advisory";
  speak(text: string, opts?: { priority?: "normal" | "urgent" }): void;
  cancel(): void;
}

export function useSpeech(): SpeechAdapter {
  return {
    available: false,
    mode: "stub",
    speak: () => {},
    cancel: () => {},
  };
}
