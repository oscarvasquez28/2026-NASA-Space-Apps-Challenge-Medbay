"""Service logic for telemetry triage evaluation, readiness scoring, and persistence."""

import json
from datetime import datetime, timezone
from typing import Any, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import LocationContextRecord, TelemedicineAlertRecord, TelemetryRecord
from app.telemetry.models import (
    ImageMetadata,
    TelemetryIngestRequest,
    TelemetryIngestResponse,
)
from app.triage.evaluators import evaluate_all_domains


def evaluate_telemetry_triage(
    data: TelemetryIngestRequest,
    context: Optional[Any] = None,
) -> Tuple[str, str, float, list[str], Optional[str]]:
    """Determine clinical triage status, CMO tier, readiness score, flags, and target zone."""
    critical_flags: list[str] = []
    caution_flags: list[str] = []

    # 1. Baseline Critical Rules (TIER_3_GROUND_SURGEON)
    if data.spo2_percent < 88.0:
        critical_flags.append(f"Critical hypoxemia: SpO2 at {data.spo2_percent:.1f}%")
    if data.heart_rate_bpm > 140.0:
        critical_flags.append(f"Severe tachycardia: HR at {data.heart_rate_bpm:.1f} bpm")
    elif data.heart_rate_bpm < 40.0:
        critical_flags.append(f"Critical bradycardia: HR at {data.heart_rate_bpm:.1f} bpm")

    if data.suit_pressure_kpa is not None and data.suit_pressure_kpa < 25.0:
        critical_flags.append(
            f"Life-threatening EVA suit depressurization: {data.suit_pressure_kpa:.1f} kPa",
        )
    if data.core_temp_c >= 39.5:
        critical_flags.append(f"Severe hyperthermia: Core temp at {data.core_temp_c:.1f} C")
    elif data.core_temp_c <= 35.0:
        critical_flags.append(f"Severe hypothermia: Core temp at {data.core_temp_c:.1f} C")

    # 2. Baseline Caution Rules (TIER_2_CMO_REVIEW)
    if not critical_flags:
        if data.spo2_percent < 95.0:
            caution_flags.append(f"Borderline hypoxemia: SpO2 at {data.spo2_percent:.1f}%")
        if data.heart_rate_bpm > 100.0:
            caution_flags.append(f"Elevated heart rate: HR at {data.heart_rate_bpm:.1f} bpm")
        elif data.heart_rate_bpm < 50.0:
            caution_flags.append(f"Bradycardia: HR at {data.heart_rate_bpm:.1f} bpm")
        if data.systolic_bp_mmhg > 140.0:
            caution_flags.append(f"Stage 2 hypertension: Systolic BP at {data.systolic_bp_mmhg:.1f} mmHg")
        if data.core_temp_c >= 38.0:
            caution_flags.append(f"Pyrexia / Low-grade fever: Core temp at {data.core_temp_c:.1f} C")
        if data.co2_partial_pressure_mmhg is not None and data.co2_partial_pressure_mmhg > 4.0:
            caution_flags.append(
                f"Elevated ambient/inspired CO2: {data.co2_partial_pressure_mmhg:.1f} mmHg",
            )
        if data.visual_acuity_logmar is not None and data.visual_acuity_logmar > 0.2:
            caution_flags.append(
                f"SANS acuity degradation: LogMAR {data.visual_acuity_logmar:.2f}",
            )
        if data.symptoms:
            caution_flags.append(f"Active symptoms reported: {', '.join(data.symptoms)}")

    # 3. Modular Clinical Evaluator Assessment
    evaluator_results = evaluate_all_domains(data, context)
    evaluator_critical: list[str] = []
    evaluator_caution: list[str] = []

    for _, res in evaluator_results.items():
        if res.severity == "critical":
            evaluator_critical.extend(res.anomaly_flags)
        elif res.severity == "caution":
            evaluator_caution.extend(res.anomaly_flags)

    # Classify overall status & tier with domain escalations
    if critical_flags or evaluator_critical:
        status = "critical"
        triage_tier = "TIER_3_GROUND_SURGEON"
        anomaly_flags = list(dict.fromkeys(critical_flags + evaluator_critical + caution_flags + evaluator_caution))
    elif caution_flags or evaluator_caution:
        status = "caution"
        triage_tier = "TIER_2_CMO_REVIEW"
        anomaly_flags = list(dict.fromkeys(caution_flags + evaluator_caution))
    else:
        status = "nominal"
        triage_tier = "TIER_1_SELF_CARE"
        anomaly_flags = []

    # Calculate Mission Readiness Score (0-100)
    score = 100.0
    if status == "critical":
        score -= 40.0
    elif status == "caution":
        score -= 15.0

    score -= min(25.0, len(data.symptoms) * 5.0)
    if data.stress_level > 7.0:
        score -= 10.0
    if data.sleep_hours < 5.0:
        score -= 10.0

    readiness_score = round(max(0.0, min(100.0, score)), 1)

    # Infer target anatomical zone if not explicitly provided
    target_zone = data.target_anatomical_zone
    if not target_zone:
        syms_lower = " ".join(data.symptoms).lower()
        if any(w in syms_lower for w in ["chest", "dyspnea", "shortness of breath", "palpitation"]) or data.spo2_percent < 90.0:
            target_zone = "cardiovascular_chest"
        elif any(w in syms_lower for w in ["rash", "pruritic", "erythema", "lesion", "dermatitis"]):
            target_zone = "skin"
        elif any(w in syms_lower for w in ["vision", "eye", "headache", "dizziness", "scotoma"]) or (data.visual_acuity_logmar and data.visual_acuity_logmar > 0.2):
            target_zone = "head_eyes"
        elif any(w in syms_lower for w in ["back", "spine", "lumbar", "disc"]) or (data.bone_mineral_density_t_score and data.bone_mineral_density_t_score < -1.0):
            target_zone = "spine_skeletal"
        elif any(w in syms_lower for w in ["nausea", "vomit", "stomach", "gut", "cramp"]):
            target_zone = "gut_microbiome"
        elif any(w in syms_lower for w in ["muscle", "calf", "atrophy", "joint", "limb"]) or (data.blood_sugar_mg_dl > 110.0):
            target_zone = "musculoskeletal_limbs"

    return status, triage_tier, readiness_score, anomaly_flags, target_zone


async def ingest_telemetry_data(
    data: TelemetryIngestRequest,
    session: AsyncSession,
    image_info: Optional[Tuple[str, ImageMetadata]] = None,
) -> TelemetryIngestResponse:
    """Evaluate, score, and persist telemetry data and diagnostic image attachments."""
    # Fetch active location setting for contextual binding
    context_stmt = select(LocationContextRecord).order_by(LocationContextRecord.id.desc()).limit(1)
    context_res = await session.execute(context_stmt)
    latest_context = context_res.scalar_one_or_none()
    location_setting = latest_context.location_setting if latest_context else "Space Station [0g]"
    comm_latency = latest_context.earth_comm_latency_sec if latest_context else 0.05

    # Run domain evaluators and telemetry triage
    evaluator_results = evaluate_all_domains(data, latest_context)
    status, triage_tier, readiness_score, anomaly_flags, target_zone = evaluate_telemetry_triage(
        data,
        latest_context,
    )

    image_path = None
    image_metadata = None
    image_analysis_json = None
    if image_info:
        image_path, image_metadata = image_info
        image_analysis_json = json.dumps(image_metadata.model_dump())

    record = TelemetryRecord(
        astronaut_id=data.astronaut_id,
        timestamp=datetime.now(timezone.utc),
        location_setting=location_setting,
        heart_rate_bpm=data.heart_rate_bpm,
        systolic_bp_mmhg=data.systolic_bp_mmhg,
        diastolic_bp_mmhg=data.diastolic_bp_mmhg,
        blood_sugar_mg_dl=data.blood_sugar_mg_dl,
        core_temp_c=data.core_temp_c,
        spo2_percent=data.spo2_percent,
        sleep_hours=data.sleep_hours,
        mood_score=data.mood_score,
        stress_level=data.stress_level,
        suit_pressure_kpa=data.suit_pressure_kpa,
        co2_partial_pressure_mmhg=data.co2_partial_pressure_mmhg,
        radiation_dose_msv=data.radiation_dose_msv,
        visual_acuity_logmar=data.visual_acuity_logmar,
        bone_mineral_density_t_score=data.bone_mineral_density_t_score,
        symptoms_json=json.dumps(data.symptoms),
        target_anatomical_zone=target_zone,
        image_path=image_path,
        image_analysis_json=image_analysis_json,
        status=status,
        triage_tier=triage_tier,
        mission_readiness_score=readiness_score,
    )

    session.add(record)
    await session.commit()
    await session.refresh(record)

    # Compile enriched recommended actions from domain evaluators
    recommended_actions: list[str] = []
    if status == "critical":
        recommended_actions.append("Escalate immediately to Ground Flight Surgeon queue and halt EVA/strenuous activity.")
        if data.spo2_percent < 88.0:
            recommended_actions.append("Administer supplemental O2 and verify cabin/suit pressure seal.")
        if data.suit_pressure_kpa is not None and data.suit_pressure_kpa < 25.0:
            recommended_actions.append("Execute emergency depressurization protocol and return to airlock.")
    elif status == "caution":
        recommended_actions.append("Schedule Crew Medical Officer (CMO) clinical review and repeat vitals in 15 minutes.")
    else:
        recommended_actions.append("Continue nominal Artemis Standard Measures telemetry schedule.")

    # Append domain evaluator actions and protocols
    for domain_name, ev_res in evaluator_results.items():
        if ev_res.severity in ("caution", "critical"):
            for act in ev_res.recommended_actions:
                if act not in recommended_actions:
                    recommended_actions.append(act)

    # Persist TelemedicineAlertRecord on critical / Tier 3
    if status == "critical" or triage_tier == "TIER_3_GROUND_SURGEON":
        alert = TelemedicineAlertRecord(
            astronaut_id=record.astronaut_id,
            timestamp=datetime.now(timezone.utc),
            location_setting=location_setting,
            triage_tier=triage_tier,
            status=status,
            priority="CRITICAL",
            anomaly_flags_json=json.dumps(anomaly_flags),
            recommended_actions_json=json.dumps(recommended_actions),
            telemetry_snapshot_json=json.dumps(data.model_dump(mode="json")),
            transmission_status="pending",
            earth_comm_latency_sec=comm_latency,
            created_at=datetime.now(timezone.utc),
        )
        session.add(alert)
        await session.commit()

    high_level = (
        f"Vitals check for {data.astronaut_id} is {status.upper()} (Readiness {readiness_score:.1f}%). "
        + (f"Action: {recommended_actions[0]}" if recommended_actions else "")
    )
    technical = (
        f"Telemetry[{data.astronaut_id}@{location_setting}]: HR={data.heart_rate_bpm:.1f}bpm, "
        f"SpO2={data.spo2_percent:.1f}%, Temp={data.core_temp_c:.1f}C, "
        f"BP={data.systolic_bp_mmhg:.0f}/{data.diastolic_bp_mmhg:.0f}mmHg, "
        f"Glucose={data.blood_sugar_mg_dl:.1f}mg/dL, Readiness={readiness_score:.1f}%, "
        f"Tier={triage_tier}, Flags={len(anomaly_flags)}."
    )

    return TelemetryIngestResponse(
        id=record.id,
        astronaut_id=record.astronaut_id,
        timestamp=record.timestamp,
        status=record.status,
        triage_tier=record.triage_tier,
        mission_readiness_score=record.mission_readiness_score,
        anomaly_flags=anomaly_flags,
        recommended_actions=recommended_actions,
        high_level=high_level,
        technical=technical,
        target_anatomical_zone=record.target_anatomical_zone,
        image_stored=image_path is not None,
        image_path=record.image_path,
        image_metadata=image_metadata,
    )
