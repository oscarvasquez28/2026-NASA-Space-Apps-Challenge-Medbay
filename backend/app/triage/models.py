"""Pydantic schemas for astronaut telemetry and autonomous triage results."""

from datetime import datetime, timezone
from enum import StrEnum

from pydantic import BaseModel, Field


class TriageLevel(StrEnum):
    """Mission medical triage severity classifications."""

    NOMINAL = "NOMINAL"
    CAUTION = "CAUTION"
    URGENT = "URGENT"
    CRITICAL = "CRITICAL"


class VitalSigns(BaseModel):
    """Astronaut biometric and suit/cabin environmental telemetry snapshot."""

    astronaut_id: str = Field(..., min_length=1, examples=["AST-01"])
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    heart_rate_bpm: float = Field(..., ge=0, le=300, examples=[72.0])
    spo2_percent: float = Field(..., ge=0, le=100, examples=[98.5])
    core_temp_c: float = Field(..., ge=25.0, le=45.0, examples=[37.0])
    systolic_bp_mmhg: float = Field(default=120.0, ge=40, le=260)
    suit_pressure_kpa: float | None = Field(default=None, ge=0, le=150)
    radiation_msv_hr: float | None = Field(default=None, ge=0)
    symptoms: list[str] = Field(default_factory=list)


class TriageAssessment(BaseModel):
    """Structured output returned by the autonomous triage pipeline."""

    astronaut_id: str
    triage_level: TriageLevel
    anomaly_flags: list[str]
    recommended_actions: list[str]
    summary: str
    ai_advisory: str | None = None
    evaluated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
