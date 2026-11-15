"""Pydantic data models for time-series physiological trends and predictive forecasting."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class IndicatorName(str, Enum):
    """Supported physiological and mission readiness time-series indicators."""

    HEART_RATE_BPM = "heart_rate_bpm"
    SPO2_PERCENT = "spo2_percent"
    CORE_TEMP_C = "core_temp_c"
    RADIATION_DOSE_MSV = "radiation_dose_msv"
    BLOOD_SUGAR_MG_DL = "blood_sugar_mg_dl"
    BONE_MINERAL_DENSITY_T_SCORE = "bone_mineral_density_t_score"
    VISUAL_ACUITY_LOGMAR = "visual_acuity_logmar"
    MISSION_READINESS_SCORE = "mission_readiness_score"
    SLEEP_HOURS = "sleep_hours"
    SYSTOLIC_BP_MMHG = "systolic_bp_mmhg"
    SUIT_PRESSURE_KPA = "suit_pressure_kpa"
    CO2_PARTIAL_PRESSURE_MMHG = "co2_partial_pressure_mmhg"


class TrendPoint(BaseModel):
    """Single timestamped historical observation."""

    timestamp: datetime
    value: float


class MissionEventMarker(BaseModel):
    """Overlaid operational mission event impacting physiological trends."""

    timestamp: datetime
    event_name: str
    impact: str
    description: Optional[str] = None


class ForecastPoint(BaseModel):
    """Projected future value with 95% confidence interval bounds."""

    timestamp: datetime
    predicted_value: float
    lower_ci: float
    upper_ci: float


class TrendAnalysisResponse(BaseModel):
    """Standardized response containing historical series, mission events, forecast, and warnings."""

    indicator: str
    astronaut_id: str
    unit: str
    historical_points: list[TrendPoint]
    event_markers: list[MissionEventMarker]
    forecast_points: list[ForecastPoint]
    threshold_warning: bool
    warning_details: Optional[str] = None
    status: str = Field(description="nominal | caution | critical")
    high_level: str = Field(description="Crew-facing plain-language trend explanation")
    technical: str = Field(description="Flight Surgeon clinical regression and statistical telemetry")
