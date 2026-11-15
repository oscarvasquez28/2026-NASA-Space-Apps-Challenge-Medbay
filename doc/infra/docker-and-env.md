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
   - Receives `PUBLIC_API_URL` (browser -> backend base URL, served to clients via `GET /api/runtime-config`), `INTERNAL_BACKEND_URL=http://backend:8080` (reserved for future server-side proxying) and `DATA_PROVIDER` (`mock` | `rest` — which `HealthDataProvider` the UI activates). The crew roster is NOT env-configurable: it is built from enrolled operators (`/api/v1/auth/*` + visual-ID check-in), each keyed by `astronautId` and resolved via `GET /api/v1/astronaut/body-status`.
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
| `DATA_PROVIDER` | `rest` | Frontend | `rest` = default full FastAPI Phase 1–4 integration (`partial: false`); `mock` = deterministic offline dataset for isolated dev/tests |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Frontend (build-time) | Inlined backend URL for local `next dev` / static builds (see `frontend/.env.example`) |
| `NEXT_PUBLIC_DATA_PROVIDER` | `rest` | Frontend (build-time) | Inlined provider selection (`rest` default, `mock` override) for local `next dev` |
| `WHEEL_CADENCE_DAYS` | `7` | Backend + Frontend | Consecutive check-in days per prize-wheel spin (spec: 7; set `1` for testing). Backend reads it in auth service; frontend receives it via `GET /api/runtime-config` (`wheelCadenceDays`), so both stay in sync at container start without a rebuild |
| `TRIAGE_MODE` | `deterministic` | Backend | `deterministic` \| `hybrid` \| `ai_advisory` |
| `GEMINI_API_KEY` | `""` | Backend | Optional Gemini API key (never commit real key) |
| `VERTEX_AI_MODEL` | `gemini-2.5-flash` | Backend | Target Gemini / Vertex AI model identifier |
| `GCP_PROJECT_ID` | `""` | GCP / Backend | Target Google Cloud project ID |
| `GCP_REGION` | `us-central1` | GCP / Backend | Target Google Cloud region |

## Database Snapshots & Restore Points

Application data lives wherever `DATABASE_URL` points — currently the remote Supabase
Postgres (server v17), **not** the local `db` container (which only exists as a fallback
for a local `DATABASE_URL`). Snapshots are stored **inside the same database**: frozen
table copies under a `snapshot` schema, so the restore point travels with the data and
needs no file storage or Supabase Storage credentials.

In-app restores go through `PUT /api/v1/tests/dbsnapshot` (the Settings →
"Mission baseline data → Reset baseline" button), which prefers the `snapshot`
schema and falls back to the seeder baseline — see `doc/back/api/endpoints.md`.

| Script | Purpose |
| :--- | :--- |
| `scripts/db-snapshot.sh [label]` | Copies every `public` table into schema `snapshot` (or `snapshot_<label>`) via `CREATE TABLE ... AS TABLE`, plus a `snapshot._meta` table recording label + timestamp. Re-running refreshes the point. |
| `scripts/db-restore.sh [label] [--yes]` | Manual restore, single transaction: `TRUNCATE public.*`, `INSERT ... SELECT` each table back from the snapshot schema, then resets serial/identity sequences to `max(id)` so new inserts do not collide. Prompts for confirmation unless `--yes`. |
| `scripts/db-autorestore.sql` + compose `db-autorestore` service (profile `restore`) | Manual only — never runs on plain `docker compose up`. Invoked via `docker compose --profile restore up db-autorestore` after an external wipe: restores `public` from `snapshot` only when `public.operator_users` is empty. Runs after `backend` is healthy so app tables exist. |

- All tooling runs `psql`/`pg_dump` from a disposable `postgres:17`/`postgres:17-alpine` image (server is v17; the local `db` container only ships v16 tools).
- `ssl=require` in `DATABASE_URL` is auto-translated to `sslmode=require`, and `postgresql+asyncpg://` to `postgresql://` for libpq.
- The `public` schema has no DB-level foreign keys, so insert order during restore is unconstrained.
- `snapshots/` (gitignored) may also hold optional `pg_dump` `.sql` exports — they contain face biometrics (`face_credentials`) and operator photos, never commit them.
- Verified round-trip: marker row inserted → restore → post-snapshot row removed, demo statuses (NOMINAL / CAUTION / CRITICAL for AST-U01/02/03) intact, and a post-restore insert succeeded after sequence reset. `db-autorestore` verified both ways: populated `public` → skip; wiped `public` → all 8 tables restored, `session-state` returns the 3 operators again.
