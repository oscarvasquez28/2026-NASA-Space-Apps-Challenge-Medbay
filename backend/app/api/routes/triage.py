"""Autonomous triage evaluation endpoints."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import generate_clinical_advisory
from app.context.models import HazardMultipliers
from app.core.config import Settings, get_settings
from app.db.models import LocationContextRecord, TelemedicineAlertRecord
from app.db.session import get_session
from app.triage.engine import evaluate_vital_signs
from app.triage.models import TriageAssessment, VitalSigns

router = APIRouter(prefix="/triage", tags=["triage"])


@router.post(
    "/evaluate",
    response_model=TriageAssessment,
    summary="Evaluate astronaut telemetry and return autonomous triage assessment",
)
async def evaluate_triage(
    vitals: VitalSigns,
    settings: Settings = Depends(get_settings),
    session: AsyncSession = Depends(get_session),
) -> TriageAssessment:
    """Run deterministic physiological triage, ML anomaly detection, and optional AI advisory enrichment."""
    # Query LocationContextRecord for active hazards if available
    context_stmt = select(LocationContextRecord).order_by(LocationContextRecord.id.desc()).limit(1)
    context_res = await session.execute(context_stmt)
    latest_context = context_res.scalar_one_or_none()
    hazards = None
    location_setting = "Space Station [0g]"
    comm_latency = 0.05
    if latest_context:
        location_setting = latest_context.location_setting
        comm_latency = latest_context.earth_comm_latency_sec
        try:
            hazards_dict = json.loads(latest_context.hazard_multipliers_json)
            hazards = HazardMultipliers(**hazards_dict)
        except Exception:
            hazards = None

    assessment = evaluate_vital_signs(vitals, hazards=hazards)
    assessment.ai_advisory = await generate_clinical_advisory(vitals, assessment, settings)

    # Auto-enqueue store-and-forward alert if critical or TIER_3_GROUND_SURGEON
    if assessment.triage_tier == "TIER_3_GROUND_SURGEON" or assessment.status == "critical":
        alert = TelemedicineAlertRecord(
            astronaut_id=vitals.astronaut_id,
            timestamp=datetime.now(timezone.utc),
            location_setting=location_setting,
            triage_tier=assessment.triage_tier,
            status=assessment.status,
            priority="CRITICAL",
            anomaly_flags_json=json.dumps(assessment.anomaly_flags),
            recommended_actions_json=json.dumps(assessment.recommended_actions),
            telemetry_snapshot_json=json.dumps(vitals.model_dump(mode="json")),
            transmission_status="pending",
            earth_comm_latency_sec=comm_latency,
            created_at=datetime.now(timezone.utc),
        )
        session.add(alert)
        await session.commit()
        assessment.telemedicine_enqueued = True

    return assessment
