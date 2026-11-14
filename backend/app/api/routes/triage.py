"""Autonomous triage evaluation endpoints."""

from fastapi import APIRouter, Depends

from app.ai.client import generate_clinical_advisory
from app.core.config import Settings, get_settings
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
) -> TriageAssessment:
    """Run deterministic physiological triage and optional AI advisory enrichment."""
    assessment = evaluate_vital_signs(vitals)
    assessment.ai_advisory = await generate_clinical_advisory(vitals, assessment, settings)
    return assessment
