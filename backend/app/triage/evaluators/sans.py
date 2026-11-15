"""Spaceflight-Associated Neuro-Ocular Syndrome (SANS) and cephalad fluid-shift evaluator."""

from typing import Any, Optional

from app.triage.evaluators.models import DomainEvaluationResult, ZoneStatusType


def evaluate_sans(telemetry: Any, context: Optional[Any] = None) -> DomainEvaluationResult:
    """Evaluate SANS risk, visual acuity loss, optic disc edema, and cephalad venous congestion.

    Prescribes Thigh Cuffs venous restriction and B-Complex 1-carbon vitamin protocols
    to counteract microgravity fluid shift and nutritional-genetic endothelial vulnerabilities.
    """
    def _get(field: str, default: Any = None) -> Any:
        if isinstance(telemetry, dict):
            val = telemetry.get(field, default)
        else:
            val = getattr(telemetry, field, default)
        return default if val is None else val

    visual_acuity = _get("visual_acuity_logmar", None)
    co2 = _get("co2_partial_pressure_mmhg", None)
    raw_symptoms = _get("symptoms", [])
    symptoms = [str(s).lower() for s in raw_symptoms]
    symptoms_text = " ".join(symptoms)

    gravity_g = 0.0
    if context:
        if isinstance(context, dict):
            gravity_g = context.get("gravity_g", 0.0)
        else:
            gravity_g = getattr(context, "gravity_g", 0.0)

    severity: ZoneStatusType = "nominal"
    flags: list[str] = []
    findings: list[str] = []
    actions: list[str] = []
    protocols: list[str] = []

    # Check for Critical triggers
    is_crit_logmar = visual_acuity is not None and float(visual_acuity) >= 0.50
    is_crit_symptom = any(k in symptoms_text for k in ["scotoma", "severe vision loss", "amaurosis", "disc edema", "papilledema"])

    if is_crit_logmar or is_crit_symptom:
        severity = "critical"
        if is_crit_logmar:
            flags.append(f"Severe SANS visual degradation (LogMAR: {visual_acuity:.2f})")
            findings.append("Marked hyperopic refractive shift and posterior globe flattening indicative of advanced SANS.")
        if is_crit_symptom:
            flags.append("Visual field scotoma or optic disc edema reported")
            findings.append("Frisén Grade 3+ optic disc edema / neuro-retinal nerve fiber layer swelling suspected.")

        actions.extend([
            "Halt high-intensity exercise and schedule immediate OCT retinal scan.",
            "Initiate Chibis / Lower Body Negative Pressure (LBNP) urgent decompression protocol (35 mmHg, 2h).",
            "Administer high-dose B-Complex vitamins (1-carbon pathway cofactor rescue).",
            "Transmit priority telemedicine alert to Ground Flight Surgeon.",
        ])
        protocols.extend([
            "Urgent OCT Retinal Thickness Scan Protocol",
            "Chibis / LBNP Urgent Decompression (35 mmHg, 2h)",
            "High-Dose B-Complex Protocol",
            "Ground Flight Surgeon Emergency Consult",
        ])

    # Check for Caution triggers
    else:
        is_caut_logmar = visual_acuity is not None and float(visual_acuity) > 0.20
        is_co2_risk = co2 is not None and float(co2) >= 4.0 and gravity_g < 0.1
        is_caut_symptom = any(k in symptoms_text for k in ["blur", "headache", "eye strain", "halo", "diplopia", "dizziness"])

        if is_caut_logmar or is_co2_risk or is_caut_symptom:
            severity = "caution"
            if is_caut_logmar:
                flags.append(f"Early SANS visual acuity shift (LogMAR: {visual_acuity:.2f})")
                findings.append("Mild hyperopic shift and optic nerve sheath distension detected.")
            if is_co2_risk:
                flags.append(f"Elevated ambient cabin CO2 ({co2:.1f} mmHg) exacerbating cephalad vasodilation")
                findings.append("Hypercapnia-induced cerebral vasodilation accelerating intracranial pressure elevation in 0g.")
            if is_caut_symptom:
                flags.append("Crew reported headache or visual disturbance symptoms")
                findings.append("Cephalad venous congestion manifesting as retro-orbital fullness or mild cephalalgia.")

            actions.extend([
                "Don Thigh Cuffs at 30-40 mmHg for 4 hours to restrict cephalad venous pooling.",
                "Administer B-Complex 1-Carbon Vitamin Protocol (Folate 800mcg, B12 1000mcg, B6 50mg) for endothelial stabilization.",
                "Perform Optical Coherence Tomography (OCT) scan and Rosenbaum near-vision check.",
                "Inspect ECLSS cabin ventilation ducting to eliminate localized CO2 micro-pockets.",
            ])
            protocols.extend([
                "Thigh Cuffs Venous Restriction Protocol (30-40 mmHg)",
                "B-Complex 1-Carbon Vitamin Protocol (Folate 800mcg, B12 1000mcg, B6 50mg)",
                "Optical Coherence Tomography (OCT) Checklist",
                "ECLSS Cabin Ventilation Micro-Pocket Clearance",
            ])
        else:
            severity = "nominal"
            findings.append("Ocular parameters and cephalad venous flow remain within nominal microgravity ranges.")
            actions.append("Maintain routine SANS visual acuity self-checks and standard mission monitoring.")
            protocols.extend([
                "Routine Near-Vision Card Check Protocol",
                "Standard Microgravity Fluid Shift Monitoring",
            ])

    self_exam_steps = [
        "Perform Rosenbaum near-vision visual acuity card check at 14 inches.",
        "Complete bilateral Amsler grid self-evaluation for central scotoma or metamorphopsia.",
        "Palpate temporal and orbital margins for focal tenderness or elevated intraocular sensation.",
    ]

    logmar_val = float(visual_acuity) if visual_acuity is not None else 0.0
    co2_val = float(co2) if co2 is not None else 3.0

    risk_factors = {
        "visual_acuity_logmar": logmar_val,
        "co2_partial_pressure_mmhg": co2_val,
        "cephalad_congestion_index": 1.45 if severity != "nominal" else 1.0,
        "one_carbon_metabolism_status": "supplemented" if "B-Complex" in " ".join(protocols) else "baseline",
    }

    if severity == "critical":
        high_level = f"CRITICAL SANS visual disturbance detected (LogMAR {logmar_val:.2f}). Perform immediate OCT retinal scan and prepare LBNP chamber."
    elif severity == "caution":
        high_level = f"CAUTION: SANS acuity degradation noted (LogMAR {logmar_val:.2f}). Don Thigh Cuffs and take prescribed B-Complex vitamin packet."
    else:
        high_level = "Nominal neuro-ocular health: Vision and optic disc profile remain stable."

    technical = (
        f"SANSEvaluator: severity={severity}, LogMAR={logmar_val:.2f}, ambient_CO2={co2_val:.1f}mmHg, "
        f"flags={len(flags)}, protocols={len(protocols)}. Thigh cuffs and 1-carbon nutritional protocols applied."
    )

    return DomainEvaluationResult(
        evaluator_id="sans",
        evaluator_name="Spaceflight-Associated Neuro-Ocular Syndrome (SANS) Evaluator",
        target_zones=["head_eyes"],
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
