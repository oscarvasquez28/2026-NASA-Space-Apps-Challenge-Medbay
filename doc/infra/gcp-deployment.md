# Google Cloud Platform (GCP) Deployment Guide

## Target Architecture

Both `backend` and `frontend` are structured as independent stateless containers ready for **Google Cloud Run** and **Google Artifact Registry**:

- **Backend Service (`CLOUD_RUN_BACKEND_SERVICE`)**
  - Built from `backend/Dockerfile`.
  - Honors Cloud Run's dynamic `PORT` environment variable (`uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}`).
  - Uses `/health` for readiness/liveness probes.
  - Runs as non-root user `appuser`.

- **Frontend Service (`CLOUD_RUN_FRONTEND_SERVICE`)** *(Pending `frontend/` Initialization)*
  - Will be built from `frontend/Dockerfile` once the frontend stack is selected.
  - Should listen on `0.0.0.0:${PORT:-8080}` and point `PUBLIC_API_URL` to the deployed Cloud Run backend URL (and configure `CORS_ORIGINS` on the backend to allow the Cloud Run frontend origin).

## Recommended GCP Services

- **Compute:** Cloud Run (separate services for backend & frontend).
- **Container Registry:** Artifact Registry (`${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REGISTRY_REPO}`).
- **Secrets:** Google Secret Manager for `GEMINI_API_KEY` (avoid passing raw API keys in plaintext deploy flags in production).
- **AI Inference:** Vertex AI (`GCP_PROJECT_ID` + `GCP_REGION` + service account IAM `roles/aiplatform.user`) or Gemini API.
