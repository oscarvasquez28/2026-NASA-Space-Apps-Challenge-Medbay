"""Data models and schemas for the operational context and 5-hazards system."""

from datetime import datetime, timezone
from enum import StrEnum
from typing import Optional

from pydantic import BaseModel, Field


class LocationSetting(StrEnum):
    """Recognized spaceflight operational environments."""

    SPACE_STATION_0G = "Space Station [0g]"
    SPACECRAFT_0G_TRANSIT = "Spacecraft [0g Transit]"
    MOON_1_6G = "Moon [1/6g]"
    MARS_3_8G = "Mars [3/8g]"
    ROVER_EVA = "Rover / EVA"


class HazardMultipliers(BaseModel):
    """NASA Human Research Program (HRP) 5-hazards multipliers."""

    space_radiation: float = Field(ge=1.0, le=5.0, description="Radiation hazard multiplier (LEO vs deep space)")
    isolation_and_confinement: float = Field(ge=1.0, le=5.0, description="Behavioral and psychological strain")
    distance_from_earth: float = Field(ge=1.0, le=5.0, description="Evacuation impossibility and comm delay")
    gravity_fields: float = Field(ge=1.0, le=5.0, description="Musculoskeletal, SANS, and vestibular deconditioning")
    hostile_closed_environments: float = Field(ge=1.0, le=5.0, description="ECLSS habitability, toxic, and microbial load")
    composite_multiplier: float = Field(ge=1.0, le=5.0, description="Weighted composite environmental stress multiplier")


class LocationContextResponse(BaseModel):
    """Complete response detailing active environment and calculated hazards."""

    id: Optional[int] = None
    location_setting: LocationSetting
    gravity_g: float
    temperature_c: float
    pressure_kpa: float
    lighting_lux: float
    noise_dba: float
    microbial_cfu_m3: float
    co2_mmhg: float
    earth_comm_latency_sec: float
    offline_fallback_active: bool
    hazard_multipliers: HazardMultipliers
    status: str = Field(description="nominal | caution | critical")
    high_level: str
    technical: str
    updated_at: datetime


class LocationContextUpdate(BaseModel):
    """Payload to update operational environment or environmental telemetry."""

    location_setting: Optional[LocationSetting] = None
    temperature_c: Optional[float] = Field(default=None, ge=-50.0, le=60.0)
    pressure_kpa: Optional[float] = Field(default=None, ge=0.0, le=150.0)
    lighting_lux: Optional[float] = Field(default=None, ge=0.0, le=10000.0)
    noise_dba: Optional[float] = Field(default=None, ge=0.0, le=140.0)
    microbial_cfu_m3: Optional[float] = Field(default=None, ge=0.0, le=10000.0)
    co2_mmhg: Optional[float] = Field(default=None, ge=0.0, le=50.0)
    earth_comm_latency_sec: Optional[float] = Field(default=None, ge=0.0, le=3600.0)
    offline_fallback_active: Optional[bool] = None
