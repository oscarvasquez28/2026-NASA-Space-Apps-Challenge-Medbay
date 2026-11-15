"""Routine Measurement Scheduler & Gachapon Reward Engine API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.gamification.models import (
    CheckupCompleteRequest,
    CheckupCompleteResponse,
    GamificationStatusResponse,
)
from app.gamification.service import (
    complete_checkup_and_roll,
    get_gamification_status,
)

router = APIRouter(prefix="/gamification", tags=["Gamification"])


@router.get(
    "/status",
    response_model=GamificationStatusResponse,
    summary="Retrieve astronaut gamification status, routine task checklist, and companion skin catalog",
)
async def get_status_endpoint(
    astronaut_id: str = Query(default="AST-01", description="Unique astronaut identifier (e.g. AST-01)"),
    session: AsyncSession = Depends(get_session),
) -> GamificationStatusResponse:
    """Retrieve or auto-seed astronaut gamification profile, daily routine compliance, and 3D companion skins."""
    return await get_gamification_status(session, astronaut_id=astronaut_id)


@router.post(
    "/checkup-complete",
    response_model=CheckupCompleteResponse,
    summary="Record routine measurement completion, advance streak, and perform Gachapon roll",
)
async def complete_checkup_endpoint(
    request: CheckupCompleteRequest,
    session: AsyncSession = Depends(get_session),
) -> CheckupCompleteResponse:
    """Record completed routine tasks, increment streak, award tokens, and roll for rare AI companion skins."""
    return await complete_checkup_and_roll(session, request=request)
