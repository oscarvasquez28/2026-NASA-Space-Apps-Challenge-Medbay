"""Deterministic baseline triage rules for offline/low-latency spacecraft use."""

from app.triage.models import TriageAssessment, TriageLevel, VitalSigns


def evaluate_vital_signs(vitals: VitalSigns) -> TriageAssessment:
    """Evaluate astronaut vital signs against baseline physiological thresholds.

    Deterministic rules always execute first so autonomous triage remains
    functional even during Earth-communication blackout or AI provider outage.
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

    if not flags:
        summary = "All monitored physiological and suit parameters are within nominal range."
        actions.append("Continue nominal telemetry monitoring.")
    else:
        summary = f"Detected {len(flags)} anomaly flag(s); triage level classified as {severity}."

    return TriageAssessment(
        astronaut_id=vitals.astronaut_id,
        triage_level=severity,
        anomaly_flags=flags,
        recommended_actions=actions,
        summary=summary,
    )
