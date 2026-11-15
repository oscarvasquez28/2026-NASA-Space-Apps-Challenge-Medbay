# Frontend Text-to-Speech (TTS) Overview

## Status — active backend voice + viseme integration

[`frontend/hooks/useSpeech.ts`](../../../frontend/hooks/useSpeech.ts) implements the live `SpeechAdapter` connected to [`POST /api/v1/ai/tts`](../../back/voice/tts-gateway.md) through `HealthDataProvider.synthesizeSpeech()`. In `rest` mode it receives ElevenLabs MP3 or offline local RIFF WAV base64 audio along with timed phoneme `viseme_cues` (`A`, `E`, `I`, `O`, `U`, `M`, `rest`); `mock` mode generates an offline local RIFF WAV stub and viseme timeline for isolated testing.

## Playback & Viseme Architecture

- **Primary audio playback:** Creates an `HTMLAudioElement` from `data:<mime_type>;base64,<audio_base64>` and calls `play()`, falling back cleanly to browser `window.speechSynthesis` using `browser_speech_hint` if audio autoplay is blocked.
- **Preloaded `/api/v1/ai/chat` voice payloads:** When `AUTO TTS` (`include_voice: true`) is enabled in [`ChatPanel.tsx`](../../../frontend/components/widgets/ChatPanel.tsx), `useSpeech.speak(..., { preloadedResponse })` plays the attached `voice_payload` immediately without an extra HTTP roundtrip.
- **Viseme HUD & Console:** `useSpeech()` exposes `activeViseme`, `speaking`, `loading`, `lastResponse`, and `mode` (`"local" | "advisory"`). [`ChatPanel.tsx`](../../../frontend/components/widgets/ChatPanel.tsx) includes a collapsible Voice TTS & Viseme Console supporting Postman scenarios `#23` (Offline Caution), `#23.2` (Online Voice), and `#24` (Critical Emergency).
