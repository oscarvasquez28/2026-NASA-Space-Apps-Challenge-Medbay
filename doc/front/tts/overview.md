# Frontend Text-to-Speech (TTS) Overview

## Status — adapter stub

[`frontend/hooks/useSpeech.ts`](../../../frontend/hooks/useSpeech.ts) reserves the adapter slot the AI companion will call when a real TTS layer lands. It exposes a `SpeechAdapter`-style surface (speak/cancel/enabled) backed by a no-op mock — the companion drawer can declare its "voice mode" per `LocationProfile.linkMode` today without shipping audio.

## Purpose

The TTS module will provide hands-free spoken alerts and triage action readouts for astronauts and flight surgeons during high-workload or EVA scenarios where visual screen attention is constrained.

## Integration notes

- The companion already carries `AssistantResponse.mode` (`local` vs `advisory`) driven by the location's comm profile — the TTS adapter should mirror that mode (offline-capable local synth under degraded links, e.g. Web Speech API).
- Trigger prioritized audio announcements on `URGENT`/`CRITICAL` [`TriageLevel`](../../back/triage/rules-and-models.md) transitions once a synth engine is wired.
- Everything stays behind the adapter interface — swapping the stub for a real engine must not require UI changes.
