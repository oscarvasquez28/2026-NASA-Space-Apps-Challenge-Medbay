# AI Clinical Advisory Providers

## Design Boundary (`backend/app/ai/client.py`)

`generate_clinical_advisory(vitals, baseline, settings)` enriches a deterministic `TriageAssessment` with optional AI clinical reasoning.

### Safety & Fallback Rules
1. **Deterministic Mode (`TRIAGE_MODE=deterministic`):** Immediately returns `None` without network calls.
2. **Missing Credentials:** If neither `GEMINI_API_KEY` nor `GCP_PROJECT_ID` is configured, returns an explicit non-blocking notice and lets deterministic triage stand alone.
3. **Current Status:** Stub adapter ready for Google GenAI / Vertex AI SDK (`VERTEX_AI_MODEL`, default `gemini-2.5-flash`) integration. Never let an AI provider timeout or exception block the deterministic triage response.
