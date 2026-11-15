"""Pydantic data models for multi-modal telemetry ingestion and triage scoring."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ImageMetadata(BaseModel):
    """Extracted physical and encoding properties of an uploaded diagnostic image."""

    filename: str
    content_type: str
    size_bytes: int
    width: int
    height: int
    format: str
    aspect_ratio: float


class TelemetryIngestRequest(BaseModel):
    """Incoming physiological telemetry, environmental vitals, and astronaut symptoms."""

    astronaut_id: str = Field(min_length=1, max_length=64, description="Unique astronaut identifier (e.g. AST-01)")
    heart_rate_bpm: float = Field(ge=0.0, le=300.0, description="Heart rate in beats per minute")
    systolic_bp_mmhg: float = Field(default=120.0, ge=40.0, le=260.0, description="Systolic blood pressure (mmHg)")
    diastolic_bp_mmhg: float = Field(default=80.0, ge=30.0, le=180.0, description="Diastolic blood pressure (mmHg)")
    blood_sugar_mg_dl: float = Field(default=95.0, ge=20.0, le=500.0, description="Blood glucose concentration (mg/dL)")
    core_temp_c: float = Field(default=37.0, ge=30.0, le=45.0, description="Core body temperature (Celsius)")
    spo2_percent: float = Field(default=98.5, ge=50.0, le=100.0, description="Peripheral capillary oxygen saturation (%)")
    sleep_hours: float = Field(default=7.5, ge=0.0, le=24.0, description="Total sleep hours in last 24h")
    mood_score: float = Field(default=8.0, ge=0.0, le=10.0, description="Self-reported psychological mood (0-10)")
    stress_level: float = Field(default=2.0, ge=0.0, le=10.0, description="Measured or reported autonomic stress (0-10)")
    suit_pressure_kpa: Optional[float] = Field(default=None, ge=0.0, le=150.0, description="EVA suit pressure (kPa)")
    co2_partial_pressure_mmhg: Optional[float] = Field(default=None, ge=0.0, le=50.0, description="Inspired or ambient CO2 partial pressure")
    radiation_dose_msv: Optional[float] = Field(default=None, ge=0.0, le=1000.0, description="Cumulative or acute radiation dosimeter reading (mSv)")
    visual_acuity_logmar: Optional[float] = Field(default=None, ge=-0.3, le=2.0, description="LogMAR visual acuity score for SANS monitoring")
    bone_mineral_density_t_score: Optional[float] = Field(default=None, ge=-5.0, le=3.0, description="Heel/DEXA bone mineral density T-score")
    symptoms: list[str] = Field(default_factory=list, description="List of crew-reported symptoms")
    target_anatomical_zone: Optional[str] = Field(
        default=None,
        description="Target zone: head_eyes | cardiovascular_chest | spine_skeletal | musculoskeletal_limbs | gut_microbiome | skin",
    )


class TelemetryIngestResponse(BaseModel):
    """Response detailing immediate triage evaluation, readiness score, and persistence ID."""

    id: int
    astronaut_id: str
    timestamp: datetime
    status: str = Field(description="nominal | caution | critical")
    triage_tier: str = Field(description="TIER_1_SELF_CARE | TIER_2_CMO_REVIEW | TIER_3_GROUND_SURGEON")
    mission_readiness_score: float = Field(ge=0.0, le=100.0, description="Aggregate readiness percentage")
    anomaly_flags: list[str]
    recommended_actions: list[str] = Field(default_factory=list)
    high_level: str
    technical: str
    target_anatomical_zone: Optional[str] = None
    image_stored: bool = False
    image_path: Optional[str] = None
    image_metadata: Optional[ImageMetadata] = None
