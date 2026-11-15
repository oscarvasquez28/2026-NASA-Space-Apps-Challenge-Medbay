# Backend AI Documentation Router (`doc/back/ai/index.md`)

> **Context-Saving Rule:** Read only the file below when working on LLM/Vertex AI/Gemini integration. Update immediately after modifying `backend/app/ai/`.

## Routing Table

| Topic | Read this file | Mapped Code |
| :--- | :--- | :--- |
| Hybrid 3-tier clinical chat router, dual view modes & zero-500 failover | [`clinical-router.md`](clinical-router.md) | `backend/app/ai/router_service.py`, `backend/app/ai/schemas.py`, `backend/app/api/routes/ai.py` |
| AI clinical advisory boundary, offline fallback & GCP/Gemini hook | [`providers.md`](providers.md) | `backend/app/ai/client.py` |
