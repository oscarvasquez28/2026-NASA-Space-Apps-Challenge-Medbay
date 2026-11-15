"""Countermeasure prescriber and spaceflight accelerated musculoskeletal/metabolic aging evaluator."""

from typing import Any, Optional

from app.triage.evaluators.models import DomainEvaluationResult, ZoneStatusType


def evaluate_countermeasures_aging(telemetry: Any, context: Optional[Any] = None) -> DomainEvaluationResult:
    """Evaluate bone demineralization, postural muscle atrophy, and insulin resistance.

    Prescribes targeted countermeasures: Zero T2 exercise regimen (ARED resistive squats/deadlifts),
    Food Physiology nutritional protocols (low sodium, high protein, Vitamin D3), and Space Gardening
    microgreens cultivation for cellular health and metabolic homeostasis.
    """
    def _get(field: str, default: Any = None) -> Any:
        if isinstance(telemetry, dict):
            val = telemetry.get(field, default)
        else:
            val = getattr(telemetry, field, default)
        return default if val is None else val

    bmd = _get("bone_mineral_density_t_score", None)
    glucose = float(_get("blood_sugar_mg_dl", 95.0))
    hr = float(_get("heart_rate_bpm", 72.0))

    raw_symptoms = _get("symptoms", [])
    symptoms = [str(s).lower() for s in raw_symptoms]
    symptoms_text = " ".join(symptoms)

    severity: ZoneStatusType = "nominal"
    flags: list[str] = []
    findings: list[str] = []
    actions: list[str] = []
    protocols: list[str] = []

    # Check for Critical triggers
    is_crit_bmd = bmd is not None and float(bmd) <= -2.5
    is_crit_glucose = glucose >= 180.0
    is_crit_spine = any(k in symptoms_text for k in ["radiculopathy", "foot drop", "loss of sensation", "paralysis"])

    if is_crit_bmd or is_crit_glucose or is_crit_spine:
        severity = "critical"
        if is_crit_bmd:
            flags.append(f"Severe osteopenia/osteoporosis (BMD T-score: {bmd:.2f})")
            findings.append("Accelerated trabecular bone resorption exceeding -2.5 T-score osteoporosis threshold.")
        if is_crit_glucose:
            flags.append(f"Acute hyperglycemia / diabetic dysglycemia ({glucose:.1f} mg/dL)")
            findings.append("Severe peripheral insulin resistance posing ketoacidosis / metabolic decompensation risk.")
        if is_crit_spine:
            flags.append("Severe lumbar radiculopathy / disc extrusion symptoms")
            findings.append("Spinal cord or nerve root compression from microgravity axial elongation.")

        actions.extend([
            "Halt all high-impact axial spinal loading immediately to avoid vertebral compression fracture.",
            "Initiate emergency glycemic stabilization and insulin clinical review.",
            "Schedule urgent Ground Surgeon spine and metabolic telemedicine consult.",
        ])
        protocols.extend([
            "Halt High-Impact Axial Loading Protocol",
            "Anti-Resorptive / Bisphosphonate Clinical Review",
            "Acute Hyperglycemia Insulin / Glycemic Stabilization Protocol",
            "Urgent Ground Surgeon Spine & Metabolic Telemedicine Consult",
        ])

    # Check for Caution triggers
    else:
        is_caut_bmd = bmd is not None and float(bmd) < -1.0
        is_caut_glucose = glucose > 110.0
        is_caut_hr = hr > 85.0
        is_caut_symptom = any(k in symptoms_text for k in ["muscle weakness", "atrophy", "calf cramp", "back pain", "lumbar", "spine", "orthostatic"])

        if is_caut_bmd or is_caut_glucose or is_caut_hr or is_caut_symptom:
            severity = "caution"
            if is_caut_bmd:
                flags.append(f"Osteopenia / accelerated bone mineral loss (BMD T-score: {bmd:.2f})")
                findings.append("Microgravity bone demineralization rate exceeding 1.0% per month in weight-bearing skeleton.")
            if is_caut_glucose:
                flags.append(f"Spaceflight insulin resistance shift (Blood glucose: {glucose:.1f} mg/dL)")
                findings.append("Impaired muscle glucose uptake and metabolic shift resembling accelerated terrestrial aging.")
            if is_caut_symptom:
                flags.append("Postural slow-twitch muscle atrophy or lumbar back strain reported")
                findings.append("Soleus muscle volume deconditioning and spinal column elongation discomfort.")

            actions.extend([
                "Prescribe Zero T2 exercise regimen: 45 min ARED heavy resistive loading + 30 min CEVIS aerobic intervals.",
                "Enforce Food Physiology diet: reduce dietary sodium (<2000 mg/d), increase protein (1.2-1.5 g/kg) and Vitamin D3 (1000 IU).",
                "Assign Space Gardening daily cultivation task: harvest fresh microgreens for antioxidant supplementation.",
                "Adopt lumbar fetal sleep positioning with harness tether to relieve spinal disc strain.",
            ])
            protocols.extend([
                "Zero T2 Exercise Regimen Protocol",
                "Food Physiology Countermeasure Protocol",
                "Space Gardening Daily Cultivation Task",
                "Lumbar Fetal Sleep Positioning Protocol",
            ])
        else:
            severity = "nominal"
            findings.append("Bone mineral density, muscle fiber tone, and glycemic regulation meet nominal flight baselines.")
            actions.append("Maintain scheduled 2.5h daily exercise countermeasure block and balanced spaceflight diet.")
            protocols.extend([
                "Nominal 2.5-Hour Daily Exercise Countermeasure Block (ARED + T2/CEVIS)",
                "Standard Artemis Food System Maintenance",
            ])

    self_exam_steps = [
        "Perform single-leg heel raise against resistance tether to evaluate calf endurance.",
        "Assess lumbar spinal mobility with gentle knees-to-chest flexion stretch.",
        "Check fasting capillary blood glucose using point-of-care glucometer.",
    ]

    bmd_val = float(bmd) if bmd is not None else 0.0

    risk_factors = {
        "bone_mineral_density_t_score": bmd_val,
        "blood_sugar_mg_dl": glucose,
        "musculoskeletal_aging_acceleration_ratio": 2.1 if severity == "critical" else (1.4 if severity == "caution" else 1.0),
        "zero_t2_compliance": "required" if "Zero T2" in " ".join(protocols) else "nominal",
    }

    if severity == "critical":
        high_level = f"CRITICAL: Severe osteoporosis (T-score {bmd_val:.2f}) or glucose spike ({glucose:.0f} mg/dL). Halt spinal loading."
    elif severity == "caution":
        high_level = f"CAUTION: Bone loss or glucose shift detected. Initiate Zero T2 exercise, Food Physiology diet, and Space Gardening microgreens task."
    else:
        high_level = "Nominal musculoskeletal and metabolic health: Bone density and glucose homeostasis stable."

    technical = (
        f"CountermeasuresAgingEvaluator: severity={severity}, BMD={bmd_val:.2f}, "
        f"glucose={glucose:.1f}mg/dL, flags={len(flags)}, protocols={len(protocols)}."
    )

    return DomainEvaluationResult(
        evaluator_id="countermeasures_aging",
        evaluator_name="Countermeasure & Accelerated Aging Prescriber",
        target_zones=["spine_skeletal", "musculoskeletal_limbs"],
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
