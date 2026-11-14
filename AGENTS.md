# AGENTS.md — Astronaut Health Monitoring & Autonomous Triage System

**Project:** NASA Space Apps Challenge — Astronaut Health Monitoring & Autonomous Triage System  
**Architecture:** Containerized Monorepo (`backend/` + `frontend/`), local orchestration via Docker Compose, production target on Google Cloud Platform (GCP Cloud Run).

---

## MANDATORY AGENT WORKFLOW (NON-NEGOTIABLE)

All AI agents and automated contributors working in this repository **MUST** follow this exact 3-step loop for every task:

1. **READ THE DOCS FIRST (Before Answering or Modifying Anything)**
   - **Never** answer architectural questions, propose edits, or modify any code/config before consulting [`doc/index.md`](doc/index.md).
   - Start at [`doc/index.md`](doc/index.md) and follow **only** the `index.md` router(s) and specific markdown leaf files matching your current task.
   - **Do NOT** read unrelated domain documentation or bulk-scan the entire codebase; use the `doc/**/index.md` routers to keep your context window clean and focused.

2. **INSPECT ONLY TARGETED CODE**
   - After reading the relevant `doc/` files, inspect only the source files mapped to that domain.

3. **UPDATE CORRESPONDING DOCS IMMEDIATELY**
   - If you create, modify, rename, or delete **any** code, endpoint, schema, AI adapter, triage rule, frontend component, environment variable, or Docker/GCP configuration, you **MUST** immediately update the corresponding markdown file(s) and `index.md` router(s) in `doc/` before completing your response.
   - Undocumented code changes are considered incomplete.

---

## Repository Structure & Service Boundaries

| Path | Purpose | Current State |
| :--- | :--- | :--- |
| [`docker-compose.yml`](docker-compose.yml) | Orchestrates `backend` and `frontend` as separate containers | Active (`frontend` uses placeholder image until stack is chosen) |
| [`.env.example`](.env.example) | Root local & GCP environment variable template | Active (copy to `.env`; never commit `.env`) |
| [`backend/`](backend/) | Python FastAPI service (`api`, `ai`, `triage`) + `Dockerfile` | Initialized & runnable on port `8080` |
| [`frontend/`](frontend/) | Reserved for future web UI container | **Intentionally empty** (`.gitkeep` only — stack & UI TBD) |
| [`doc/`](doc/index.md) | Hierarchical context-saving documentation & routers | Initialized across `back/`, `front/`, `infra/` |

---

## Hard Architectural Guardrails

1. **Separate Container Services:** `backend` and `frontend` must remain strictly decoupled container services communicating over HTTP/WebSocket (`INTERNAL_BACKEND_URL` inside Docker network or `PUBLIC_API_URL` from browser). Do not merge them into a single container.
2. **Respect `frontend/` Uninitialized State:** Unless explicitly instructed by the user to initialize a chosen frontend stack, keep `frontend/` empty (only `frontend/.gitkeep`).
3. **Cloud Run Portability:** Both services must be stateless, bind `0.0.0.0`, and honor the `PORT` environment variable (default `8080` for backend).
4. **Offline-First Safety for Triage:** Deterministic baseline triage rules in `backend/app/triage/` must never require external network access or cloud AI credentials to classify critical astronaut conditions.
5. **Secrets Hygiene:** Never commit `.env`, API keys, or GCP service account JSON files. Document every new env var in `.env.example` (and `backend/.env.example` if backend-specific) and `doc/infra/docker-and-env.md`.
