# Backend API Endpoints

## Router Structure

- Root router (`backend/app/main.py`): mounts infrastructure probe routes directly (`/health`).
- Versioned API router (`backend/app/api/router.py`): prefixes all domain routes with `/api/v1`.

## Active Endpoints

### `GET /health` (`backend/app/api/routes/health.py`)
- **Purpose:** Liveness and readiness check for Docker Compose and GCP Cloud Run.
- **Response (`200 OK`):** JSON object containing `status` (`"ok"`), `service` (`"backend"`), `environment`, `triage_mode`, and `version`.

### `POST /api/v1/triage/evaluate` (`backend/app/api/routes/triage.py`)
- **Purpose:** Evaluates an astronaut vital-signs snapshot using the deterministic triage engine and optional AI advisory adapter.
- **Request Body:** [`VitalSigns`](../triage/rules-and-models.md) JSON payload.
- **Response (`200 OK`):** [`TriageAssessment`](../triage/rules-and-models.md) JSON payload.
- **Pipeline:**
  1. Calls `evaluate_vital_signs(vitals)` synchronously.
  2. Calls `await generate_clinical_advisory(vitals, assessment, settings)` to attach `ai_advisory` (or `None` in `deterministic` mode).
