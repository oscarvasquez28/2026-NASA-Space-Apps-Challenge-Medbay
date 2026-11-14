# Docker Compose & Environment Configuration

## Container Architecture

The repository defines **two separate container services** in [`docker-compose.yml`](../../docker-compose.yml) connected on bridge network `triage-net`:

1. **`backend`** (`astronaut-triage-backend`)
   - Built from `backend/Dockerfile` (`python:3.12-slim`, non-root user `appuser`).
   - Exposes port `8080` (mapped to `${BACKEND_PORT:-8080}`).
   - Healthcheck probes `GET http://127.0.0.1:8080/health` every 15s via Python `urllib.request`.
   - Loads optional `.env` and `backend/.env` (`required: false`).

2. **`frontend`** (`astronaut-triage-frontend`)
   - Built from `frontend/Dockerfile` (`node:22-alpine` multi-stage, Next.js standalone output, non-root user `nextjs`, honors `PORT`/`HOSTNAME` → `0.0.0.0:8080`).
   - Exposes container port `8080` mapped to `${FRONTEND_PORT:-3000}` on the host.
   - Depends on `backend` (`condition: service_healthy`); healthcheck `wget`s `http://127.0.0.1:8080/` every 15s.
   - Receives `PUBLIC_API_URL` (browser -> backend base URL, served to clients via `GET /api/runtime-config`), `INTERNAL_BACKEND_URL=http://backend:8080` (reserved for future server-side proxying), `ASTRONAUT_IDS` (selector list, runtime-configurable) and `DATA_PROVIDER` (`mock` | `rest` — which `HealthDataProvider` the UI activates).
   - Loads optional `.env` and `frontend/.env` (`required: false`).

## Environment Templates

- Root template: [`.env.example`](../../.env.example)
- Backend standalone template: [`backend/.env.example`](../../backend/.env.example)
- Frontend standalone template: [`frontend/.env.example`](../../frontend/.env.example) (`NEXT_PUBLIC_*` build-time vars)
- Never commit `.env` files. Add any new environment variable to both `.env.example` (and `backend/.env.example` / `frontend/.env.example` if service-specific) and this file.

### Key Variables

| Variable | Default | Scope | Description |
| :--- | :--- | :--- | :--- |
| `PROJECT_NAME` | `astronaut-triage-system` | Compose | Compose project name |
| `ENVIRONMENT` | `local` | Backend | Runtime environment (`local`, `staging`, `production`) |
| `LOG_LEVEL` | `INFO` | Backend | Application logging verbosity |
| `BACKEND_PORT` | `8080` | Compose | Host port mapped to backend `:8080` |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Backend | Comma-separated allowed browser origins |
| `FRONTEND_PORT` | `3000` | Compose | Host port mapped to frontend container `:8080` |
| `PUBLIC_API_URL` | `http://localhost:8080` | Frontend | Public backend URL served to browsers via `GET /api/runtime-config` |
| `ASTRONAUT_IDS` | `AST-01,AST-02,AST-03` | Frontend | Runtime astronaut selector list (no roster endpoint exists) |
| `DATA_PROVIDER` | `mock` | Frontend | `mock` = deterministic simulated datasets (all labelled SIMULATED); `rest` = real `GET /health` + `POST /api/v1/triage/evaluate`, other features delegate to labelled mocks (`partial`) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Frontend (build-time) | Inlined backend URL for local `next dev` / static builds (see `frontend/.env.example`) |
| `NEXT_PUBLIC_ASTRONAUT_IDS` | `AST-01,AST-02,AST-03` | Frontend (build-time) | Inlined selector list for local `next dev` |
| `NEXT_PUBLIC_DATA_PROVIDER` | `mock` | Frontend (build-time) | Inlined provider selection for local `next dev` |
| `TRIAGE_MODE` | `deterministic` | Backend | `deterministic` \| `hybrid` \| `ai_advisory` |
| `GEMINI_API_KEY` | `""` | Backend | Optional Gemini API key (never commit real key) |
| `VERTEX_AI_MODEL` | `gemini-2.5-flash` | Backend | Target Gemini / Vertex AI model identifier |
| `GCP_PROJECT_ID` | `""` | GCP / Backend | Target Google Cloud project ID |
| `GCP_REGION` | `us-central1` | GCP / Backend | Target Google Cloud region |
