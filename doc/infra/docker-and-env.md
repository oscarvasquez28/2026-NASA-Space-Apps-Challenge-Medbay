# Docker Compose & Environment Configuration

## Container Architecture

The repository defines **two separate container services** in [`docker-compose.yml`](../../docker-compose.yml) connected on bridge network `triage-net`:

1. **`backend`** (`astronaut-triage-backend`)
   - Built from `backend/Dockerfile` (`python:3.12-slim`, non-root user `appuser`).
   - Exposes port `8080` (mapped to `${BACKEND_PORT:-8080}`).
   - Healthcheck probes `GET http://127.0.0.1:8080/health` every 15s via Python `urllib.request`.
   - Loads optional `.env` and `backend/.env` (`required: false`).

2. **`frontend`** (`astronaut-triage-frontend`)
   - **Current State:** `frontend/` is intentionally empty except `frontend/.gitkeep` because the frontend tech stack and UI design are not yet finalized.
   - Uses a placeholder image (`${FRONTEND_IMAGE:-nginx:1.27-alpine}`) mapped to `${FRONTEND_PORT:-3000}:80` and depends on `backend` (`condition: service_healthy`).
   - Receives `PUBLIC_API_URL` (browser -> backend) and `INTERNAL_BACKEND_URL=http://backend:8080` (server/proxy -> backend).
   - **Future Activation:** Once `frontend/Dockerfile` exists, replace `image:` with `build: { context: ./frontend, dockerfile: Dockerfile }` and switch container port mapping to `${FRONTEND_PORT:-3000}:8080` for Cloud Run parity.

## Environment Templates

- Root template: [`.env.example`](../../.env.example)
- Backend standalone template: [`backend/.env.example`](../../backend/.env.example)
- Never commit `.env` files. Add any new environment variable to both `.env.example` (and `backend/.env.example` if used by backend) and this file.

### Key Variables

| Variable | Default | Scope | Description |
| :--- | :--- | :--- | :--- |
| `PROJECT_NAME` | `astronaut-triage-system` | Compose | Compose project name |
| `ENVIRONMENT` | `local` | Backend | Runtime environment (`local`, `staging`, `production`) |
| `LOG_LEVEL` | `INFO` | Backend | Application logging verbosity |
| `BACKEND_PORT` | `8080` | Compose | Host port mapped to backend `:8080` |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Backend | Comma-separated allowed browser origins |
| `FRONTEND_PORT` | `3000` | Compose | Host port mapped to frontend container |
| `PUBLIC_API_URL` | `http://localhost:8080` | Frontend | Public backend URL for browser clients |
| `TRIAGE_MODE` | `deterministic` | Backend | `deterministic` \| `hybrid` \| `ai_advisory` |
| `GEMINI_API_KEY` | `""` | Backend | Optional Gemini API key (never commit real key) |
| `VERTEX_AI_MODEL` | `gemini-2.5-flash` | Backend | Target Gemini / Vertex AI model identifier |
| `GCP_PROJECT_ID` | `""` | GCP / Backend | Target Google Cloud project ID |
| `GCP_REGION` | `us-central1` | GCP / Backend | Target Google Cloud region |
