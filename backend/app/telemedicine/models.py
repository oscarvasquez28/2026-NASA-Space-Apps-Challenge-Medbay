"""Data models and schemas for Tempus Pro asynchronous telemedicine sync."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TempusProPacketSchema(BaseModel):
    """Store-and-forward telemetry and clinical assessment bundle ("Tempus Pro" packet)."""

    packet_id: int = Field(description="Unique telemedicine alert record ID")
    astronaut_id: str = Field(description="Astronaut identifier (e.g., AST-01)")
    timestamp: datetime = Field(description="Timestamp when alert was captured")
    location_setting: str = Field(description="Operational environment during capture")
    triage_tier: str = Field(description="TIER_1_SELF_CARE | TIER_2_CMO_REVIEW | TIER_3_GROUND_SURGEON")
    status: str = Field(description="Triage status: nominal | caution | critical")
    priority: str = Field(description="Transmission priority: CRITICAL | HIGH | ROUTINE")
    transmission_status: str = Field(
        default="pending",
        description="Current transmission lifecycle: pending | transmitted",
    )
    transmitted_at: Optional[datetime] = Field(
        default=None,
        description="UTC timestamp when packet was transmitted/flushed to Earth",
    )
    earth_comm_latency_sec: float = Field(
        description="One-way radio latency to Earth at packet creation (seconds)"
    )
    anomaly_flags: List[str] = Field(
        default_factory=list,
        description="List of detected clinical or physiological anomalies",
    )
    recommended_actions: List[str] = Field(
        default_factory=list,
        description="Autonomous and flight surgeon recommended clinical actions",
    )
    standard_measures_telemetry: Dict[str, Any] = Field(
        default_factory=dict,
        description="Snapshot of multi-modal physiological telemetry from latest TelemetryRecord",
    )
    trend_forecasts_summary: Dict[str, Any] = Field(
        default_factory=dict,
        description="Ridge regression forecasting summary for key indicators (heart_rate_bpm, spo2_percent)",
    )


class TelemedicineSyncQueueResponse(BaseModel):
    """Standardized response for telemedicine sync queue inspect endpoint."""

    status: str = Field(description="nominal | caution | critical")
    high_level: str = Field(description="Crew-facing plain-language queue status")
    technical: str = Field(description="Flight Surgeon telemetry transmission telemetry")
    location_setting: str = Field(description="Current operational setting")
    earth_comm_latency_sec: float = Field(description="Current Earth radio latency (seconds)")
    offline_fallback_active: bool = Field(description="True if comm delay requires local autonomous buffering")
    comm_window_open: bool = Field(description="True if ground comm link is active and transmitting")
    pending_count: int = Field(description="Number of buffered packets awaiting transmission")
    transmitted_count: int = Field(description="Number of packets successfully transmitted to Earth")
    packets: List[TempusProPacketSchema] = Field(
        default_factory=list,
        description="List of telemedicine packets matching query criteria",
    )


class TelemedicineFlushRequest(BaseModel):
    """Request payload to trigger asynchronous burst transmission / queue flush."""

    astronaut_id: Optional[str] = Field(
        default=None,
        description="Optional filter to flush packets for a specific astronaut only",
    )
    packet_ids: Optional[List[int]] = Field(
        default=None,
        description="Optional list of specific packet IDs to flush",
    )
    force_flush: bool = Field(
        default=True,
        description="Force transmission even if comm window is nominally closed (burst transmit)",
    )
    ground_station: str = Field(
        default="NASA-JSC-MCC-Houston",
        description="Target MCC ground station or relay network",
    )


class TelemedicineFlushResponse(BaseModel):
    """Standardized response after executing telemedicine queue flush."""

    status: str = Field(description="nominal | caution | critical")
    high_level: str = Field(description="Crew-facing summary of flush outcome")
    technical: str = Field(description="Flight Surgeon burst transmission telemetry")
    flushed_count: int = Field(description="Number of packets transitioned from pending to transmitted")
    remaining_pending_count: int = Field(description="Number of packets still pending in queue")
    ground_station: str = Field(description="Target ground station that received the packets")
    transmitted_at: datetime = Field(description="UTC timestamp of the flush event")
    flushed_packets: List[TempusProPacketSchema] = Field(
        default_factory=list,
        description="List of packets that were flushed in this batch",
    )
