# Backend Documentation Router (`doc/back/index.md`)

> **Context-Saving Rule:** Do not read all backend docs at once. Pick the exact subdomain router below for your task.

## Routing Table

| Subdomain / Task | Read this file | Mapped Code |
| :--- | :--- | :--- |
| App factory, CORS, `Settings`, dependencies, tests | [`architecture.md`](architecture.md) | `backend/app/main.py`, `backend/app/core/config.py`, `backend/tests/` |
| HTTP/WebSocket routes, request/response schemas | [`api/index.md`](api/index.md) | `backend/app/api/` |
| Gemini / Vertex AI clinical advisory adapters | [`ai/index.md`](ai/index.md) | `backend/app/ai/` |
| Vital signs schemas & deterministic triage rules | [`triage/index.md`](triage/index.md) | `backend/app/triage/` |
