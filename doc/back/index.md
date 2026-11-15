# Backend Documentation Router (`doc/back/index.md`)

> **Context-Saving Rule:** Do not read all backend docs at once. Pick the exact subdomain router below for your task.

## Routing Table

| Subdomain / Task | Read this file | Mapped Code |
| :--- | :--- | :--- |
| App factory, CORS, `Settings`, dependencies, tests | [`architecture.md`](architecture.md) | `backend/app/main.py`, `backend/app/core/config.py`, `backend/tests/` |
| HTTP/WebSocket routes, request/response schemas | [`api/index.md`](api/index.md) | `backend/app/api/`, `doc/back/api/postman/` |
| Database session, engine fallback, SQLModel records | [`db/index.md`](db/index.md) | `backend/app/db/` |
| Operator auth, `face_credentials`, local YuNet+SFace face recognition | [`auth/index.md`](auth/index.md) | `backend/app/auth/`, `backend/app/api/routes/auth.py` |
| Operational context & NASA HRP 5-Hazards modeling | [`context/index.md`](context/index.md) | `backend/app/context/` |
| Multi-modal telemetry ingestion & diagnostic imaging | [`telemetry/index.md`](telemetry/index.md) | `backend/app/telemetry/` |
| Astronaut anatomical 6-zone body status aggregator | [`astronaut/index.md`](astronaut/index.md) | `backend/app/astronaut/` |
| AI clinical chat router, hybrid cascade & view modes | [`ai/index.md`](ai/index.md) | `backend/app/ai/` |
| Vectorized space medicine knowledge base & RAG retriever | [`rag/index.md`](rag/index.md) | `backend/app/rag/` |
| Hybrid voice synthesis gateway & lip-sync visemes | [`voice/index.md`](voice/index.md) | `backend/app/voice/` |
| Vital signs schemas & deterministic triage rules | [`triage/index.md`](triage/index.md) | `backend/app/triage/` |
| Specialized NASA HRP / CSA clinical domain evaluators | [`triage/evaluators/index.md`](triage/evaluators/index.md) | `backend/app/triage/evaluators/` |
| Machine learning health anomaly predictor & hazard models | [`ml/index.md`](ml/index.md) | `backend/app/ml/` |
| Time-series trend analysis & polynomial Ridge forecasting | [`trends/index.md`](trends/index.md) | `backend/app/trends/` |
| Routine measurement scheduler & Gachapon reward engine | [`gamification/index.md`](gamification/index.md) | `backend/app/gamification/` |
| Tempus Pro store-and-forward telemedicine sync queue | [`telemedicine/index.md`](telemedicine/index.md) | `backend/app/telemedicine/` |

