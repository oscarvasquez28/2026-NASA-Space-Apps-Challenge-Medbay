# Multi-Modal Telemetry Ingestion & Image Storage

## Ingestion Pipeline (`POST /api/v1/telemetry/ingest`)

The telemetry service accepts data over two standard MIME types:
1. `application/json`: Parsed into `TelemetryIngestRequest`.
2. `multipart/form-data`: Accepts scalar form fields alongside an optional image upload (`diagnostic_image`, `image_file`, or `image`).

## Image Validation and Storage (`backend/app/telemetry/storage.py`)

- **Format Validation:** Verified using Pillow (`PIL.Image.open`). Rejects corrupt or invalid file streams with `400 Bad Request`.
- **Metadata Extraction:** Extracts image dimensions (`width`, `height`), aspect ratio, encoding format, and byte size into `ImageMetadata`.
- **Local Storage:** Files are saved to `UPLOAD_DIR` (default `/tmp/uploads`) with a UUID prefix (`<uuid>_<filename>`).
- **GCP Cloud Storage:** If `GCS_BUCKET_NAME` is configured and credentials are present, images are mirrored to GCS; failures fall back gracefully to local storage without disrupting the request.

## Clinical Triage Scoring (`backend/app/telemetry/service.py`)

- **Critical (`status="critical"`, `triage_tier="TIER_3_GROUND_SURGEON"`):**
  - SpO2 < 88.0% (Severe hypoxemia)
  - Heart Rate > 140 bpm (Tachycardia) or < 40 bpm (Severe bradycardia)
  - Suit Pressure < 25.0 kPa (EVA suit depressurization)
  - Core Temp >= 39.5 C (Severe hyperthermia) or <= 35.0 C (Severe hypothermia)
- **Caution (`status="caution"`, `triage_tier="TIER_2_CMO_REVIEW"`):**
  - SpO2 < 95.0%
  - Heart Rate > 100 bpm or < 50 bpm
  - Systolic BP > 140 mmHg
  - Core Temp >= 38.0 C
  - Active reported symptoms
- **Nominal (`status="nominal"`, `triage_tier="TIER_1_SELF_CARE"`):**
  - All physiological metrics within nominal spaceflight limits.
- **Mission Readiness Score:** Calculated on a 0.0 to 100.0 scale, deducted by clinical severity, stress, sleep deficits, and symptoms.
- **Dual-View & Actions Output:** Every `TelemetryIngestResponse` returns `recommended_actions`, `high_level` plain-language guidance, and `technical` Flight Surgeon telemetry strings alongside `status` and `triage_tier`.
