# Autonomous Triage Models & Rules

## Domain Models (`backend/app/triage/models.py`)

- **`TriageLevel` (`StrEnum`):** `NOMINAL` < `CAUTION` < `URGENT` < `CRITICAL`.
- **`VitalSigns`:**
  - Required: `astronaut_id` (`str`), `heart_rate_bpm` (`0..300`), `spo2_percent` (`0..100`), `core_temp_c` (`25.0..45.0`).
  - Optional/Defaulted: `timestamp` (UTC now), `systolic_bp_mmhg` (default `120.0`), `suit_pressure_kpa` (`0..150`), `radiation_msv_hr` (`>= 0`), `symptoms` (`list[str]`).
- **`TriageAssessment`:** `astronaut_id`, `triage_level`, `anomaly_flags`, `recommended_actions`, `summary`, `ai_advisory`, `evaluated_at`.

## Deterministic Baseline Engine (`backend/app/triage/engine.py`)

`evaluate_vital_signs(vitals)` evaluates parameters offline and escalates severity monotonically:

| Parameter | Threshold | Escalates To |
| :--- | :--- | :--- |
| `spo2_percent` | `< 90.0%` | `CRITICAL` |
| `spo2_percent` | `< 94.0%` | `URGENT` |
| `heart_rate_bpm` | `< 40` or `> 150` bpm | `CRITICAL` |
| `heart_rate_bpm` | `< 50` or `> 120` bpm | `CAUTION` |
| `core_temp_c` | `>= 39.0` or `<= 35.0` C | `URGENT` |
| `core_temp_c` | `>= 38.0` or `<= 35.8` C | `CAUTION` |
| `suit_pressure_kpa` | `< 25.0` kPa (when provided) | `CRITICAL` |
