"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAppStore } from "@/stores/app-store";
import type { BackendStatus, TTSResponse, ViewMode } from "@/types/health";
import { useLocationContext } from "./useLocationContext";
import { useProvider } from "./useProvider";

export interface SpeakOptions {
  priority?: "normal" | "urgent";
  severity?: BackendStatus;
  forceOffline?: boolean;
  voiceId?: string;
  viewMode?: ViewMode;
  astronautId?: string;
  preloadedResponse?: TTSResponse;
}

export interface SpeechAdapter {
  readonly available: boolean;
  readonly mode: "stub" | "local" | "advisory";
  speaking: boolean;
  loading: boolean;
  activeViseme: string;
  lastResponse: TTSResponse | null;
  error: string | null;
  speak: (text: string, opts?: SpeakOptions) => Promise<TTSResponse | null>;
  cancel: () => void;
}

/**
 * Voice synthesis & phoneme viseme playback wired to POST /api/v1/ai/tts.
 * Plays returned base64 WAV/MP3 audio via HTMLAudioElement (with Web Speech
 * API fallback) and steps `activeViseme` across `viseme_cues`.
 */
export function useSpeech(): SpeechAdapter {
  const provider = useProvider();
  const viewMode = useAppStore((s) => s.viewMode);
  const { profile } = useLocationContext();

  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeViseme, setActiveViseme] = useState("rest");
  const [lastResponse, setLastResponse] = useState<TTSResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const clearPlayback = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setLoading(false);
    setActiveViseme("rest");
  }, []);

  useEffect(() => clearPlayback, [clearPlayback]);

  const scheduleVisemes = useCallback(
    (res: TTSResponse) => {
      const cues = res.viseme_cues ?? [];
      for (const cue of cues) {
        const startTimer = window.setTimeout(() => {
          setActiveViseme(cue.viseme || "rest");
        }, Math.max(0, cue.start_ms));
        timersRef.current.push(startTimer);
      }
      const endMs = Math.max(
        res.duration_ms || 0,
        cues[cues.length - 1]?.end_ms ?? 800,
      );
      const doneTimer = window.setTimeout(() => {
        setSpeaking(false);
        setActiveViseme("rest");
      }, endMs + 80);
      timersRef.current.push(doneTimer);
    },
    [],
  );

  const playPayload = useCallback(
    async (res: TTSResponse, fallbackText: string) => {
      setLastResponse(res);
      setSpeaking(true);
      scheduleVisemes(res);

      let audioStarted = false;
      if (typeof Audio !== "undefined" && res.audio_base64) {
        try {
          const audio = new Audio(
            `data:${res.mime_type || "audio/wav"};base64,${res.audio_base64}`,
          );
          audioRef.current = audio;
          await audio.play();
          audioStarted = true;
        } catch {
          audioStarted = false;
        }
      }

      if (
        !audioStarted &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        try {
          const hint = res.browser_speech_hint ?? {};
          const utter = new SpeechSynthesisUtterance(
            typeof hint.text === "string" ? hint.text : fallbackText,
          );
          if (typeof hint.lang === "string") utter.lang = hint.lang;
          if (typeof hint.rate === "number") utter.rate = hint.rate;
          if (typeof hint.pitch === "number") utter.pitch = hint.pitch;
          window.speechSynthesis.speak(utter);
        } catch {
          // ignore browser speech synth failures in headless contexts
        }
      }
    },
    [scheduleVisemes],
  );

  const speak = useCallback(
    async (text: string, opts?: SpeakOptions): Promise<TTSResponse | null> => {
      clearPlayback();
      const trimmed = text.trim();
      if (!trimmed && !opts?.preloadedResponse) return null;

      if (opts?.preloadedResponse) {
        await playPayload(opts.preloadedResponse, trimmed);
        return opts.preloadedResponse;
      }

      if (!provider) return null;

      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        const res = await provider.synthesizeSpeech(
          {
            text: trimmed,
            astronaut_id: opts?.astronautId ?? "AST-01",
            voice_id: opts?.voiceId ?? null,
            severity:
              opts?.severity ??
              (opts?.priority === "urgent" ? "critical" : "nominal"),
            force_offline:
              opts?.forceOffline ?? profile.offlineFallbackActive ?? false,
            view_mode: opts?.viewMode ?? viewMode,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return null;
        setLoading(false);
        await playPayload(res, trimmed);
        return res;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return null;
        setLoading(false);
        setSpeaking(false);
        setError(e instanceof Error ? e.message : "Voice synthesis failed.");
        return null;
      }
    },
    [clearPlayback, playPayload, profile.offlineFallbackActive, provider, viewMode],
  );

  const mode: SpeechAdapter["mode"] = lastResponse
    ? lastResponse.offline_mode
      ? "local"
      : "advisory"
    : profile.linkMode;

  return {
    available: true,
    mode,
    speaking,
    loading,
    activeViseme,
    lastResponse,
    error,
    speak,
    cancel: clearPlayback,
  };
}
