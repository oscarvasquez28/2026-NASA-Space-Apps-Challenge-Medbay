"""Deterministic baseline triage rules combined with ML physiological anomaly scoring."""

from typing import Optional

from app.context.models import HazardMultipliers
from app.ml.predictor import HealthPredictor, get_health_predictor
from app.triage.models import TriageAssessment, TriageLevel, VitalSigns


def evaluate_vital_signs(
    vitals: VitalSigns,
    hazards: Optional[HazardMultipliers] = None,
    predictor: Optional[HealthPredictor] = None,
) -> TriageAssessment:
    """Evaluate astronaut vital signs against baseline physiological thresholds and ML anomalies.

    Deterministic rules execute first so autonomous triage remains functional even
    during Earth-communication blackout or AI provider outage (offline-first safety floor).
    The ML anomaly detector provides early multivariate deterioration warnings.
    """
    flags: list[str] = []
    actions: list[str] = []
    severity = TriageLevel.NOMINAL

    def escalate(target: TriageLevel) -> None:
        nonlocal severity
        order = [
            TriageLevel.NOMINAL,
            TriageLevel.CAUTION,
            TriageLevel.URGENT,
            TriageLevel.CRITICAL,
        ]
        if order.index(target) > order.index(severity):
            severity = target

    # 1. Deterministic Rule Checks (Hard Physiological Floor)
    if vitals.spo2_percent < 90.0:
        flags.append(f"Severe hypoxemia risk (SpO2={vitals.spo2_percent:.1f}%)")
        actions.append("Verify suit/cabin O2 supply and inspect mask seal immediately.")
        escalate(TriageLevel.CRITICAL)
    elif vitals.spo2_percent < 94.0:
        flags.append(f"Borderline low oxygen saturation (SpO2={vitals.spo2_percent:.1f}%)")
        actions.append("Increase O2 flow monitoring and re-check pulse oximeter placement.")
        escalate(TriageLevel.URGENT)

    if vitals.heart_rate_bpm < 40.0 or vitals.heart_rate_bpm > 150.0:
        flags.append(f"Extreme heart rate ({vitals.heart_rate_bpm:.0f} bpm)")
        actions.append("Initiate ECG telemetry review and halt strenuous EVA/IVA activity.")
        escalate(TriageLevel.CRITICAL)
    elif vitals.heart_rate_bpm < 50.0 or vitals.heart_rate_bpm > 120.0:
        flags.append(f"Elevated/abnormal heart rate ({vitals.heart_rate_bpm:.0f} bpm)")
        actions.append("Monitor resting heart rate over next 5 minutes and assess hydration.")
        escalate(TriageLevel.CAUTION)

    if vitals.core_temp_c >= 39.0 or vitals.core_temp_c <= 35.0:
        flags.append(f"Critical core temperature ({vitals.core_temp_c:.1f} C)")
        actions.append("Adjust Liquid Cooling and Ventilation Garment (LCVG) thermal loop.")
        escalate(TriageLevel.URGENT)
    elif vitals.core_temp_c >= 38.0 or vitals.core_temp_c <= 35.8:
        flags.append(f"Core temperature deviation ({vitals.core_temp_c:.1f} C)")
        actions.append("Check thermal loop setpoint and log repeat core temperature.")
        escalate(TriageLevel.CAUTION)

    if vitals.suit_pressure_kpa is not None and vitals.suit_pressure_kpa < 25.0:
        flags.append(f"Low suit pressure ({vitals.suit_pressure_kpa:.1f} kPa)")
        actions.append("Execute emergency depressurization protocol and return to airlock.")
        escalate(TriageLevel.CRITICAL)

    # 2. ML Predictor Scoring
    if predictor is None:
        predictor = get_health_predictor()

    X = predictor.build_feature_vector(vitals, hazards)
    is_anomaly, anomaly_score = predictor.predict_anomaly(X)
    ml_tier, probabilities = predictor.predict_triage_tier(
        X,
        hazards.composite_multiplier if hazards else 1.0,
    )

    # 3. Hybrid Synthesis & Escalation Logic
    # Hard floor: deterministic CRITICAL is immutable
    if severity == TriageLevel.CRITICAL:
        status = "critical"
        triage_tier = "TIER_3_GROUND_SURGEON"
        readiness_score = max(0.0, round(60.0 - len(flags) * 10.0, 1))
    elif severity in (TriageLevel.URGENT, TriageLevel.CAUTION):
        status = "caution"
        triage_tier = "TIER_2_CMO_REVIEW"
        readiness_score = max(0.0, round(85.0 - len(flags) * 5.0, 1))
    else:
        # Deterministic rules are nominal; inspect ML anomaly score
        if is_anomaly and anomaly_score > 0.65:
            severity = TriageLevel.CAUTION
            status = "caution"
            triage_tier = "TIER_2_CMO_REVIEW"
            flags.append(f"Predictive physiological anomaly detected (score: {anomaly_score:.2f})")
            actions.insert(0, "Schedule CMO clinical review and repeat vitals in 15 minutes.")
            readiness_score = round(max(50.0, 100.0 - anomaly_score * 35.0), 1)
        else:
            status = "nominal"
            triage_tier = "TIER_1_SELF_CARE"
            readiness_score = 100.0

    if not flags:
        summary = "All monitored physiological and suit parameters are within nominal range."
        actions.append("Continue nominal telemetry monitoring.")
    else:
        summary = f"Detected {len(flags)} anomaly flag(s); triage level classified as {severity} ({triage_tier})."

    high_level = f"{summary} Next step: {actions[0]}"
    technical = (
        f"TriageEngine[{vitals.astronaut_id}]: level={severity}, status={status}, "
        f"tier={triage_tier}, readiness={readiness_score:.1f}%, anomaly_score={anomaly_score:.2f}, "
        f"HR={vitals.heart_rate_bpm:.1f}bpm, SpO2={vitals.spo2_percent:.1f}%, "
        f"Temp={vitals.core_temp_c:.1f}C, BP_sys={vitals.systolic_bp_mmhg:.0f}mmHg."
    )

    return TriageAssessment(
        astronaut_id=vitals.astronaut_id,
        triage_level=severity,
        status=status,
        triage_tier=triage_tier,
        mission_readiness_score=readiness_score,
        anomaly_flags=flags,
        recommended_actions=actions,
        summary=summary,
        high_level=high_level,
        technical=technical,
        ml_anomaly_score=anomaly_score,
        predicted_probabilities=probabilities,
    )
