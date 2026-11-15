# Google Cloud Platform (GCP) Deployment Guide

## Target Architecture

Both `backend` and `frontend` are structured as independent stateless containers ready for **Google Cloud Run** and **Google Artifact Registry**:

- **Backend Service (`CLOUD_RUN_BACKEND_SERVICE`)**
  - Built from `backend/Dockerfile`.
  - Honors Cloud Run's dynamic `PORT` environment variable (`uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}`).
  - Uses `/health` for readiness/liveness probes.
  - Runs as non-root user `appuser`.

- **Frontend Service (`CLOUD_RUN_FRONTEND_SERVICE`)**
  - Built from `frontend/Dockerfile` (Next.js standalone server on `0.0.0.0:${PORT:-8080}`).
  - Resolves `PUBLIC_API_URL`, `DATA_PROVIDER`, and `ASTRONAUT_IDS` at runtime via `GET /api/runtime-config`, so `PUBLIC_API_URL` points to the deployed Cloud Run backend URL without rebuilding the image (and `CORS_ORIGINS` on the backend must allow the Cloud Run frontend origin).

## Quick-Deploy Scripts (Hackathon / Demo Mode)

Two cross-platform scripts deploy both services directly from source using `gcloud run deploy --source`:

- **Windows (PowerShell):** [`scripts/deploy-gcp.ps1`](../../scripts/deploy-gcp.ps1)
  ```powershell
  .\scripts\deploy-gcp.ps1 -ProjectId <gcp-project-id>
  ```
- **macOS / Linux (Bash):** [`scripts/deploy-gcp.sh`](../../scripts/deploy-gcp.sh)
  ```bash
  chmod +x scripts/deploy-gcp.sh
  ./scripts/deploy-gcp.sh --project <gcp-project-id>
  ```

### Script Behavior & Defaults

- **Automatic `.env` loading & Postgres URL normalization:** Both scripts automatically load variables from `.env` at the repository root if present (or a custom file via `-EnvFile` / `--env-file`) and rewrite `postgres://` / `postgresql://` + `sslmode=` into `postgresql+asyncpg://` + `ssl=` automatically. Existing shell environment variables and explicit CLI flags always override `.env` values.
- **Docker `@db:` & `ollama` guards:** If `DATABASE_URL` in `.env` still points to the local Docker Compose hostname (`@db:`), the script prints a warning (since Cloud Run cannot reach `db:5432` and would fall back to ephemeral SQLite). Update `DATABASE_URL` to your Supabase/Postgres URI or pass `-DatabaseUrl` / `--database-url`. Likewise, `OLLAMA_BASE_URL` defaults to empty (`""`) on Cloud Run (ignoring `http://ollama:11434` if set in `.env`) so startup RAG seeding does not block on DNS lookups to a non-existent `ollama` container.
- Enables `run.googleapis.com`, `cloudbuild.googleapis.com`, and `artifactregistry.googleapis.com`.
- Deploys the backend (`1Gi` memory, `--max-instances 1`, `--min-instances 0` by default) with `DATABASE_URL=sqlite+aiosqlite:///./astronaut_triage.db` for zero-cost Cloud SQL-free operation when no Postgres URL is provided.
- Deploys the frontend (`512Mi` memory, `--min-instances 0`) wired to the backend URL (`PUBLIC_API_URL`), then updates backend `CORS_ORIGINS` to allow the frontend origin.
- Optional overrides via `.env`, shell env, or CLI flags: `GCP_PROJECT_ID`, `GCP_REGION` (`us-central1`), `CLOUD_RUN_BACKEND_SERVICE`, `CLOUD_RUN_FRONTEND_SERVICE`, `TRIAGE_MODE` (`deterministic` | `hybrid` | `ai_advisory`), `GEMINI_API_KEY`, `VERTEX_AI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `GCS_BUCKET_NAME`, `DATABASE_URL`, `ASTRONAUT_IDS`, `DATA_PROVIDER`, and `BACKEND_MIN_INSTANCES` (`0` for free idle scaling, `1` to keep SQLite warm during live demos).

## Recommended GCP Services

- **Compute:** Cloud Run (separate services for backend & frontend).
- **Container Registry:** Artifact Registry (`${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REGISTRY_REPO}`).
- **Secrets:** Google Secret Manager for `GEMINI_API_KEY` (avoid passing raw API keys in plaintext deploy flags in production).
- **AI Inference:** Vertex AI (`GCP_PROJECT_ID` + `GCP_REGION` + service account IAM `roles/aiplatform.user`) or Gemini API.
