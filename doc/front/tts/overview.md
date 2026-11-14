# Frontend Text-to-Speech (TTS) Overview (Pending Implementation)

## Purpose

The TTS module will provide hands-free spoken alerts and triage action readouts for astronauts and flight surgeons during high-workload or EVA scenarios where visual screen attention is constrained.

## Planned Integration Notes

- Trigger prioritized audio announcements on `URGENT` and `CRITICAL` [`TriageLevel`](../../back/triage/rules-and-models.md) transitions.
- Support an offline-capable speech synthesis fallback (e.g., Web Speech API or local audio assets) when spacecraft communication links are degraded.
- Update this directory's docs immediately once `frontend/` TTS modules are implemented.
