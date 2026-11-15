"""SQLModel database models for context and astronaut telemetry records."""

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel

from app.gamification.models import GamificationProfileRecord
from app.rag.models import MedicalKnowledgeChunk


class LocationContextRecord(SQLModel, table=True):
    """Persisted environmental and operational context."""

    __tablename__ = "location_contexts"

    id: Optional[int] = Field(default=None, primary_key=True)
    location_setting: str = Field(index=True)
    temperature_c: float = Field(default=21.5)
    pressure_kpa: float = Field(default=101.3)
    lighting_lux: float = Field(default=450.0)
    noise_dba: float = Field(default=55.0)
    microbial_cfu_m3: float = Field(default=200.0)
    co2_mmhg: float = Field(default=3.0)
    earth_comm_latency_sec: float = Field(default=0.05)
    offline_fallback_active: bool = Field(default=False)
    hazard_multipliers_json: str = Field(default="{}")
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class TelemetryRecord(SQLModel, table=True):
    """Persisted astronaut vitals, multi-modal diagnostic data, and triage assessment."""

    __tablename__ = "telemetry_records"

    id: Optional[int] = Field(default=None, primary_key=True)
    astronaut_id: str = Field(index=True)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
    )
    location_setting: str = Field(default="Space Station [0g]")
    heart_rate_bpm: float
    systolic_bp_mmhg: float = Field(default=120.0)
    diastolic_bp_mmhg: float = Field(default=80.0)
    blood_sugar_mg_dl: float = Field(default=95.0)
    core_temp_c: float = Field(default=37.0)
    spo2_percent: float = Field(default=98.5)
    sleep_hours: float = Field(default=7.5)
    mood_score: float = Field(default=8.0)
    stress_level: float = Field(default=2.0)
    suit_pressure_kpa: Optional[float] = Field(default=None)
    co2_partial_pressure_mmhg: Optional[float] = Field(default=None)
    radiation_dose_msv: Optional[float] = Field(default=None)
    visual_acuity_logmar: Optional[float] = Field(default=None)
    bone_mineral_density_t_score: Optional[float] = Field(default=None)
    symptoms_json: str = Field(default="[]")
    target_anatomical_zone: Optional[str] = Field(default=None)
    image_path: Optional[str] = Field(default=None)
    image_analysis_json: Optional[str] = Field(default=None)
    status: str = Field(default="nominal")
    triage_tier: str = Field(default="TIER_1_SELF_CARE")
    mission_readiness_score: float = Field(default=100.0)


class TelemedicineAlertRecord(SQLModel, table=True):
    """Persisted store-and-forward telemedicine alerts for Earth Flight Surgeon review."""

    __tablename__ = "telemedicine_alerts"

    id: Optional[int] = Field(default=None, primary_key=True)
    astronaut_id: str = Field(index=True)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
    )
    location_setting: str = Field(default="Space Station [0g]")
    triage_tier: str = Field(default="TIER_3_GROUND_SURGEON", index=True)
    status: str = Field(default="critical")
    priority: str = Field(default="CRITICAL")
    anomaly_flags_json: str = Field(default="[]")
    recommended_actions_json: str = Field(default="[]")
    telemetry_snapshot_json: str = Field(default="{}")
    transmission_status: str = Field(default="pending", index=True)
    transmitted_at: Optional[datetime] = Field(default=None)
    earth_comm_latency_sec: float = Field(default=0.0)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

