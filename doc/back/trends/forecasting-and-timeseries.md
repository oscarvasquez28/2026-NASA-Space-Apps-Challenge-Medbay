# Time-Series Health Trend Analysis & Polynomial Ridge Forecasting

## Overview

The time-series trends engine (`backend/app/trends/service.py`) powers `GET /api/v1/trends/{indicator}`, projecting physiological trajectories and mission readiness scores into the future using quadratic polynomial regression with 95% confidence intervals and automatic threshold-crossing detection.

## Supported Indicators

- `heart_rate_bpm` (`bpm`)
- `spo2_percent` (`%`)
- `core_temp_c` (`°C`)
- `radiation_dose_msv` (`mSv`)
- `blood_sugar_mg_dl` (`mg/dL`)
- `bone_mineral_density_t_score` (`T-score`)
- `visual_acuity_logmar` (`LogMAR`)
- `mission_readiness_score` (`%`)

## Algorithmic Workflow

### 1. Cold Start Baseline Synthesis
If fewer than 5 historical records exist for an astronaut, the engine synthesizes 15 realistic baseline observations spaced at 10-minute intervals ending at the current timestamp, reflecting natural biological rhythms, seamlessly merging any genuine records present.

### 2. Quadratic Polynomial Ridge Regression
- Feature mapping: $X_{poly} = \text{PolynomialFeatures}(degree=2, include\_bias=False)(t - t_0)$.
- Regularization: $\text{Ridge}(\alpha=1.0)$ applies L2 coefficient shrinkage to avoid overfitting on noisy telemetry.
- Residual variance:
  $$\sigma = \max\left(\sqrt{\frac{1}{N - 1} \sum_{i=1}^N (y_i - \hat{y}_i)^2},\; \sigma_{min}\right)$$

### 3. 95% Confidence Interval Expansion
For future step $k \in [1, M]$:
$$SE_k = \sigma \cdot \sqrt{1 + \frac{1}{N} + 0.05 \cdot k}$$
$$CI_{95\%} = \hat{y}_k \pm 1.96 \cdot SE_k$$
Bounds are clamped to physiological limits while strictly guaranteeing $\text{lower\_ci} \le \text{predicted\_value} \le \text{upper\_ci}$.

### 4. Overlaid Operational Mission Events
Three operational markers are dynamically positioned across the timeline:
1. `Microgravity Environmental Adaptation` (or `SPE Monitoring Window` for radiation)
2. `EVA Ingress / Suit Decompression Prep`
3. `ARED Resistance Exercise Protocol`

### 5. Threshold Crossing Detection
Every forecast point and CI bound is evaluated against caution and critical boundaries. If a boundary breach is detected, `threshold_warning = True`, status escalates (`caution` | `critical`), and clinical action details are returned.
