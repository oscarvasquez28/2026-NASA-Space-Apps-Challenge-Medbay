"""EVA decompression sickness, acute hypoxemia, suit depressurization, and vestibular ataxia guard."""

from typing import Any, Optional

from app.triage.evaluators.models import DomainEvaluationResult, ZoneStatusType


def evaluate_eva_hypoxia(telemetry: Any, context: Optional[Any] = None) -> DomainEvaluationResult:
    """Evaluate hypobaric suit integrity, decompression bends, acute hypoxemia, and vestibular ataxia.

    Monitors SpO2 saturation, suit pressure, exhaled helmet CO2 buildup, and post-EVA
    gravity transition sensorimotor ataxia.
    """
    def _get(field: str, default: Any = None) -> Any:
        if isinstance(telemetry, dict):
            val = telemetry.get(field, default)
        else:
            val = getattr(telemetry, field, default)
        return default if val is None else val

    spo2 = float(_get("spo2_percent", 98.5))
    hr = float(_get("heart_rate_bpm", 72.0))
    suit_p = _get("suit_pressure_kpa", None)
    co2 = _get("co2_partial_pressure_mmhg", None)

    raw_symptoms = _get("symptoms", [])
    symptoms = [str(s).lower() for s in raw_symptoms]
    symptoms_text = " ".join(symptoms)

    severity: ZoneStatusType = "nominal"
    flags: list[str] = []
    findings: list[str] = []
    actions: list[str] = []
    protocols: list[str] = []

    # Check for Critical triggers
    is_crit_suit = suit_p is not None and float(suit_p) < 25.0
    is_crit_hypoxemia = spo2 < 88.0
    is_crit_co2 = co2 is not None and float(co2) >= 7.0
    is_crit_bends = any(k in symptoms_text for k in ["bends", "joint pain", "chokes", "paralysis", "air embolism"])

    if is_crit_suit or is_crit_hypoxemia or is_crit_co2 or is_crit_bends:
        severity = "critical"
        if is_crit_suit:
            flags.append(f"Life-threatening EVA suit depressurization ({suit_p:.1f} kPa)")
            findings.append("Catastrophic suit pressure loss below 25.0 kPa barometric safety limit.")
        if is_crit_hypoxemia:
            flags.append(f"Severe acute hypoxemia (SpO2: {spo2:.1f}%)")
            findings.append("Critical arterial oxygen desaturation posing immediate hypoxic syncope risk.")
        if is_crit_co2:
            flags.append(f"Critical helmet CO2 hypercapnia ({co2:.1f} mmHg)")
            findings.append("Severe exhaled CO2 rebreathing in helmet dead-space.")
        if is_crit_bends:
            flags.append("Suspected Decompression Sickness (Bends) or venous gas embolism")
            findings.append("In-tissue nitrogen bubble expansion causing severe arthralgia or pulmonary chokes.")

        actions.extend([
            "Abort EVA immediately and ingress airlock.",
            "Repressurize suit and airlock to nominal cabin pressure (101.3 kPa / 14.7 psia).",
            "Initiate Bends Hyperbaric Decompression Treatment Protocol with 100% O2 wash.",
            "Transmit high-priority telemedicine ground evacuation notice.",
        ])
        protocols.extend([
            "Emergency EVA Abort & Airlock Ingress Protocol",
            "Suit/Airlock Immediate Repressurization (101.3 kPa / 14.7 psia)",
            "Bends Hyperbaric Decompression Treatment Protocol (100% O2 Wash)",
            "High-Priority Telemedicine Ground Evacuation Notice",
        ])

    # Check for Caution triggers
    else:
        is_caut_spo2 = spo2 < 95.0
        is_caut_suit = suit_p is not None and float(suit_p) < 29.6
        is_caut_co2 = co2 is not None and float(co2) > 4.0
        is_caut_hr = hr > 120.0 or hr < 50.0
        is_caut_ataxia = any(k in symptoms_text for k in ["vertigo", "dizziness", "nausea", "motion sickness", "ataxia", "tingling", "tunnel vision"])

        if is_caut_spo2 or is_caut_suit or is_caut_co2 or is_caut_hr or is_caut_ataxia:
            severity = "caution"
            if is_caut_spo2:
                flags.append(f"Sub-optimal arterial oxygen saturation (SpO2: {spo2:.1f}%)")
                findings.append("Mild exertional hypoxemia during EVA or IVA task loading.")
            if is_caut_suit:
                flags.append(f"Sub-nominal suit pressure ({suit_p:.1f} kPa)")
                findings.append("Suit operating below 29.6 kPa nominal 4.3 psia operating setpoint.")
            if is_caut_co2:
                flags.append(f"Elevated inspired CO2 partial pressure ({co2:.1f} mmHg)")
                findings.append("LiOH or amine scrubber saturation causing CO2 buildup in suit helmet.")
            if is_caut_hr:
                flags.append(f"Exertional heart rate excursion (HR: {hr:.0f} bpm)")
                findings.append("High metabolic work rate during EVA operations.")
            if is_caut_ataxia:
                flags.append("Vestibular balance ataxia or spatial disorientation reported")
                findings.append("Neuro-vestibular adaptation disturbance following gravity transition.")

            actions.extend([
                "Extend 100% O2 in-suit prebreathe schedule and throttle EVA physical workload.",
                "Inspect and replace LiOH or amine CO2 scrubbers to eliminate helmet CO2 buildup.",
                "Conduct Graybiel motion sickness and sensorimotor ataxia balance assessment.",
                "Ensure proper fluid tether rehydration.",
            ])
            protocols.extend([
                "Prebreathe Protocol Extension (100% O2 In-Suit Exercise Prebreathe)",
                "LiOH / Amine CO2 Scrubber Replacement & Purge Protocol",
                "Graybiel Motion Sickness & Sensorimotor Ataxia Balance Protocol",
                "EVA Workload Throttle & Fluid Tether Rehydration",
            ])
        else:
            severity = "nominal"
            findings.append("EVA suit barometric parameters, metabolic rate, and sensorimotor equilibrium are nominal.")
            actions.append("Maintain nominal EVA timeline and metabolic telemetry surveillance.")
            protocols.extend([
                "Nominal EVA Metabolic Telemetry Protocol",
                "Standard Prebreathe Schedule Verification",
            ])

    self_exam_steps = [
        "Verify suit wrist/neck seal integrity and inspect helmet visor defog loop.",
        "Check fingertip tactile sensitivity and evaluate joint mobility in pressurized gloves.",
        "Perform Romberg balance test (feet together, eyes closed) to assess post-EVA vestibular stability.",
    ]

    risk_factors = {
        "spo2_percent": spo2,
        "suit_pressure_kpa": float(suit_p) if suit_p is not None else 101.3,
        "co2_partial_pressure_mmhg": float(co2) if co2 is not None else 3.0,
        "decompression_risk_index": 2.5 if severity == "critical" else (1.3 if severity == "caution" else 1.0),
        "sensorimotor_ataxia_score": 1 if any(k in symptoms_text for k in ["ataxia", "vertigo", "motion sickness"]) else 0,
    }

    if severity == "critical":
        high_level = f"CRITICAL EVA EMERGENCY: SpO2 at {spo2:.1f}%, suit breach or bends risk. Abort EVA immediately and repressurize airlock."
    elif severity == "caution":
        high_level = f"CAUTION: SpO2 at {spo2:.1f}% or CO2 elevated. Extend prebreathe, check scrubber seal, and reduce work rate."
    else:
        high_level = "Nominal EVA readiness: Suit pressure, oxygenation, and vestibular balance within mission envelope."

    technical = (
        f"EVASafetyGuard: severity={severity}, SpO2={spo2:.1f}%, suit_P={suit_p}kPa, "
        f"CO2={co2}mmHg, flags={len(flags)}, protocols={len(protocols)}."
    )

    return DomainEvaluationResult(
        evaluator_id="eva_hypoxia",
        evaluator_name="EVA Decompression Sickness & Hypoxia Guard",
        target_zones=["cardiovascular_chest", "head_eyes"],
        severity=severity,
        anomaly_flags=flags,
        clinical_findings=findings,
        recommended_actions=actions,
        prescribed_protocols=protocols,
        self_exam_steps=self_exam_steps,
        risk_factors=risk_factors,
        high_level=high_level,
        technical=technical,
    )
