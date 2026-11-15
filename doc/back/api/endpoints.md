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

### `GET /api/v1/context/location` (`backend/app/api/routes/context.py`)
- **Purpose:** Retrieves the current active spaceflight operational location setting and dynamically computed NASA HRP 5-hazard multipliers.
- **Response (`200 OK`):** `LocationContextResponse` JSON with `location_setting`, `gravity_g`, habitability sensor readings, comm latency, offline fallback flag, `hazard_multipliers`, `status` (`nominal` | `caution` | `critical`), `high_level`, and `technical` summaries.

### `POST /api/v1/context/location` (`backend/app/api/routes/context.py`)
- **Purpose:** Updates the operational environment or environmental sensor metrics (CO2, pressure, noise, microbes), dynamically recalculating 5-hazard multipliers and persisting the record.
- **Request Body:** `LocationContextUpdate` JSON.
- **Response (`200 OK`):** Updated `LocationContextResponse` JSON including `status`, `high_level`, and `technical` fields.

### `POST /api/v1/telemetry/ingest` (`backend/app/api/routes/telemetry.py`)
- **Purpose:** Ingests physiological vitals and optional multi-modal diagnostic imagery (camera, ultrasound, lesion) via `application/json` or `multipart/form-data`.
- **Request Body:** `TelemetryIngestRequest` (or form fields) + optional image file upload (`diagnostic_image`, `image_file`, or `image`).
- **Response (`200 OK`):** `TelemetryIngestResponse` with immediate triage classification (`nominal`, `caution`, `critical`), tier (`TIER_1_SELF_CARE`, `TIER_2_CMO_REVIEW`, `TIER_3_GROUND_SURGEON`), mission readiness score, anomaly flags, `recommended_actions`, `high_level`, `technical`, and image metadata.

### `GET /api/v1/astronaut/body-status` (`backend/app/api/routes/astronaut.py`)
- **Purpose:** Synthesizes and returns astronaut health across 6 anatomical body zones (`head_eyes`, `cardiovascular_chest`, `spine_skeletal`, `musculoskeletal_limbs`, `gut_microbiome`, `skin`) enriched dynamically by the 4 NASA HRP / CSA domain evaluators.
- **Query Parameter:** `astronaut_id: str` (default `"AST-01"`).
- **Response (`200 OK`):** `AstronautBodyStatusResponse` with top-level `status`, `overall_status`, `overall_ui_token`, `high_level`, and `technical`, plus per-zone semantic UI tokens (`status-nominal`, `status-caution`, `status-critical`), dual-mode summaries (`high_level` for crew, `technical` for flight surgeons), self-exam checklists, and targeted countermeasures.

### `GET /api/v1/trends/{indicator}` (`backend/app/api/routes/trends.py`)
- **Purpose:** Analyzes time-series physiological history, applies cold start synthesis when fewer than 5 records exist, overlays 3 operational mission events, and computes quadratic polynomial Ridge regression forecasts with 95% confidence intervals and clinical threshold warnings.
- **Path Parameter:** `indicator: str` (supported: `heart_rate_bpm`, `spo2_percent`, `core_temp_c`, `radiation_dose_msv`, `blood_sugar_mg_dl`, `bone_mineral_density_t_score`, `visual_acuity_logmar`, `mission_readiness_score`). Returns `400 Bad Request` if indicator is unsupported.
- **Query Parameters:**
  - `astronaut_id: str = "AST-01"`
  - `history_limit: int = 50` (5 to 500)
  - `forecast_steps: int = 10` (1 to 50)
- **Response (`200 OK`):** `TrendAnalysisResponse` containing:
  - `indicator`, `astronaut_id`, `unit`
  - `historical_points`: list of `{ timestamp, value }`
  - `event_markers`: list of 3 `{ timestamp, event_name, impact, description }`
  - `forecast_points`: list of `{ timestamp, predicted_value, lower_ci, upper_ci }`
  - `threshold_warning`: boolean indicating whether projected trajectory or current state crosses safety limits
  - `warning_details`: human-readable clinical explanation of breached boundary
  - Standardized `status` (`nominal` | `caution` | `critical`), `high_level`, and `technical` fields.

### `GET /api/v1/ai/knowledge` (`backend/app/api/routes/ai.py`)
- **Purpose:** Vector similarity semantic search across authoritative NASA HRP and CSA clinical protocols using cosine similarity.
- **Query Parameters:**
  - `q: str = ""` (query string, symptom descriptions, or protocol topic)
  - `category: Optional[str] = None` (optional domain filter, e.g. `SANS`, `EVA/Hypoxia`, `Radiation/CANS`, `Countermeasures/Aging`)
  - `top_k: int = 3` (1 to 20)
- **Response (`200 OK`):** `KnowledgeSearchResponse` with `status`, `high_level`, `technical`, `total_chunks`, `embedding_provider`, and `results` (list of `KnowledgeDocumentSchema` with `score` and `similarity_score`).

### `POST /api/v1/ai/chat` (`backend/app/api/routes/ai.py`)
- **Purpose:** Resilient 3-tier hybrid clinical chat router (`google-genai:gemini` -> `ollama:medgemma` -> `offline-rag-clinical-synth`) with 100% zero-500 guarantee.
- **Request Body:** `AIChatRequest` (`astronaut_id`, `message`, `view_mode`, `include_voice`, `force_offline`, `diagnostic_image_base64`).
- **Response (`200 OK`):** `AIChatResponse` with `status`, `high_level`, `technical`, `astronaut_id`, `reply`, `view_mode`, `provider_used`, `failover_reason`, `offline_mode`, `earth_comm_latency_sec`, `triage_tier`, `retrieved_knowledge`, `recommended_actions`, and optional `voice_payload`.

### `POST /api/v1/ai/tts` (`backend/app/api/routes/ai.py`)
- **Purpose:** Hybrid speech synthesis gateway utilizing ElevenLabs (cloud) or pure-Python 16-bit 16000Hz mono RIFF/WAV generator (offline) with lip-sync visemes.
- **Request Body:** `TTSRequest` (`text`, `astronaut_id`, `voice_id`, `severity`, `force_offline`, `view_mode`).
- **Response (`200 OK`):** `TTSResponse` with `status`, `high_level`, `technical`, `provider_used`, `offline_mode`, `mime_type`, `audio_base64`, `duration_ms`, `viseme_cues`, and `browser_speech_hint`.

### `WS /api/v1/ai/tts/stream` (`backend/app/api/routes/ai.py`)
- **Purpose:** Low-latency WebSocket streaming endpoint for progressive audio chunk delivery and real-time 3D avatar lip-sync visemes.
- **Client Message:** JSON `{"text": "...", "severity": "...", "force_offline": ...}`.
- **Server Frames:**
  1. `{"type": "start", "provider": "...", "severity": "..."}`
  2. `{"type": "viseme", "viseme_cues": [...]}`
  3. `{"type": "audio_chunk", "chunk_index": i, "chunk_base64": "...", "format": "wav"}`
  4. `{"type": "complete", "total_chunks": n, "total_duration_ms": ..., "status": "nominal"}`

### `GET /api/v1/gamification/status` (`backend/app/api/routes/gamification.py`)
- **Purpose:** Retrieves or auto-seeds astronaut gamification profile, daily routine compliance checklist, token balance, active streak, and companion skin catalog.
- **Query Parameter:** `astronaut_id: str` (default `"AST-01"`).
- **Response (`200 OK`):** `GamificationStatusResponse` containing `status`, `high_level`, `technical`, `astronaut_id`, `readiness_streak_days`, `total_checkups_completed`, `gachapon_tokens`, `compliance_rate_percent`, `equipped_skin`, `routine_tasks`, `unlocked_skins_count`, `total_skins_count`, and `catalog`.

### `POST /api/v1/gamification/checkup-complete` (`backend/app/api/routes/gamification.py`)
- **Purpose:** Logs routine health task completion, advances readiness streak (+1), awards Gachapon tokens (+1), and executes an optional weighted companion skin roll.
- **Request Body:** `CheckupCompleteRequest` (`astronaut_id`, `completed_tasks`, `perform_gachapon_roll`, `equip_skin_id`, `deterministic_seed`).
- **Response (`200 OK`):** `CheckupCompleteResponse` with `status`, `high_level`, `technical`, `readiness_streak_days`, `total_checkups_completed`, `gachapon_tokens`, `tokens_awarded`, `roll_performed`, `roll_result`, `equipped_skin`, `completed_tasks_today`, and `compliance_rate_percent`.

### `GET /api/v1/telemedicine/sync-queue` (`backend/app/api/routes/telemedicine.py`)
- **Purpose:** Inspects store-and-forward telemedicine alerts, bundled with Artemis Standard Measures telemetry and Ridge regression trend forecasting summaries.
- **Query Parameters:**
  - `astronaut_id: Optional[str] = None`
  - `transmission_status: Optional[str] = None` (`"pending"` or `"transmitted"`)
- **Response (`200 OK`):** `TelemedicineSyncQueueResponse` with `status`, `high_level`, `technical`, `location_setting`, `earth_comm_latency_sec`, `offline_fallback_active`, `comm_window_open`, `pending_count`, `transmitted_count`, and `packets`.

### `POST /api/v1/telemedicine/flush` (`backend/app/api/routes/telemedicine.py`)
- **Purpose:** Flushes pending store-and-forward alert packets in an asynchronous burst transmission to Earth Flight Surgeons.
- **Request Body:** `TelemedicineFlushRequest` (`astronaut_id`, `packet_ids`, `force_flush`, `ground_station`).
- **Response (`200 OK`):** `TelemedicineFlushResponse` with `status`, `high_level`, `technical`, `flushed_count`, `remaining_pending_count`, `ground_station`, `transmitted_at`, and `flushed_packets`.




