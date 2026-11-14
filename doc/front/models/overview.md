# Frontend Models Overview (Pending Implementation)

## Purpose

This domain will house:
1. Client-side telemetry and triage types mirrored from [`doc/back/triage/rules-and-models.md`](../../back/triage/rules-and-models.md) (`VitalSigns`, `TriageLevel`, `TriageAssessment`).
2. Any 3D astronaut/suit visualization assets, sensor coordinate mappings, or client-side inference models introduced once the UI design is finalized.

## Maintenance Rule

When frontend models are created, keep backend-mirrored DTO schemas aligned with `backend/app/triage/models.py` and document every schema or visual model file here.
