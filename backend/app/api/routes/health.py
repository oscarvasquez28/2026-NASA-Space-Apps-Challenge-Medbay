"""Liveness and readiness probe endpoints."""

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings

router = APIRouter(tags=["health"])


@router.get("/health", summary="Service health check")
async def health_check(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    """Return service status for Docker Compose and Cloud Run health probes."""
    return {
        "status": "ok",
        "service": "backend",
        "environment": settings.environment,
        "triage_mode": settings.triage_mode,
        "version": settings.version,
    }
