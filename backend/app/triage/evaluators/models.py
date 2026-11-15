"""Pydantic data models for specialized NASA HRP and CSA clinical domain evaluators."""

from typing import Any, Literal
from pydantic import BaseModel, Field

ZoneStatusType = Literal["nominal", "caution", "critical"]


class DomainEvaluationResult(BaseModel):
    """Structured clinical finding returned by a specialized domain evaluator."""

    evaluator_id: str = Field(description="Unique evaluator identifier (e.g. sans, radiation_immune)")
    evaluator_name: str = Field(description="Human-readable title of the domain evaluator")
    target_zones: list[str] = Field(description="Mapped anatomical zones from the 6-zone model")
    severity: ZoneStatusType = Field(description="Clinical status: nominal | caution | critical")
    anomaly_flags: list[str] = Field(default_factory=list, description="Specific clinical anomaly alerts")
    clinical_findings: list[str] = Field(default_factory=list, description="Pathophysiological analysis findings")
    recommended_actions: list[str] = Field(default_factory=list, description="Immediate clinical / operational actions")
    prescribed_protocols: list[str] = Field(default_factory=list, description="Named NASA HRP/CSA medical protocols")
    self_exam_steps: list[str] = Field(default_factory=list, description="Crew-actionable checklist steps")
    risk_factors: dict[str, Any] = Field(default_factory=dict, description="Key numerical indicators and ratios")
    high_level: str = Field(description="Plain-language astronaut summary")
    technical: str = Field(description="Flight Surgeon telemetry and biomarker breakdown")
