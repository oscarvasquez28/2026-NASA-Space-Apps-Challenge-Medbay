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
| **Backend (Overall / Core Config / App Factory)** | [`doc/back/index.md`](back/index.md) | `backend/app/main.py`, `backend/app/core/` | Initialized |
| **Backend API (REST/WS Endpoints, Health, Schemas)** | [`doc/back/api/index.md`](back/api/index.md) | `backend/app/api/` | Initialized |
| **Backend AI (Gemini / Vertex AI Clinical Advisory)** | [`doc/back/ai/index.md`](back/ai/index.md) | `backend/app/ai/` | Initialized (Stub) |
| **Backend Triage (Vitals Models & Autonomous Rules)** | [`doc/back/triage/index.md`](back/triage/index.md) | `backend/app/triage/` | Initialized |
| **Frontend (Overall — Currently Uninitialized)** | [`doc/front/index.md`](front/index.md) | `frontend/` (`.gitkeep` only) | Pending Stack & UI |
| **Frontend General (App Shell, State, API Client)** | [`doc/front/general/index.md`](front/general/index.md) | `frontend/` (future) | Pending Stack & UI |
| **Frontend TTS (Text-to-Speech / Voice Alerts)** | [`doc/front/tts/index.md`](front/tts/index.md) | `frontend/` (future) | Pending Stack & UI |
| **Frontend Models (Client Data, 3D/Visual Models)** | [`doc/front/models/index.md`](front/models/index.md) | `frontend/` (future) | Pending Stack & UI |
| **Infrastructure (Docker Compose, `.env`, GCP Cloud Run)** | [`doc/infra/index.md`](infra/index.md) | `docker-compose.yml`, `.env.example`, `backend/Dockerfile` | Initialized |

---

## Documentation Maintenance Rules

- Every subdirectory under `doc/` **must** contain an `index.md` acting as a lightweight router.
- Keep leaf `.md` files focused on a single concern (under ~150 lines where possible) so future agents only load what they need.
- When adding a new submodule or leaf doc, add a row to the nearest parent `index.md`.
