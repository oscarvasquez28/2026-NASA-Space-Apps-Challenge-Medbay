# Operator Sessions & Local Facial Recognition (`doc/back/auth/session-and-face-id.md`)

## Overview

The `backend/app/auth/` module backs the frontend session gate, idle camera lock screen, and operator directory with persistent SQLModel storage and offline-first local Python facial recognition.

## Local Python Facial Recognition Engine (`face_engine.py`)

- **Primary Pipeline:** Uses `opencv-python-headless` with OpenCV Zoo ONNX models baked into `backend/Dockerfile` under `FACE_MODEL_DIR` (`/app/models/face`):
  - **Detector:** `face_detection_yunet_2023mar.onnx` (`cv2.FaceDetectorYN`) selects the largest face bounding box in frame.
  - **Embedder:** `face_recognition_sface_2021dec.onnx` (`cv2.FaceRecognizerSF`) aligns the face crop and extracts an L2-normalized 128-d embedding vector (`model_name="sface_2021dec"`).
- **Similarity Matching:** Cosine similarity against active `face_credentials` rows matching `model_name`, using `FACE_MATCH_THRESHOLD` (default `0.363`).
- **Offline/Fallback Resilience:** When ONNX weights are unavailable outside Docker, `face_engine.py` gracefully falls back to `local_descriptor_v1` (with higher threshold `>= 0.85`) and classifies blank/uniform frames (`std < 4.0`) as `no_face`.

## Persisted Models (`models.py`)

1. **`OperatorUserRecord` (`operator_users`):**
   - `id` (PK), `name`, `callsign`, `role` (`medic` | `user`; backend enforces first operator = `medic`), `astronaut_id` (`AST-U01`, ...), `face_photo` (JPEG dataURL), `wheel_spins_claimed`, `created_at`.
2. **`FaceCredentialRecord` (`face_credentials`):**
   - `id` (PK), `user_id` (indexed mapping to `operator_users.id`), `label` (`"primary"`, etc.), `embedding_json` (128-d vector JSON), `model_name`, `is_active`, `created_at`, `last_matched_at`.
3. **`OperatorCheckInRecord` (`operator_checkins`):**
   - `id` (PK), `user_id` (indexed), `day` (`YYYY-MM-DD`, indexed), `at` (UTC).

## Session & Gamification Sync (`service.py`)

- `register_operator` extracts and stores the face embedding in `face_credentials`, enforces first-user `medic` clearance, and auto-seeds `GamificationProfileRecord` for `user.astronaut_id`.
- `identify_face` returns `"matched"` (with `matched_user` and `confidence`), `"unknown_face"`, or `"no_face"`.
- `record_operator_checkin` idempotently logs daily check-ins, calculates consecutive streaks, detects wheel-bonus spin awards — one spin per **`WHEEL_CADENCE_DAYS` consecutive** check-in days (default `7`; `wheel_every_n()` reads it from settings, `earned_spins` counts Σ floor(run/N) over each unbroken day run; a gap resets progress), and updates `GamificationProfileRecord`. Set `WHEEL_CADENCE_DAYS=1` in dev/test to earn a spin on the first check-in.
- `claim_wheel_spin` increments `wheel_spins_claimed` and persists unlocked Prize Drum skins into `GamificationProfileRecord.unlocked_skins_json`.
