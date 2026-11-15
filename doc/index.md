# Documentation Routing Index (`doc/index.md`)

> [!IMPORTANT]
> **MANDATORY AGENT WORKFLOW**
> 1. **Read Docs First:** Every AI agent **MUST** read this file and the relevant domain `index.md` / leaf doc(s) **before** answering any question or modifying any part of the codebase.
> 2. **Context-Saving Routing:** Read **only** the documentation files needed for your current task. Do **not** load unrelated domains into your context window.
> 3. **Immediate Doc Sync:** Whenever you update code, configurations, schemas, or infrastructure, you **MUST** immediately update the corresponding documentation files in `doc/` (and any affected `index.md` router).

---

## Task-to-Documentation Router

Find your task domain below and jump directly to that directory's `index.md`:

| If your task involves... | Read ONLY this router first | Mapped Code / Paths | Status |
| :--- | :--- | :--- | :--- |
| **Backend (Overall / Core Config / App Factory)** | [`doc/back/index.md`](back/index.md) | `backend/app/main.py`, `backend/app/core/` | Active (Phase 1) |
| **Backend API (REST/WS Endpoints, Health, Schemas)** | [`doc/back/api/index.md`](back/api/index.md) | `backend/app/api/` | Active (Phase 1) |
| **Backend DB (SQLModel, Engine Fallback, Session)** | [`doc/back/db/index.md`](back/db/index.md) | `backend/app/db/` | Active (Phase 1) |
| **Backend Context (Operational Setting & 5-Hazards)** | [`doc/back/context/index.md`](back/context/index.md) | `backend/app/context/` | Active (Phase 1) |
| **Backend Telemetry (Multi-Modal Vitals & Ingestion)** | [`doc/back/telemetry/index.md`](back/telemetry/index.md) | `backend/app/telemetry/` | Active (Phase 1) |
| **Backend Astronaut (6-Zone Anatomical Body Status)** | [`doc/back/astronaut/index.md`](back/astronaut/index.md) | `backend/app/astronaut/` | Active (Phase 1) |
| **Backend AI (Hybrid Cloud + Edge LLM Clinical Router)** | [`doc/back/ai/index.md`](back/ai/index.md) | `backend/app/ai/` | Active (Phase 3) |
| **Backend RAG (Vectorized Space Medicine Knowledge)** | [`doc/back/rag/index.md`](back/rag/index.md) | `backend/app/rag/` | Active (Phase 3) |
| **Backend Voice (Hybrid Voice Synthesis Gateway)** | [`doc/back/voice/index.md`](back/voice/index.md) | `backend/app/voice/` | Active (Phase 3) |
| **Backend Triage (3-Tier Clinical Engine & Evaluators)** | [`doc/back/triage/index.md`](back/triage/index.md) | `backend/app/triage/` | Active (Phase 2) |
| **Backend ML (RandomForest & IsolationForest Predictor)** | [`doc/back/ml/index.md`](back/ml/index.md) | `backend/app/ml/` | Active (Phase 2) |
| **Backend Trends (Ridge Polynomial Health Forecasting)** | [`doc/back/trends/index.md`](back/trends/index.md) | `backend/app/trends/` | Active (Phase 2) |
| **Backend Gamification (Routine Measurement & Gachapon)** | [`doc/back/gamification/index.md`](back/gamification/index.md) | `backend/app/gamification/` | Active (Phase 4) |
| **Backend Telemedicine (Tempus Pro Store-and-Forward)** | [`doc/back/telemedicine/index.md`](back/telemedicine/index.md) | `backend/app/telemedicine/` | Active (Phase 4) |
| **Frontend (Overall — Currently Uninitialized)** | [`doc/front/index.md`](front/index.md) | `frontend/` (`.gitkeep` only) | Pending Stack & UI |
| **Frontend General (App Shell, State, API Client)** | [`doc/front/general/index.md`](front/general/index.md) | `frontend/` (future) | Pending Stack & UI |
| **Frontend TTS (Text-to-Speech / Voice Alerts)** | [`doc/front/tts/index.md`](front/tts/index.md) | `frontend/` (future) | Pending Stack & UI |
| **Frontend Models (Client Data, 3D/Visual Models)** | [`doc/front/models/index.md`](front/models/index.md) | `frontend/` (future) | Pending Stack & UI |
| **Infrastructure (Docker Compose, `.env`, GCP Cloud Run)** | [`doc/infra/index.md`](infra/index.md) | `docker-compose.yml`, `.env.example`, `backend/Dockerfile` | Active (4-Container Topology) |


---

## Documentation Maintenance Rules

- Every subdirectory under `doc/` **must** contain an `index.md` acting as a lightweight router.
- Keep leaf `.md` files focused on a single concern (under ~150 lines where possible) so future agents only load what they need.
- When adding a new submodule or leaf doc, add a row to the nearest parent `index.md`.
