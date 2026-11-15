# Frontend TTS Documentation Router (`doc/front/tts/index.md`)

> **Current Status:** Active — `frontend/hooks/useSpeech.ts` connects to `POST /api/v1/ai/tts` via `HealthDataProvider.synthesizeSpeech()`, decodes base64 WAV/MP3 audio (with `window.speechSynthesis` fallback), and animates timed mouth viseme cues (`A`, `E`, `I`, `O`, `U`, `M`, `rest`).  
> **Context-Saving Rule:** Read only the file below when implementing or updating Text-to-Speech (TTS) audio alerts in the frontend.

## Routing Table

| Topic | Read this file | Mapped Code |
| :--- | :--- | :--- |
| TTS gateway integration, audio playback + viseme animation | [`overview.md`](overview.md) | `frontend/hooks/useSpeech.ts`, `frontend/components/widgets/ChatPanel.tsx` |
