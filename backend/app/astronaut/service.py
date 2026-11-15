"""Service aggregating telemetry history and evaluating 6-zone anatomical body status with NASA HRP evaluators."""

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.astronaut.models import (
    AnatomicalZoneStatus,
    AstronautBodyStatusResponse,
    UITokenType,
    ZoneStatusType,
)
from app.db.models import LocationContextRecord, TelemetryRecord
from app.triage.evaluators import evaluate_all_domains


def _token_for_status(status: ZoneStatusType) -> UITokenType:
    """Map clinical status string to semantic UI token."""
    if status == "critical":
        return "status-critical"
    if status == "caution":
        return "status-caution"
    return "status-nominal"


def _worst_status(*statuses: ZoneStatusType) -> ZoneStatusType:
    """Return the most severe status among inputs."""
    if "critical" in statuses:
        return "critical"
    if "caution" in statuses:
        return "caution"
    return "nominal"


async def evaluate_astronaut_body_status(
    astronaut_id: str,
    session: AsyncSession,
) -> AstronautBodyStatusResponse:
    """Aggregate recent telemetry and assess all 6 anatomical body zones using NASA HRP evaluators."""
    # Retrieve latest telemetry record for this astronaut
    telemetry_stmt = (
        select(TelemetryRecord)
        .where(TelemetryRecord.astronaut_id == astronaut_id)
        .order_by(TelemetryRecord.id.desc())
        .limit(1)
    )
    t_res = await session.execute(telemetry_stmt)
    latest_telemetry = t_res.scalar_one_or_none()

    # Retrieve active operational context
    context_stmt = select(LocationContextRecord).order_by(LocationContextRecord.id.desc()).limit(1)
    c_res = await session.execute(context_stmt)
    latest_context = c_res.scalar_one_or_none()
    location_setting = latest_context.location_setting if latest_context else "Space Station [0g]"

    symptoms: list[str] = []
    if latest_telemetry and latest_telemetry.symptoms_json:
        try:
            symptoms = json.loads(latest_telemetry.symptoms_json)
        except Exception:
            symptoms = []

    symptoms_str = " ".join(symptoms).lower()

    # Run modular evaluators
    eval_telemetry = latest_telemetry if latest_telemetry else {"astronaut_id": astronaut_id}
    eval_results = evaluate_all_domains(eval_telemetry, latest_context)

    sans_res = eval_results["sans"]
    rad_res = eval_results["radiation_immune"]
    eva_res = eval_results["eva_hypoxia"]
    ca_res = eval_results["countermeasures_aging"]

    # --------------------------------------------------------------------------
    # 1. Zone: head_eyes (SANS, Neuro-ocular, Cephalad Fluid Shift)
    # --------------------------------------------------------------------------
    visual_acuity = latest_telemetry.visual_acuity_logmar if latest_telemetry else None
    co2_val = (latest_telemetry.co2_partial_pressure_mmhg if latest_telemetry else None) or 3.0

    he_status: ZoneStatusType = sans_res.severity
    if latest_telemetry and latest_telemetry.core_temp_c >= 39.5:
        he_status = "critical"
    elif any(k in symptoms_str for k in ["vision", "headache", "dizziness", "scotoma", "papilledema"]):
        he_status = _worst_status(he_status, "caution")

    he_risks = list(dict.fromkeys(sans_res.clinical_findings + sans_res.anomaly_flags))
    if not he_risks:
        he_risks = ["Cephalad venous engorgement baseline in microgravity"]

    he_countermeasures = list(dict.fromkeys(sans_res.prescribed_protocols + [
        "Chibis / Lower Body Negative Pressure (LBNP) session (25 mmHg for 2 hours) to draw fluid caudally.",
        "Adjust ECLSS cabin ventilation ducting to eliminate localized CO2 micro-pockets.",
    ]))

    head_eyes = AnatomicalZoneStatus(
        zone="head_eyes",
        label="Head & Neuro-Ocular (SANS)",
        status=he_status,
        ui_token=_token_for_status(he_status),
        active_risks=he_risks,
        linked_vitals={
            "visual_acuity_logmar": visual_acuity or 0.0,
            "co2_partial_pressure_mmhg": co2_val,
            "head_symptoms": [s for s in symptoms if any(k in s.lower() for k in ["vision", "head", "eye", "dizz"])],
        },
        self_exam_steps=sans_res.self_exam_steps or [
            "Perform Rosenbaum near-vision visual acuity card check at 14 inches.",
            "Complete bilateral Amsler grid evaluation for central scotoma or metamorphopsia.",
            "Palpate temporal and orbital margins for focal tenderness or elevated tension.",
        ],
        recommended_countermeasures=he_countermeasures,
        high_level=sans_res.high_level if he_status != "nominal" else "Vision and near-focus acuity remain stable.",
        technical=(
            f"SANS assessment: LogMAR={visual_acuity or 0.0}, ambient CO2={co2_val} mmHg. "
            f"Status={he_status}. {sans_res.technical}"
        ),
    )

    # --------------------------------------------------------------------------
    # 2. Zone: cardiovascular_chest (Thoracic loop, Dysrhythmias, Hypoxia)
    # --------------------------------------------------------------------------
    hr = latest_telemetry.heart_rate_bpm if latest_telemetry else 72.0
    spo2 = latest_telemetry.spo2_percent if latest_telemetry else 98.5
    systolic = latest_telemetry.systolic_bp_mmhg if latest_telemetry else 120.0
    diastolic = latest_telemetry.diastolic_bp_mmhg if latest_telemetry else 80.0
    suit_p = latest_telemetry.suit_pressure_kpa if latest_telemetry else None

    cv_status: ZoneStatusType = "nominal"
    if spo2 < 88.0 or hr > 140.0 or hr < 40.0 or (suit_p is not None and suit_p < 25.0) or eva_res.severity == "critical":
        cv_status = "critical"
    elif spo2 < 95.0 or hr > 100.0 or hr < 50.0 or systolic > 140.0 or eva_res.severity == "caution" or any(k in symptoms_str for k in ["chest", "palpitation", "dyspnea"]):
        cv_status = "caution"

    cv_risks = list(dict.fromkeys(eva_res.clinical_findings + eva_res.anomaly_flags))
    if not cv_risks:
        cv_risks = ["Normal thoracic blood volume redistribution in 0g"]

    cv_countermeasures = list(dict.fromkeys(eva_res.prescribed_protocols + [
        "Hydration protocol with electrolyte rehydration beverage (NASA standard 0.9% saline equivalent).",
        "Engage T2 treadmill or CEVIS cycle ergometer aerobic conditioning session.",
    ]))

    cardiovascular_chest = AnatomicalZoneStatus(
        zone="cardiovascular_chest",
        label="Cardiovascular & Thoracic System",
        status=cv_status,
        ui_token=_token_for_status(cv_status),
        active_risks=cv_risks,
        linked_vitals={
            "heart_rate_bpm": hr,
            "spo2_percent": spo2,
            "blood_pressure_mmhg": f"{systolic:.0f}/{diastolic:.0f}",
            "suit_pressure_kpa": suit_p,
        },
        self_exam_steps=eva_res.self_exam_steps or [
            "Don pulse oximeter sensor on warm index finger; record steady reading over 60 seconds.",
            "Check radial pulse symmetry and palpate for irregular ectopic beats.",
            "Verify breathing comfort without orthostatic chest constriction.",
        ],
        recommended_countermeasures=cv_countermeasures,
        high_level=eva_res.high_level if cv_status != "nominal" else "Cardiovascular parameters indicate stable rhythm and blood oxygenation.",
        technical=(
            f"Vascular metrics: HR={hr} bpm, SpO2={spo2}%, BP={systolic:.0f}/{diastolic:.0f} mmHg. "
            f"Status={cv_status}. {eva_res.technical}"
        ),
    )

    # --------------------------------------------------------------------------
    # 3. Zone: spine_skeletal (Axial Elongation, Demineralization, Aging)
    # --------------------------------------------------------------------------
    bmd = latest_telemetry.bone_mineral_density_t_score if latest_telemetry else None
    sp_status: ZoneStatusType = "nominal"
    if bmd is not None and bmd <= -2.5:
        sp_status = "critical"
    elif (bmd is not None and bmd < -1.0) or ca_res.severity == "caution" or any(k in symptoms_str for k in ["spine", "back", "lumbar", "herniat", "radiculopathy"]):
        sp_status = "caution"

    sp_risks = list(dict.fromkeys(ca_res.clinical_findings + ca_res.anomaly_flags))
    if not sp_risks:
        sp_risks = ["Spinal column decompressive elongation (5-7 cm expected in 0g)"]

    sp_countermeasures = list(dict.fromkeys(ca_res.prescribed_protocols + [
        "Advanced Resistive Exercise Device (ARED) axial loading protocol (deadlifts/squats).",
        "Nightly fetal positioning with lumbar support strap in crew quarters.",
        "Daily supplementation with 1000 IU Vitamin D3 and calcium citrate.",
    ]))

    spine_skeletal = AnatomicalZoneStatus(
        zone="spine_skeletal",
        label="Spine & Skeletal System",
        status=sp_status,
        ui_token=_token_for_status(sp_status),
        active_risks=sp_risks,
        linked_vitals={
            "bone_mineral_density_t_score": bmd or 0.0,
            "spinal_symptoms": [s for s in symptoms if any(k in s.lower() for k in ["back", "spin", "lumb"])],
        },
        self_exam_steps=ca_res.self_exam_steps or [
            "Perform knees-to-chest lumbar decompression stretch for 3 minutes.",
            "Test lower extremity straight leg raise for sciatic nerve irritation or radicular tingling.",
            "Inspect sleep harness tension to prevent cervical or lumbar lordotic shearing.",
        ],
        recommended_countermeasures=sp_countermeasures,
        high_level=ca_res.high_level if sp_status != "nominal" else "Spinal curvature and disc spacing within expected range.",
        technical=(
            f"Spinal loading status: BMD T-score={bmd or 0.0}. Status={sp_status}. "
            f"Trabecular mineral density and axial unloading curves tracked."
        ),
    )

    # --------------------------------------------------------------------------
    # 4. Zone: musculoskeletal_limbs (Postural Muscle Atrophy, Soleus Loss)
    # --------------------------------------------------------------------------
    ms_status: ZoneStatusType = "nominal"
    if any(k in symptoms_str for k in ["muscle", "calf", "atrophy", "cramp", "weakness"]):
        ms_status = "caution"
    elif ca_res.severity in ("caution", "critical") and (latest_telemetry and latest_telemetry.blood_sugar_mg_dl > 110.0):
        ms_status = "caution"

    ms_risks = [f for f in ca_res.clinical_findings if any(k in f.lower() for k in ["muscle", "atrophy", "metabolic", "insulin", "soleus"])]
    if not ms_risks:
        ms_risks = ["Type I/II muscle fiber balance maintenance"]

    ms_countermeasures = [p for p in ca_res.prescribed_protocols if any(k in p.lower() for k in ["zero t2", "exercise", "gardening", "food"])]
    if not ms_countermeasures:
        ms_countermeasures = [
            "Prescribed 45-minute ARED high-intensity eccentric heel raise resistance protocol.",
            "Electrolyte hydration to prevent nighttime muscle fasciculations and cramping.",
            "Zero T2 Exercise Regimen Protocol",
        ]

    musculoskeletal_limbs = AnatomicalZoneStatus(
        zone="musculoskeletal_limbs",
        label="Musculoskeletal & Peripheral Limbs",
        status=ms_status,
        ui_token=_token_for_status(ms_status),
        active_risks=ms_risks,
        linked_vitals={
            "sleep_hours": latest_telemetry.sleep_hours if latest_telemetry else 7.5,
            "limb_symptoms": [s for s in symptoms if any(k in s.lower() for k in ["muscl", "calf", "cramp", "weak"])],
        },
        self_exam_steps=ca_res.self_exam_steps or [
            "Conduct calf girth tape measure self-audit at widest gastrocnemius circumference.",
            "Test single-leg balance and heel raises against tether resistance.",
            "Palpate Achilles tendon insertion for microgravity enthesopathy.",
        ],
        recommended_countermeasures=ms_countermeasures,
        high_level="Muscle strength and leg tone meet mission fitness requirements." if ms_status == "nominal" else "Muscle deconditioning or cramping detected. Increase daily resistive load.",
        technical=f"Soleus and gastrocnemius volume tracking. Status={ms_status}. {ca_res.technical}",
    )

    # --------------------------------------------------------------------------
    # 5. Zone: gut_microbiome (Space Motion Sickness, Gut Motility, Dysbiosis)
    # --------------------------------------------------------------------------
    gm_status: ZoneStatusType = "nominal"
    blood_sugar = latest_telemetry.blood_sugar_mg_dl if latest_telemetry else 95.0
    if blood_sugar >= 180.0:
        gm_status = "critical"
    elif blood_sugar > 110.0 or any(k in symptoms_str for k in ["nausea", "vomit", "stomach", "gut", "dysbiosis", "motion sickness"]):
        gm_status = "caution"

    gm_risks = [f for f in rad_res.clinical_findings if any(k in f.lower() for k in ["gut", "microbiome", "dysbiosis"])]
    if blood_sugar > 110.0:
        gm_risks.append(f"Spaceflight metabolic insulin resistance (Glucose {blood_sugar:.0f} mg/dL)")
    if not gm_risks:
        gm_risks = ["Normal gut peristalsis and microbiome homeostasis in microgravity"]

    gm_countermeasures = [p for p in rad_res.prescribed_protocols if any(k in p.lower() for k in ["prebiotic", "probiotic", "nutrition"])]
    gm_countermeasures.extend([p for p in ca_res.prescribed_protocols if "Food Physiology" in p or "Space Gardening" in p])
    if not gm_countermeasures:
        gm_countermeasures = [
            "Prebiotic Soluble Fiber & Multi-Strain Probiotic Protocol",
            "Food Physiology Countermeasure Protocol",
            "Space Gardening Daily Cultivation Task",
        ]

    gut_microbiome = AnatomicalZoneStatus(
        zone="gut_microbiome",
        label="Gastrointestinal & Microbiome",
        status=gm_status,
        ui_token=_token_for_status(gm_status),
        active_risks=gm_risks,
        linked_vitals={
            "blood_sugar_mg_dl": blood_sugar,
            "gi_symptoms": [s for s in symptoms if any(k in s.lower() for k in ["nausea", "vomit", "stomach", "gut"])],
        },
        self_exam_steps=rad_res.self_exam_steps or [
            "Self-rate neuro-vestibular motion sickness score on Graybiel 5-point scale.",
            "Auscultate bowel sounds using electronic stethoscope in all four quadrants.",
            "Monitor hydration intake volume and track daily bowel movement consistency.",
        ],
        recommended_countermeasures=list(dict.fromkeys(gm_countermeasures)),
        high_level="Gastrointestinal function and nutrition uptake are nominal." if gm_status == "nominal" else "GI or metabolic shift observed. Follow prebiotic and nutrition countermeasure protocol.",
        technical=f"GI motility and metabolic profile: Blood sugar={blood_sugar:.1f} mg/dL. Status={gm_status}.",
    )

    # --------------------------------------------------------------------------
    # 6. Zone: skin (Epidermal Thinning, Radiation Erythema, Barrier Breakdown)
    # --------------------------------------------------------------------------
    sk_status: ZoneStatusType = rad_res.severity
    rad_dose = latest_telemetry.radiation_dose_msv if latest_telemetry else None
    target_zone = latest_telemetry.target_anatomical_zone if latest_telemetry else None

    if target_zone == "skin" or any(k in symptoms_str for k in ["rash", "pruritic", "erythema", "lesion", "dermatitis"]):
        sk_status = _worst_status(sk_status, "caution")

    sk_risks = list(dict.fromkeys(rad_res.clinical_findings + rad_res.anomaly_flags))
    if not sk_risks:
        sk_risks = ["Dry cabin atmosphere epidermal desiccation risk"]

    sk_countermeasures = list(dict.fromkeys(rad_res.prescribed_protocols + [
        "Apply ceramide barrier restorative moisturizer twice daily after sponge cleansing.",
        "Ensure cabin HEPA filtration is free of fiberglass and particulate irritants.",
    ]))

    skin = AnatomicalZoneStatus(
        zone="skin",
        label="Skin & Integumentary System",
        status=sk_status,
        ui_token=_token_for_status(sk_status),
        active_risks=sk_risks,
        linked_vitals={
            "radiation_dose_msv": rad_dose or 0.0,
            "skin_image_present": (latest_telemetry.image_path is not None) if latest_telemetry else False,
            "skin_symptoms": [s for s in symptoms if any(k in s.lower() for k in ["rash", "prurit", "erythem", "lesion", "skin"])],
        },
        self_exam_steps=rad_res.self_exam_steps or [
            "Capture close-up macro diagnostic photo of any erythematous or pruritic skin area.",
            "Check skin turgor on forearm to assess systemic hydration status.",
            "Examine pressure contact points for abrasion.",
        ],
        recommended_countermeasures=sk_countermeasures,
        high_level=rad_res.high_level if sk_status != "nominal" else "Skin integrity is intact with no active erythema.",
        technical=(
            f"Epidermal barrier status: Radiation={rad_dose or 0.0} mSv, "
            f"Image upload logged={bool(latest_telemetry and latest_telemetry.image_path)}. Status={sk_status}."
        ),
    )

    zones_map = {
        "head_eyes": head_eyes,
        "cardiovascular_chest": cardiovascular_chest,
        "spine_skeletal": spine_skeletal,
        "musculoskeletal_limbs": musculoskeletal_limbs,
        "gut_microbiome": gut_microbiome,
        "skin": skin,
    }

    # Evaluate overall status
    if any(z.status == "critical" for z in zones_map.values()):
        overall_status: ZoneStatusType = "critical"
    elif any(z.status == "caution" for z in zones_map.values()):
        overall_status = "caution"
    else:
        overall_status = "nominal"

    overall_ui_token = _token_for_status(overall_status)
    readiness_score = (
        latest_telemetry.mission_readiness_score
        if latest_telemetry
        else 100.0
    )
    flagged_zones = [z.label for z in zones_map.values() if z.status != "nominal"]
    high_level = (
        f"Overall body status for {astronaut_id} is {overall_status.upper()} "
        f"(Mission Readiness {readiness_score:.1f}%). "
        + (
            f"Attention needed in: {', '.join(flagged_zones)}."
            if flagged_zones
            else "All 6 anatomical zones are nominal."
        )
    )
    technical = (
        f"BodyStatus[{astronaut_id}@{location_setting}]: overall={overall_status}, "
        f"readiness={readiness_score:.1f}%, flagged_zones={len(flagged_zones)}/6 "
        f"({', '.join(k for k, z in zones_map.items() if z.status != 'nominal') or 'none'})."
    )

    return AstronautBodyStatusResponse(
        astronaut_id=astronaut_id,
        timestamp=latest_telemetry.timestamp if latest_telemetry else datetime.now(timezone.utc),
        location_setting=location_setting,
        status=overall_status,
        overall_status=overall_status,
        overall_ui_token=overall_ui_token,
        mission_readiness_score=readiness_score,
        high_level=high_level,
        technical=technical,
        zones=zones_map,
    )
