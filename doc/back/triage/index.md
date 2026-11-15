# Backend Triage Documentation Router (`doc/back/triage/index.md`)

> **Context-Saving Rule:** Read only the file below when modifying astronaut telemetry schemas or autonomous triage classification rules.

## Routing Table

| Topic | Read this file | Mapped Code |
| :--- | :--- | :--- |
| `VitalSigns`, `TriageLevel`, `TriageAssessment`, and baseline rule thresholds | [`rules-and-models.md`](rules-and-models.md) | `backend/app/triage/models.py`, `backend/app/triage/engine.py` |
| Specialized NASA HRP / CSA Clinical Domain Evaluators | [`evaluators/index.md`](evaluators/index.md) | `backend/app/triage/evaluators/` |
