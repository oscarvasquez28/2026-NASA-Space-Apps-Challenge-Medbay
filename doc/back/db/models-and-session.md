# Database Models and Session Lifecycle

## Architecture Overview

The database layer (`backend/app/db/`) uses SQLModel to combine Pydantic validation with SQLAlchemy ORM capabilities over asynchronous database connections.

## Resilient Connection Engine (`backend/app/db/session.py`)

- **Primary Connection & URL Normalization:** Connects via `postgresql+asyncpg` using `DATABASE_URL` (in container: `db:5432`). `_normalize_database_url()` automatically rewrites `postgres://` or `postgresql://` prefixes to `postgresql+asyncpg://` and converts `sslmode=` query parameters to `ssl=` for `asyncpg` compatibility (preventing missing `psycopg` driver errors on Supabase/managed Postgres URIs).
- **Resilient Fallback:** If PostgreSQL is unreachable, invalid, or unconfigured (such as during isolated test runs), `init_db()` logs a warning and transparently switches to `sqlite+aiosqlite:///./astronaut_triage.db`.
- **Extension Initialization:** When running on PostgreSQL dialect, `init_db()` issues `CREATE EXTENSION IF NOT EXISTS vector;` to prepare pgvector support for Phase 3 embeddings.
- **Session Injection:** `get_session()` is an async generator yielding an `AsyncSession`, used via FastAPI dependency injection `Depends(get_session)`.
- **Baseline Seeding & Snapshot Reset (`restore_database_snapshot`):** `init_db()` seeds the baseline `Space Station [0g]` `LocationContextRecord`, 6 nominal historical `TelemetryRecord` points for `AST-01`, the default `GamificationProfileRecord` for `AST-01`, and the 8 NASA/CSA `MedicalKnowledgeChunk` records when empty. `restore_database_snapshot(session)` (exposed via `PUT /api/v1/tests/dbsnapshot`) clears mutated runtime rows across `face_credentials`, `operator_checkins`, `operator_users`, `telemedicine_alerts`, `telemetry_records`, `gamification_profiles`, and `location_contexts` and re-seeds the identical clean baseline sample dataset.

## Persisted Models (`backend/app/db/models.py`)

### 1. `LocationContextRecord` (`location_contexts`)
Stores active spaceflight operational environment parameters:
- `id`: Primary key.
- `location_setting`: Operational environment (`Space Station [0g]`, `Mars [3/8g]`, etc.).
- `temperature_c`, `pressure_kpa`, `lighting_lux`, `noise_dba`, `microbial_cfu_m3`, `co2_mmhg`: ECLSS sensor metrics.
- `earth_comm_latency_sec`: Earth round-trip radio latency in seconds.
- `offline_fallback_active`: Boolean flag indicating whether delayed comms require local autonomous inference.
- `hazard_multipliers_json`: Serialized NASA HRP 5-hazards multipliers.
- `updated_at`: Timestamp of latest modification.

### 2. `TelemetryRecord` (`telemetry_records`)
Persists all multi-modal telemetry stream data:
- `id`: Primary key.
- `astronaut_id`: Identifier (e.g., `AST-01`).
- `timestamp`: UTC ingestion timestamp.
- `heart_rate_bpm`, `systolic_bp_mmhg`, `diastolic_bp_mmhg`, `blood_sugar_mg_dl`, `core_temp_c`, `spo2_percent`: Physiological telemetry.
- `sleep_hours`, `mood_score`, `stress_level`: Behavioral and cognitive telemetry.
- `suit_pressure_kpa`, `co2_partial_pressure_mmhg`, `radiation_dose_msv`: Environmental & suit telemetry.
- `visual_acuity_logmar`, `bone_mineral_density_t_score`: SANS and musculoskeletal biomarkers.
- `symptoms_json`: Crew-reported symptoms list.
- `target_anatomical_zone`: Specified or inferred anatomical zone.
- `image_path`, `image_analysis_json`: Diagnostic imaging upload metadata.
- `status`: Autonomous triage evaluation (`nominal`, `caution`, `critical`).
- `triage_tier`: Operational classification (`TIER_1_SELF_CARE`, `TIER_2_CMO_REVIEW`, `TIER_3_GROUND_SURGEON`).
- `mission_readiness_score`: Mission readiness score (0.0 to 100.0).

### 3. `TelemedicineAlertRecord` (`telemedicine_alerts`)
Persists store-and-forward telemedicine alerts for asynchronous Earth Flight Surgeon review:
- `id`: Primary key.
- `astronaut_id`: Identifier (e.g., `AST-01`).
- `timestamp`: UTC ingestion timestamp.
- `location_setting`: Spaceflight environment during alert capture.
- `triage_tier`: Classification (`TIER_3_GROUND_SURGEON`).
- `status`: Autonomous severity level (`critical`, `caution`).
- `priority`: Transmission priority (`CRITICAL`, `HIGH`, `ROUTINE`).
- `anomaly_flags_json`: Serialized list of detected clinical anomalies.
- `recommended_actions_json`: Serialized list of recommended medical actions.
- `telemetry_snapshot_json`: Serialized snapshot of vitals data.
- `transmission_status`: Store-and-forward lifecycle (`pending` | `transmitted`).
- `transmitted_at`: UTC timestamp when flushed to Earth.
- `earth_comm_latency_sec`: Radio latency at alert capture.
- `created_at`: UTC creation timestamp.

### 4. `GamificationProfileRecord` (`gamification_profiles`)
Persists astronaut routine measurement compliance, readiness streaks, tokens, and companion skins:
- `id`: Primary key.
- `astronaut_id`: Unique indexed identifier (e.g., `AST-01`).
- `readiness_streak_days`: Consecutive days of completed routine health checkups.
- `total_checkups_completed`: Lifetime count of completed checkups.
- `gachapon_tokens`: Balance of earned tokens for 3D companion skin rolls.
- `unlocked_skins_json`: Serialized list of unlocked skin identifiers.
- `equipped_skin_id`: Currently equipped 3D AI companion skin identifier.
- `completed_tasks_today_json`: Serialized list of routine task IDs completed today.
- `last_checkup_at`: UTC timestamp of the most recent checkup completion.
- `updated_at`: UTC timestamp of latest profile update.

### 5. `OperatorUserRecord`, `FaceCredentialRecord`, `OperatorCheckInRecord` (`operator_users`, `face_credentials`, `operator_checkins`)
Persisted operator profiles, local facial recognition embeddings (`embedding_json` 128-d SFace vectors mapped to `user_id`), and idempotent daily check-in logs (`backend/app/auth/models.py`).

