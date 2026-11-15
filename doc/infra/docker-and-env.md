# Docker Compose & Environment Configuration

## Container Architecture

The repository defines **four separate container services** in [`docker-compose.yml`](../../docker-compose.yml) connected on bridge network `triage-net`:

1. **`db`** (`astronaut-triage-db`)
   - Uses `pgvector/pgvector:pg16` on port `5432`.
   - Persists data to named volume `pgdata`.
   - Healthcheck probes `pg_isready -U astronaut -d astronaut_triage`.

2. **`ollama`** (`astronaut-triage-ollama`)
   - Uses `ollama/ollama:latest` on port `11434`.
   - Persists models and weights to named volume `ollama_data`.
   - Healthcheck verifies `ollama list`.

3. **`backend`** (`astronaut-triage-backend`)
   - Built from `backend/Dockerfile` (`python:3.12-slim`, non-root user `appuser`).
   - Exposes port `8080` (mapped to `${BACKEND_PORT:-8080}`).
   - Depends on `db` (healthy) and `ollama` (started).
   - Healthcheck probes `GET http://127.0.0.1:8080/health` every 15s via Python `urllib.request`.
   - Loads optional `.env` and `backend/.env` (`required: false`).

4. **`frontend`** (`astronaut-triage-frontend`)
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
| `POSTGRES_USER` | `astronaut` | Database / Compose | PostgreSQL superuser username |
| `POSTGRES_PASSWORD` | `spaceapps2026` | Database / Compose | PostgreSQL password |
| `POSTGRES_DB` | `astronaut_triage` | Database / Compose | Primary database name |
| `POSTGRES_PORT` | `5432` | Database / Compose | PostgreSQL port |
| `DATABASE_URL` | `postgresql+asyncpg://...` | Backend | Async database connection string |
| `OLLAMA_PORT` | `11434` | Ollama / Compose | Local offline Ollama service port |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Backend | Ollama HTTP endpoint |
| `OLLAMA_LLM_MODEL` | `medgemma` | Backend | Target local clinical LLM |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Backend | Target local embedding model |
| `ELEVENLABS_API_KEY` | `""` | Backend | Optional ElevenLabs TTS voice synthesis key |
| `ELEVENLABS_VOICE_ID` | `""` | Backend | Target voice persona ID |
| `UPLOAD_DIR` | `/tmp/uploads` | Backend | Local storage path for diagnostic images |
| `GCS_BUCKET_NAME` | `""` | Backend / GCP | Optional GCS bucket for diagnostic images |
| `FACE_MODEL_DIR` | `/app/models/face` | Backend | Directory containing pre-baked OpenCV YuNet & SFace ONNX models |
| `FACE_MATCH_THRESHOLD` | `0.363` | Backend | Minimum cosine similarity required to match a face in `face_credentials` |
| `FRONTEND_PORT` | `3000` | Compose | Host port mapped to frontend container `:8080` |
| `PUBLIC_API_URL` | `http://localhost:8080` | Frontend | Public backend URL served to browsers via `GET /api/runtime-config` |
| `ASTRONAUT_IDS` | `AST-01,AST-02,AST-03` | Frontend | Runtime astronaut selector list (no roster endpoint exists) |
| `DATA_PROVIDER` | `rest` | Frontend | `rest` = default full FastAPI Phase 1–4 integration (`partial: false`); `mock` = deterministic offline dataset for isolated dev/tests |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Frontend (build-time) | Inlined backend URL for local `next dev` / static builds (see `frontend/.env.example`) |
| `NEXT_PUBLIC_ASTRONAUT_IDS` | `AST-01,AST-02,AST-03,AST-04` | Frontend (build-time) | Inlined selector list for local `next dev` |
| `NEXT_PUBLIC_DATA_PROVIDER` | `rest` | Frontend (build-time) | Inlined provider selection (`rest` default, `mock` override) for local `next dev` |
| `TRIAGE_MODE` | `deterministic` | Backend | `deterministic` \| `hybrid` \| `ai_advisory` |
| `GEMINI_API_KEY` | `""` | Backend | Optional Gemini API key (never commit real key) |
| `VERTEX_AI_MODEL` | `gemini-2.5-flash` | Backend | Target Gemini / Vertex AI model identifier |
| `GCP_PROJECT_ID` | `""` | GCP / Backend | Target Google Cloud project ID |
| `GCP_REGION` | `us-central1` | GCP / Backend | Target Google Cloud region |
