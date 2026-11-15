"""Data models for the 6-zone anatomical body status and dual-view aggregator."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ZoneStatusType = Literal["nominal", "caution", "critical"]
UITokenType = Literal["status-nominal", "status-caution", "status-critical"]


class AnatomicalZoneStatus(BaseModel):
    """Health, risk, and countermeasure assessment for a specific anatomical region."""

    zone: str = Field(description="System identifier for the zone")
    label: str = Field(description="Human-readable anatomical system label")
    status: ZoneStatusType = Field(description="nominal | caution | critical")
    ui_token: UITokenType = Field(description="Semantic UI styling token (status-nominal | status-caution | status-critical)")
    active_risks: list[str] = Field(default_factory=list, description="Active physiological risks identified")
    linked_vitals: dict[str, Any] = Field(default_factory=dict, description="Vitals linked directly to this anatomical system")
    self_exam_steps: list[str] = Field(default_factory=list, description="Crew-actionable self-examination checklist")
    recommended_countermeasures: list[str] = Field(
        default_factory=list,
        description="Targeted operational countermeasures and clinical protocols",
    )
    high_level: str = Field(description="Astronaut-facing plain-language summary")
    technical: str = Field(description="Flight Surgeon telemetry, biomarker, and pathophysiological analysis")


class AstronautBodyStatusResponse(BaseModel):
    """Synthesized 6-zone anatomical body status response."""

    astronaut_id: str
    timestamp: datetime
    location_setting: str
    status: ZoneStatusType
    overall_status: ZoneStatusType
    overall_ui_token: UITokenType
    mission_readiness_score: float = Field(ge=0.0, le=100.0)
    high_level: str
    technical: str
    zones: dict[str, AnatomicalZoneStatus]
