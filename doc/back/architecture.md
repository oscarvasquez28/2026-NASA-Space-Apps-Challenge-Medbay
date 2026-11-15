# Backend Core Architecture

## Stack & Entry Point

- **Framework:** FastAPI (`backend/requirements.txt`) served by Uvicorn.
- **Entry Point:** `backend/app/main.py` -> `create_app()` constructs the `FastAPI` instance with `lifespan` handler executing `await init_db()`, applies `CORSMiddleware` using `settings.cors_origins`, and mounts:
  - `health_router` at root (`/health`)
  - `api_router` at `/api/v1` (aggregates `/triage`, `/context`, `/telemetry`, `/astronaut`)

## Database & Persistence Architecture

- **Engine (`backend/app/db/session.py`):** Async SQLAlchemy / SQLModel engine with automatic resilience. Connects to PostgreSQL (`DATABASE_URL`), and automatically falls back to SQLite (`sqlite+aiosqlite:///./astronaut_triage.db`) if PostgreSQL is unavailable.
- **Initialization:** `init_db()` verifies/creates `pgvector` extension on PostgreSQL and runs `SQLModel.metadata.create_all`. Seeds default operational context (`"Space Station [0g]"`) if missing.
- **Models (`backend/app/db/models.py`):**
  - `LocationContextRecord`: Operational setting, habitability sensors, latency, offline flag, and 5-hazards multipliers JSON.
  - `TelemetryRecord`: Astronaut vitals, diagnostic image paths, image metadata, triage tier, and mission readiness score.

## Configuration (`backend/app/core/config.py`)

`Settings` (`pydantic_settings.BaseSettings`) loads from environment variables and optional `.env` via cached `get_settings()`:
- `ENVIRONMENT` (default `"local"`)
- `LOG_LEVEL` (default `"INFO"`)
- `PORT` (default `8080`)
- `CORS_ORIGINS` (comma-separated string parsed by `Settings.cors_origins` property)
- `TRIAGE_MODE` (`"deterministic" | "hybrid" | "ai_advisory"`, default `"deterministic"`)
- `DATABASE_URL` (PostgreSQL asyncpg URL with SQLite fallback)
- `OLLAMA_BASE_URL`, `OLLAMA_LLM_MODEL`, `OLLAMA_EMBED_MODEL`
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`
- `UPLOAD_DIR` (default `"/tmp/uploads"`), `GCS_BUCKET_NAME`
- `GCP_PROJECT_ID`, `GCP_REGION`, `GEMINI_API_KEY`, `VERTEX_AI_MODEL`

## Testing

- Test suite lives in `backend/tests/`:
  - `test_health_and_triage.py`: Backward-compatibility tests for `/health` and `/api/v1/triage/evaluate`.
  - `test_db_session.py`: Database session fallback and seeding tests.
  - `test_context_api.py`: Operational context and 5-hazards multiplier tests.
  - `test_telemetry_ingest_api.py`: JSON and multi-modal image ingestion tests.
  - `test_astronaut_body_status_api.py`: 6-zone anatomical body status dual-view tests.
- Run with `pytest -v` inside the backend container (`docker compose exec backend pytest -v`) or locally.

