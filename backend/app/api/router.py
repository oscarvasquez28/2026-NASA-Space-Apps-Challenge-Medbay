"""Versioned API router aggregation."""

from fastapi import APIRouter

from app.api.routes.ai import router as ai_router
from app.api.routes.astronaut import router as astronaut_router
from app.api.routes.context import router as context_router
from app.api.routes.gamification import router as gamification_router
from app.api.routes.telemedicine import router as telemedicine_router
from app.api.routes.telemetry import router as telemetry_router
from app.api.routes.tests import router as tests_router
from app.api.routes.trends import router as trends_router
from app.api.routes.triage import router as triage_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(triage_router)
api_router.include_router(context_router)
api_router.include_router(telemetry_router)
api_router.include_router(astronaut_router)
api_router.include_router(trends_router)
api_router.include_router(ai_router)
api_router.include_router(gamification_router)
api_router.include_router(telemedicine_router)
api_router.include_router(tests_router)
