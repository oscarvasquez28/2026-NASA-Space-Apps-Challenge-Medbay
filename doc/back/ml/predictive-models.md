# Machine Learning Health Problem Predictor & Anomaly Detection

## Overview

The machine learning health prediction subsystem (`backend/app/ml/predictor.py`) provides multivariate anomaly detection and probabilistic risk stratification for deep-space astronaut health monitoring.

It operates as an intelligent advisory layer alongside the deterministic safety rules:
1. **Safety Floor:** Deterministic rules in `backend/app/triage/engine.py` execute first. Critical physiological boundaries (e.g. SpO2 < 90%, HR < 40 or > 150 bpm, suit pressure < 25 kPa) are immutable and cannot be overridden by ML outputs.
2. **Early Deterioration Warning:** When individual vitals remain within nominal thresholds, the ML pipeline evaluates subtle multivariate shifts, escalating to `TIER_2_CMO_REVIEW` if the anomaly score exceeds 0.65 or if combined active 5-hazards multipliers elevate operational risk.

## Pipeline Architecture

- **`IsolationForest`**: Unsupervised anomaly detection (`contamination=0.15`, 100 estimators). Generates an inverted, normalized anomaly score (0.0 to 1.0) and boolean anomaly flag.
- **`RandomForestClassifier`**: Multi-class risk stratification across the 3 clinical tiers:
  - `TIER_1_SELF_CARE` (nominal spaceflight operations)
  - `TIER_2_CMO_REVIEW` (in-flight clinical review / countermeasures)
  - `TIER_3_GROUND_SURGEON` (urgent emergency / telemedicine consult)
- **Model Persistence:** The pipeline serializes trained estimators and metadata to `backend/app/ml/models/health_predictor.joblib` via `joblib.dump()`. On startup, `get_health_predictor()` loads the cached artifact in < 5 ms, with transparent retraining fallback.

## 21-Feature Vector Specification

The feature extractor (`build_feature_vector`) constructs a standardized 1x21 matrix:

1. `heart_rate_bpm`
2. `spo2_percent`
3. `core_temp_c`
4. `systolic_bp_mmhg`
5. `diastolic_bp_mmhg`
6. `blood_sugar_mg_dl`
7. `sleep_hours`
8. `mood_score`
9. `stress_level`
10. `suit_pressure_kpa`
11. `co2_partial_pressure_mmhg`
12. `radiation_dose_msv`
13. `visual_acuity_logmar`
14. `bone_mineral_density_t_score`
15. `symptom_count`
16. `hazard_space_radiation`
17. `hazard_isolation_and_confinement`
18. `hazard_distance_from_earth`
19. `hazard_gravity_fields`
20. `hazard_hostile_closed_environments`
21. `hazard_composite_multiplier`
