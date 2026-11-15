"""API endpoints for operational context and 5-hazards multipliers."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.context.models import LocationContextResponse, LocationContextUpdate
from app.context.service import get_current_location_context, update_location_context
from app.db.session import get_session

router = APIRouter(prefix="/context", tags=["Operational Context & 5-Hazards"])


@router.get(
    "/location",
    response_model=LocationContextResponse,
    summary="Get current operational context",
    description="Returns the active spaceflight operational setting, environmental metrics, and dynamic 5-hazards multipliers.",
)
async def get_location_context_endpoint(
    session: AsyncSession = Depends(get_session),
) -> LocationContextResponse:
    """Retrieve the current operational location context."""
    return await get_current_location_context(session)


@router.post(
    "/location",
    response_model=LocationContextResponse,
    summary="Update operational location context",
    description="Updates operational setting and environmental telemetry, dynamically recomputing NASA HRP 5-hazard multipliers.",
)
async def update_location_context_endpoint(
    payload: LocationContextUpdate,
    session: AsyncSession = Depends(get_session),
) -> LocationContextResponse:
    """Update operational location setting and environmental telemetry."""
    return await update_location_context(session, payload)
