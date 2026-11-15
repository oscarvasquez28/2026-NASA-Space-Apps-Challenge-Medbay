"""Time-series physiological trends and forecasting API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.trends.models import TrendAnalysisResponse
from app.trends.service import INDICATOR_CONFIGS, generate_trend_analysis

router = APIRouter(prefix="/trends", tags=["trends"])


@router.get(
    "/{indicator}",
    response_model=TrendAnalysisResponse,
    summary="Retrieve time-series trend history and polynomial Ridge forecast with 95% confidence intervals",
)
async def get_trend_analysis(
    indicator: str,
    astronaut_id: str = Query(default="AST-01", description="Unique astronaut identifier (e.g. AST-01)"),
    history_limit: int = Query(default=50, ge=5, le=500, description="Max historical points to include"),
    forecast_steps: int = Query(default=10, ge=1, le=50, description="Number of future forecast steps"),
    session: AsyncSession = Depends(get_session),
) -> TrendAnalysisResponse:
    """Analyze historical physiological data and project future trajectory with threshold warning detection."""
    if indicator not in INDICATOR_CONFIGS:
        supported = ", ".join(sorted(INDICATOR_CONFIGS.keys()))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported trend indicator: '{indicator}'. Supported indicators: {supported}",
        )

    try:
        response = await generate_trend_analysis(
            indicator=indicator,
            astronaut_id=astronaut_id,
            session=session,
            history_limit=history_limit,
            forecast_steps=forecast_steps,
        )
        return response
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
