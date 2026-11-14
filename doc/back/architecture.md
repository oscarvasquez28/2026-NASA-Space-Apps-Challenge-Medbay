# Backend Core Architecture

## Stack & Entry Point

- **Framework:** FastAPI (`backend/requirements.txt`) served by Uvicorn.
- **Entry Point:** `backend/app/main.py` -> `create_app()` constructs the `FastAPI` instance, applies `CORSMiddleware` using `settings.cors_origins`, and mounts:
  - `health_router` at root (`/health`)
  - `api_router` at `/api/v1`

## Configuration (`backend/app/core/config.py`)

`Settings` (`pydantic_settings.BaseSettings`) loads from environment variables and optional `.env` via cached `get_settings()`:
- `ENVIRONMENT` (default `"local"`)
- `LOG_LEVEL` (default `"INFO"`)
- `PORT` (default `8080`)
- `CORS_ORIGINS` (comma-separated string parsed by `Settings.cors_origins` property)
- `TRIAGE_MODE` (`"deterministic" | "hybrid" | "ai_advisory"`, default `"deterministic"`)
- `GCP_PROJECT_ID`, `GCP_REGION`, `GEMINI_API_KEY`, `VERTEX_AI_MODEL`

## Testing

- Smoke tests live in `backend/tests/test_health_and_triage.py`.
- Run with `pytest` from `backend/` (`pythonpath = ["."]` configured in `backend/pyproject.toml`).
