"""Radiation dosimetry, immune dysregulation, viral reactivation, and skin/gut evaluator."""

from typing import Any, Optional

from app.triage.evaluators.models import DomainEvaluationResult, ZoneStatusType


def evaluate_radiation_immune(telemetry: Any, context: Optional[Any] = None) -> DomainEvaluationResult:
    """Evaluate cosmic/solar radiation exposure, immune compromise, and latent viral reactivation.

    Evaluates CANS cumulative dosimeter load, circadian sleep debt, stress levels,
    herpesvirus reactivation (EBV, VZV / shingles), dermatological rashes, and gut microbiome dysbiosis.
    """
    def _get(field: str, default: Any = None) -> Any:
        if isinstance(telemetry, dict):
            val = telemetry.get(field, default)
        else:
            val = getattr(telemetry, field, default)
        return default if val is None else val

    radiation_dose = _get("radiation_dose_msv", None)
    sleep_hours = float(_get("sleep_hours", 7.5))
    stress_level = float(_get("stress_level", 2.0))
    target_zone = _get("target_anatomical_zone", None)
    has_image = bool(_get("image_path", None) or _get("image_stored", False) or _get("image_metadata", None))

    raw_symptoms = _get("symptoms", [])
    symptoms = [str(s).lower() for s in raw_symptoms]
    symptoms_text = " ".join(symptoms)

    severity: ZoneStatusType = "nominal"
    flags: list[str] = []
    findings: list[str] = []
    actions: list[str] = []
    protocols: list[str] = []

    # Check for Critical triggers
    is_crit_rad = radiation_dose is not None and float(radiation_dose) >= 250.0
    is_crit_viral = any(k in symptoms_text for k in ["shingles", "herpes zoster", "severe dermatomal lesion", "vesicular outbreak"])

    if is_crit_rad or is_crit_viral:
        severity = "critical"
        if is_crit_rad:
            flags.append(f"Acute ionizing radiation hazard ({radiation_dose:.1f} mSv cumulative)")
            findings.append("Galactic Cosmic Radiation / Solar Particle Event dose exceeds acute astronaut permissible threshold (250 mSv).")
        if is_crit_viral:
            flags.append("Suspected acute varicella zoster / shingles viral reactivation")
            findings.append("Severe T-cell suppression resulting in active dermatomal viral eruption.")

        actions.extend([
            "Direct astronaut to heavily shielded SPE Storm Shelter module immediately.",
            "Initiate Oral Antiviral Protocol (Valacyclovir 1000mg TID) for acute viral reactivation.",
            "Lock dosimeter badge and initiate biodosimetry blood draw for chromosome aberration analysis.",
            "Transmit immediate critical telemedicine alert to Ground Flight Surgeon.",
        ])
        protocols.extend([
            "Emergency SPE Storm Shelter Protocol",
            "Oral Antiviral Protocol (Valacyclovir 1000mg TID)",
            "Dosimeter Badge Lockdown & Biodosimetry Blood Draw",
            "Ground Flight Surgeon Critical Telemedicine Alert",
        ])

    # Check for Caution triggers
    else:
        is_caut_rad = radiation_dose is not None and float(radiation_dose) > 50.0
        is_sleep_stress = sleep_hours < 5.5 and stress_level >= 6.0
        is_skin_gut_symptom = any(k in symptoms_text for k in ["rash", "erythema", "pruritic", "lesion", "dermatitis", "gut", "nausea", "dysbiosis"])
        is_skin_target = target_zone == "skin"

        if is_caut_rad or is_sleep_stress or is_skin_gut_symptom or is_skin_target or has_image:
            severity = "caution"
            if is_caut_rad:
                flags.append(f"Elevated radiation dosimeter reading ({radiation_dose:.1f} mSv)")
                findings.append("Cumulative CANS dosimeter load elevated above monthly nominal baseline.")
            if is_sleep_stress:
                flags.append(f"Circadian disruption and high stress (Sleep: {sleep_hours:.1f}h, Stress: {stress_level:.1f}/10)")
                findings.append("Combined sleep debt and autonomic stress suppresses cell-mediated immunity, elevating EBV/VZV reactivation risk.")
            if is_skin_gut_symptom or is_skin_target or has_image:
                flags.append("Dermal erythema / skin barrier disruption or gut dysbiosis flagged")
                findings.append("Epidermal thinning and microbial dysbiosis compromising integumentary barrier integrity.")

            actions.extend([
                "Apply topical ceramide barrier restorative moisturizer and hydrocortisone 1% cream to rash areas.",
                "Collect saliva sample for EBV/VZV viral shedding PCR assay.",
                "Provide 8.5h sleep opportunity in circadian blue-depleted crew quarters.",
                "Supplement diet with prebiotic soluble fiber and multi-strain probiotic pack.",
            ])
            protocols.extend([
                "Topical Ceramide & Hydrocortisone 1% Barrier Repair Protocol",
                "Prebiotic Soluble Fiber & Multi-Strain Probiotic Protocol",
                "Saliva PCR Viral Shedding Assay (EBV/VZV)",
                "Circadian Blue-Depleted Lighting & 8.5h Sleep Recovery Opportunity",
            ])
        else:
            severity = "nominal"
            findings.append("Radiation dosimetry, immune surveillance, and skin/gut mucosal barriers are nominal.")
            actions.append("Maintain nominal radiation logging and skin barrier hygiene schedule.")
            protocols.extend([
                "Artemis Radiation Dosimetry Standard Measures",
                "Epidermal Moisturizing Protocol",
                "Nominal Spaceflight Prebiotic Nutrition",
            ])

    self_exam_steps = [
        "Inspect forearms, torso, and skin friction points for erythematous macules or vesicular lesions.",
        "Check skin turgor and evaluate dryness on anterior forearm.",
        "Log self-reported gastrointestinal motility and abdominal comfort score.",
    ]

    rad_val = float(radiation_dose) if radiation_dose is not None else 0.0

    risk_factors = {
        "radiation_dose_msv": rad_val,
        "sleep_debt_hours": max(0.0, 7.5 - sleep_hours),
        "immune_dysregulation_index": 2.2 if severity == "critical" else (1.4 if severity == "caution" else 1.0),
        "viral_reactivation_susceptibility": "elevated" if severity != "nominal" else "low",
    }

    if severity == "critical":
        high_level = f"CRITICAL: Acute radiation hazard ({rad_val:.1f} mSv) or viral shingles reactivation. Ingress Storm Shelter and begin antiviral treatment."
    elif severity == "caution":
        high_level = "CAUTION: Immune compromise or skin rash identified. Apply topical barrier moisturizer and take prebiotic pack."
    else:
        high_level = "Nominal: Radiation dosimetry and immune barrier functions are within safe spaceflight limits."

    technical = (
        f"RadiationImmuneEvaluator: severity={severity}, radiation={rad_val:.1f}mSv, "
        f"sleep={sleep_hours:.1f}h, stress={stress_level:.1f}/10, flags={len(flags)}, protocols={len(protocols)}."
    )

    return DomainEvaluationResult(
        evaluator_id="radiation_immune",
        evaluator_name="Radiation Dosimetry & Immune Dysregulation Evaluator",
        target_zones=["skin", "gut_microbiome"],
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
