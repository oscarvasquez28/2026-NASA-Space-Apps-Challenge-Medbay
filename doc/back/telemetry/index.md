# Telemetry Domain Router (`doc/back/telemetry/index.md`)

> **Context-Saving Rule:** Read only the telemetry documentation leaf file needed for your task.

## Routing Table

| Subdomain / Task | Read this file | Mapped Code |
| :--- | :--- | :--- |
| Telemetry ingestion, Pillow image verification, triage triggering | [`ingestion-and-multimodal.md`](ingestion-and-multimodal.md) | `backend/app/telemetry/models.py`, `backend/app/telemetry/storage.py`, `backend/app/telemetry/service.py`, `backend/app/api/routes/telemetry.py` |
