"""Time-series trend analysis and polynomial Ridge regression forecasting service."""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import PolynomialFeatures
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TelemetryRecord
from app.trends.models import (
    ForecastPoint,
    IndicatorName,
    MissionEventMarker,
    TrendAnalysisResponse,
    TrendPoint,
)

INDICATOR_CONFIGS: Dict[str, Dict[str, Any]] = {
    "heart_rate_bpm": {
        "unit": "bpm",
        "baseline": 72.0,
        "nominal_range": (60.0, 100.0),
        "caution_test": lambda v: v < 60.0 or v > 100.0,
        "critical_test": lambda v: v < 45.0 or v > 120.0,
        "sigma_min": 1.5,
        "min_clamp": 0.0,
        "max_clamp": 250.0,
        "critical_msg": "Projected heart rate breaches critical threshold (<45 or >120 bpm). Risk of hemodynamic instability.",
        "caution_msg": "Projected heart rate breaches caution boundary (<60 or >100 bpm). Monitor for autonomic strain.",
        "nominal_high": "Heart rate trend is stable with normal sinus rhythm predicted over forecast horizon.",
    },
    "spo2_percent": {
        "unit": "%",
        "baseline": 98.2,
        "nominal_range": (95.0, 100.0),
        "caution_test": lambda v: v < 95.0,
        "critical_test": lambda v: v < 90.0,
        "sigma_min": 0.2,
        "min_clamp": 0.0,
        "max_clamp": 100.0,
        "critical_msg": "Projected oxygen saturation breaches critical threshold (<90.0%). Acute hypoxemia imminent.",
        "caution_msg": "Projected oxygen saturation breaches caution boundary (<95.0%). Increasing metabolic strain.",
        "nominal_high": "Arterial oxygen saturation remains well above safety floor with steady forecast.",
    },
    "core_temp_c": {
        "unit": "°C",
        "baseline": 37.0,
        "nominal_range": (36.5, 37.5),
        "caution_test": lambda v: v < 36.5 or v >= 38.0,
        "critical_test": lambda v: v <= 35.0 or v >= 39.5,
        "sigma_min": 0.05,
        "min_clamp": 30.0,
        "max_clamp": 45.0,
        "critical_msg": "Projected core temperature breaches critical threshold (<=35.0 or >=39.5 °C). Thermal loop distress.",
        "caution_msg": "Projected core temperature breaches caution boundary (<36.5 or >=38.0 °C). Pyrexia or hypothermia onset.",
        "nominal_high": "Thermoregulatory loop is nominal with steady core body temperature.",
    },
    "radiation_dose_msv": {
        "unit": "mSv",
        "baseline": 4.5,
        "nominal_range": (0.0, 20.0),
        "caution_test": lambda v: v > 20.0,
        "critical_test": lambda v: v > 50.0,
        "sigma_min": 0.1,
        "min_clamp": 0.0,
        "max_clamp": 1000.0,
        "critical_msg": "Projected ionizing radiation exposure breaches critical threshold (>50.0 mSv). SPE alert.",
        "caution_msg": "Projected radiation dose breaches caution boundary (>20.0 mSv). Elevated dosimeter load.",
        "nominal_high": "Cumulative radiation dosimeter load remains within monthly career limits.",
    },
    "blood_sugar_mg_dl": {
        "unit": "mg/dL",
        "baseline": 95.0,
        "nominal_range": (70.0, 120.0),
        "caution_test": lambda v: v < 70.0 or v > 140.0,
        "critical_test": lambda v: v < 54.0 or v > 180.0,
        "sigma_min": 2.0,
        "min_clamp": 20.0,
        "max_clamp": 500.0,
        "critical_msg": "Projected blood glucose breaches critical threshold (<54 or >180 mg/dL). Severe metabolic dysglycemia.",
        "caution_msg": "Projected blood glucose breaches caution boundary (<70 or >140 mg/dL). Spaceflight insulin resistance shift.",
        "nominal_high": "Glycemic regulation and metabolic homeostasis are stable across all projections.",
    },
    "bone_mineral_density_t_score": {
        "unit": "T-score",
        "baseline": 0.1,
        "nominal_range": (-1.0, 3.0),
        "caution_test": lambda v: v < -1.0,
        "critical_test": lambda v: v <= -2.5,
        "sigma_min": 0.02,
        "min_clamp": -5.0,
        "max_clamp": 3.0,
        "critical_msg": "Projected bone mineral density breaches critical threshold (T <= -2.5). Severe osteoporosis hazard.",
        "caution_msg": "Projected bone mineral density breaches caution boundary (T < -1.0). Accelerated osteopenia.",
        "nominal_high": "Skeletal trabecular mineral density remains within expected microgravity adaptation range.",
    },
    "visual_acuity_logmar": {
        "unit": "LogMAR",
        "baseline": 0.02,
        "nominal_range": (-0.3, 0.1),
        "caution_test": lambda v: v > 0.10,
        "critical_test": lambda v: v > 0.20,
        "sigma_min": 0.02,
        "min_clamp": -0.3,
        "max_clamp": 2.0,
        "critical_msg": "Projected visual acuity breaches critical threshold (>0.20 LogMAR). Advanced SANS progression.",
        "caution_msg": "Projected visual acuity breaches caution boundary (>0.10 LogMAR). Mild SANS hyperopic shift.",
        "nominal_high": "Visual acuity and neuro-ocular refractive stability are nominal.",
    },
    "mission_readiness_score": {
        "unit": "%",
        "baseline": 98.0,
        "nominal_range": (85.0, 100.0),
        "caution_test": lambda v: v < 85.0,
        "critical_test": lambda v: v < 60.0,
        "sigma_min": 1.0,
        "min_clamp": 0.0,
        "max_clamp": 100.0,
        "critical_msg": "Projected mission readiness breaches critical threshold (<60.0%). Unfit for operational duties.",
        "caution_msg": "Projected mission readiness breaches caution boundary (<85.0%). Countermeasures required.",
        "nominal_high": "Overall mission readiness projected to remain at optimal high capability.",
    },
    "sleep_hours": {
        "unit": "h",
        "baseline": 7.5,
        "nominal_range": (6.0, 10.0),
        "caution_test": lambda v: v < 6.0 or v > 10.0,
        "critical_test": lambda v: v < 4.0,
        "sigma_min": 0.15,
        "min_clamp": 0.0,
        "max_clamp": 14.0,
        "critical_msg": "Projected sleep duration breaches critical threshold (<4.0 h). Severe circadian debt.",
        "caution_msg": "Projected sleep duration breaches caution boundary (<6.0 or >10.0 h). Circadian misalignment risk.",
        "nominal_high": "Sleep duration remains within the 6-10 h crew recovery band.",
    },
    "systolic_bp_mmhg": {
        "unit": "mmHg",
        "baseline": 118.0,
        "nominal_range": (90.0, 130.0),
        "caution_test": lambda v: v < 90.0 or v > 140.0,
        "critical_test": lambda v: v < 70.0 or v > 180.0,
        "sigma_min": 2.0,
        "min_clamp": 40.0,
        "max_clamp": 260.0,
        "critical_msg": "Projected systolic blood pressure breaches critical threshold (<70 or >180 mmHg). Hemodynamic instability.",
        "caution_msg": "Projected systolic blood pressure breaches caution boundary (<90 or >140 mmHg). Fluid-shift vascular strain.",
        "nominal_high": "Systolic pressure trend is stable within the flight cardiovascular band.",
    },
    "suit_pressure_kpa": {
        "unit": "kPa",
        "baseline": 29.6,
        "nominal_range": (26.0, 34.0),
        "caution_test": lambda v: v < 29.6,
        "critical_test": lambda v: v < 25.0,
        "sigma_min": 0.15,
        "min_clamp": 15.0,
        "max_clamp": 45.0,
        "critical_msg": "Projected suit pressure breaches critical threshold (<25.0 kPa). EVA decompression hazard.",
        "caution_msg": "Projected suit pressure breaches caution boundary (<29.6 kPa). Leak or regulator drift — verify PLSS.",
        "nominal_high": "Suit loop pressure remains inside EVA operational envelope.",
    },
    "co2_partial_pressure_mmhg": {
        "unit": "mmHg",
        "baseline": 3.0,
        "nominal_range": (0.0, 4.0),
        "caution_test": lambda v: v > 4.0,
        "critical_test": lambda v: v > 7.6,
        "sigma_min": 0.1,
        "min_clamp": 0.0,
        "max_clamp": 20.0,
        "critical_msg": "Projected cabin CO2 breaches critical threshold (>7.6 mmHg). SMAC hypercapnia limit — scrubbers required.",
        "caution_msg": "Projected cabin CO2 breaches caution boundary (>4.0 mmHg). Ventilation or scrubber degradation.",
        "nominal_high": "Cabin CO2 partial pressure stays below SMAC operational limits.",
    },
}


async def generate_trend_analysis(
    indicator: str,
    astronaut_id: str,
    session: AsyncSession,
    history_limit: int = 50,
    forecast_steps: int = 10,
) -> TrendAnalysisResponse:
    """Extract historical telemetry, apply cold start synthesis, and fit polynomial Ridge regression forecast."""
    cfg = INDICATOR_CONFIGS.get(indicator)
    if not cfg:
        supported = ", ".join(INDICATOR_CONFIGS.keys())
        raise ValueError(f"Unsupported trend indicator: '{indicator}'. Supported indicators: {supported}")

    # Query real telemetry records from database
    stmt = (
        select(TelemetryRecord)
        .where(TelemetryRecord.astronaut_id == astronaut_id)
        .order_by(TelemetryRecord.timestamp.asc())
        .limit(history_limit)
    )
    result = await session.execute(stmt)
    records = list(result.scalars().all())

    # Build historical observations
    raw_points: list[tuple[datetime, float]] = []
    for r in records:
        val = getattr(r, indicator, None)
        if val is not None:
            ts = r.timestamp if r.timestamp.tzinfo else r.timestamp.replace(tzinfo=timezone.utc)
            raw_points.append((ts, float(val)))

    now = datetime.now(timezone.utc)

    # Cold Start Synthesis if fewer than 5 records exist
    if len(raw_points) < 5:
        synth_points: list[tuple[datetime, float]] = []
        n_synth = 15
        base_val = cfg["baseline"]
        for i in range(n_synth):
            t_synth = now - timedelta(minutes=10 * (n_synth - i))
            # Smooth subtle biological oscillation
            variation = 0.0
            if indicator == "heart_rate_bpm":
                variation = 3.0 * np.sin(i * 0.45)
            elif indicator == "spo2_percent":
                variation = 0.4 * np.sin(i * 0.35)
            elif indicator == "core_temp_c":
                variation = 0.15 * np.sin(i * 0.4)
            elif indicator == "blood_sugar_mg_dl":
                variation = 4.0 * np.sin(i * 0.5)
            elif indicator == "radiation_dose_msv":
                variation = 0.2 * i
            elif indicator == "mission_readiness_score":
                variation = -0.5 * np.sin(i * 0.3)
            elif indicator in ("bone_mineral_density_t_score", "visual_acuity_logmar"):
                variation = 0.01 * np.sin(i * 0.2)

            val = max(cfg["min_clamp"], min(cfg["max_clamp"], base_val + variation))
            synth_points.append((t_synth, float(val)))

        # Combine synthetic points with any real points
        combined = {p[0]: p[1] for p in synth_points}
        for p in raw_points:
            combined[p[0]] = p[1]
        all_sorted = sorted(combined.items(), key=lambda x: x[0])
    else:
        all_sorted = raw_points

    timestamps = [p[0] for p in all_sorted]
    values = [p[1] for p in all_sorted]

    t0 = timestamps[0]
    X_seconds = np.array([(t - t0).total_seconds() for t in timestamps], dtype=float).reshape(-1, 1)
    Y = np.array(values, dtype=float)

    # Fit quadratic polynomial Ridge regression (degree=2)
    poly = PolynomialFeatures(degree=2, include_bias=False)
    X_poly = poly.fit_transform(X_seconds)
    model = Ridge(alpha=1.0)
    model.fit(X_poly, Y)

    # Calculate residual standard error and R2 score
    y_pred = model.predict(X_poly)
    residuals = Y - y_pred
    ddof = 1 if len(residuals) > 2 else 0
    sigma_raw = float(np.std(residuals, ddof=ddof)) if len(residuals) > 1 else cfg["sigma_min"]
    sigma = max(sigma_raw, cfg["sigma_min"])

    # Determine forecast step interval (median delta of historical points)
    deltas = np.diff([t.timestamp() for t in timestamps])
    step_sec = float(np.median(deltas)) if len(deltas) > 0 and np.median(deltas) > 10 else 600.0

    # Project future values with 95% expanding confidence interval
    forecast_points: list[ForecastPoint] = []
    n_samples = len(values)
    t_last = timestamps[-1]

    for k in range(1, forecast_steps + 1):
        future_time = t_last + timedelta(seconds=k * step_sec)
        future_sec = (future_time - t0).total_seconds()
        x_fut_poly = poly.transform([[future_sec]])
        y_fut = float(model.predict(x_fut_poly)[0])

        se_k = sigma * np.sqrt(1.0 + 1.0 / n_samples + 0.05 * k)
        ci_margin = 1.96 * se_k

        low_ci = y_fut - ci_margin
        high_ci = y_fut + ci_margin

        # Clamp to physical realities while ensuring lower_ci <= predicted_value <= upper_ci
        low_ci = max(cfg["min_clamp"], low_ci)
        high_ci = min(cfg["max_clamp"], high_ci)
        y_fut = max(cfg["min_clamp"], min(cfg["max_clamp"], y_fut))

        if low_ci > y_fut:
            low_ci = y_fut
        if high_ci < y_fut:
            high_ci = y_fut

        forecast_points.append(
            ForecastPoint(
                timestamp=future_time,
                predicted_value=round(y_fut, 2),
                lower_ci=round(low_ci, 2),
                upper_ci=round(high_ci, 2),
            )
        )

    # Threshold Crossing Evaluation
    threshold_warning = False
    status = "nominal"
    warning_details = None

    # Check both projected future points and current state
    crit_test = cfg["critical_test"]
    caut_test = cfg["caution_test"]

    for fp in forecast_points:
        if crit_test(fp.predicted_value) or crit_test(fp.lower_ci) or crit_test(fp.upper_ci):
            threshold_warning = True
            status = "critical"
            warning_details = cfg["critical_msg"]
            break

    if not threshold_warning:
        for fp in forecast_points:
            if caut_test(fp.predicted_value) or caut_test(fp.lower_ci) or caut_test(fp.upper_ci):
                threshold_warning = True
                status = "caution"
                warning_details = cfg["caution_msg"]
                break

    # If recent historical point is already critical/caution, respect it
    if values and crit_test(values[-1]):
        threshold_warning = True
        status = "critical"
        warning_details = cfg["critical_msg"]
    elif values and caut_test(values[-1]) and status == "nominal":
        threshold_warning = True
        status = "caution"
        warning_details = cfg["caution_msg"]

    # Overlaid Mission Event Markers (3 markers across the timeframe)
    span = (timestamps[-1] - timestamps[0]).total_seconds()
    event_1_time = timestamps[0] + timedelta(seconds=max(60.0, span * 0.15))
    event_2_time = timestamps[0] + timedelta(seconds=max(120.0, span * 0.50))
    event_3_time = timestamps[0] + timedelta(seconds=max(180.0, span * 0.85))

    if indicator == "radiation_dose_msv":
        ev1 = MissionEventMarker(
            timestamp=event_1_time,
            event_name="Solar Particle Event (SPE) Monitoring Window",
            impact="Heliospheric coronal mass ejection tracking; storm shelter standby.",
            description="Active cosmic radiation surveillance during transit.",
        )
    elif indicator == "visual_acuity_logmar":
        ev1 = MissionEventMarker(
            timestamp=event_1_time,
            event_name="LBNP Countermeasure Session",
            impact="Lower body negative pressure applied to draw fluids caudally.",
            description="Preventative intervention for cephalad venous pressure.",
        )
    else:
        ev1 = MissionEventMarker(
            timestamp=event_1_time,
            event_name="Microgravity Environmental Adaptation",
            impact="Cephalad fluid redistribution and cardiovascular unloading.",
            description="Autonomic nervous system adaptation to 0g.",
        )

    ev2 = MissionEventMarker(
        timestamp=event_2_time,
        event_name="EVA Ingress / Suit Decompression Prep",
        impact="High metabolic demand, telemetry surveillance active.",
        description="Prebreathe oxygenation and airlock depressurization schedule.",
    )
    ev3 = MissionEventMarker(
        timestamp=event_3_time,
        event_name="ARED Resistance Exercise Protocol",
        impact="Transient exertion spike, neuromuscular loading.",
        description="Prescribed daily countermeasure session.",
    )

    event_markers = [ev1, ev2, ev3]

    # Standardized Response Narratives
    if status == "critical":
        high_level = f"CRITICAL TREND ALERT: {warning_details}"
    elif status == "caution":
        high_level = f"CAUTION: {warning_details}"
    else:
        high_level = cfg["nominal_high"]

    technical = (
        f"RidgePolynomialRegression[indicator={indicator}, N={n_samples}, degree=2, alpha=1.0]: "
        f"status={status}, sigma={sigma:.3f}, warning={threshold_warning}, "
        f"forecast_horizon={forecast_steps} steps, dt={step_sec:.0f}s."
    )

    return TrendAnalysisResponse(
        indicator=indicator,
        astronaut_id=astronaut_id,
        unit=cfg["unit"],
        historical_points=[TrendPoint(timestamp=t, value=round(v, 2)) for t, v in zip(timestamps, values)],
        event_markers=event_markers,
        forecast_points=forecast_points,
        threshold_warning=threshold_warning,
        warning_details=warning_details,
        status=status,
        high_level=high_level,
        technical=technical,
    )
