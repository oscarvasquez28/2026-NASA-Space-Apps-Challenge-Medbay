"""API endpoints for the astronaut anatomical status and 6-zone body aggregator."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.astronaut.models import AstronautBodyStatusResponse
from app.astronaut.service import evaluate_astronaut_body_status
from app.db.session import get_session

router = APIRouter(prefix="/astronaut", tags=["Astronaut Anatomical Status"])


@router.get(
    "/body-status",
    response_model=AstronautBodyStatusResponse,
    summary="Get 6-zone anatomical body status",
    description="Aggregates recent physiological telemetry, evaluating 6 anatomical zones with semantic UI tokens, dual-mode summaries (crew vs surgeon), self-exam checklists, and countermeasures.",
)
async def get_astronaut_body_status_endpoint(
    astronaut_id: str = Query(default="AST-01", description="Astronaut ID to evaluate"),
    session: AsyncSession = Depends(get_session),
) -> AstronautBodyStatusResponse:
    """Retrieve synthesized 6-zone anatomical health assessment."""
    return await evaluate_astronaut_body_status(
        astronaut_id=astronaut_id,
        session=session,
    )
