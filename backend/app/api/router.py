"""Versioned API router aggregation."""

from fastapi import APIRouter

from app.api.routes.triage import router as triage_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(triage_router)
