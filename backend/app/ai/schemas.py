"""Data schemas for AI clinical chat routing and knowledge responses."""

from typing import Literal, Optional
from pydantic import BaseModel, Field

from app.rag.models import KnowledgeDocumentSchema
from app.voice.models import TTSResponse


class AIChatRequest(BaseModel):
    """Crew or Flight Surgeon clinical chat message."""

    astronaut_id: str = Field(default="AST-01", description="Target astronaut identifier")
    message: str = Field(..., min_length=1, description="Clinical query, symptoms, or status inquiry")
    view_mode: Literal["high_level", "technical"] = Field(
        default="high_level",
        description="Target perspective: 'high_level' for crew plain-language self-care, 'technical' for CMO/Surgeon",
    )
    include_voice: bool = Field(
        default=False,
        description="Synthesize voice TTS audio payload in response",
    )
    force_offline: bool = Field(
        default=False,
        description="Force local/offline clinical synthesis, bypassing cloud APIs",
    )
    diagnostic_image_base64: Optional[str] = Field(
        default=None,
        description="Optional base64-encoded clinical photograph or ultrasound scan",
    )


class AIChatResponse(BaseModel):
    """Unified clinical advisory response from hybrid router."""

    status: Literal["nominal", "caution", "critical"] = Field(
        default="nominal",
        description="Clinical severity assessment",
    )
    high_level: str = Field(description="Clear, actionable crew self-care instructions")
    technical: str = Field(description="Clinical assessment, physiological rationale, and telemetry references")
    astronaut_id: str = Field(description="Astronaut identifier")
    reply: str = Field(description="Selected response text formatted according to requested view_mode")
    view_mode: Literal["high_level", "technical"]
    provider_used: Literal[
        "google-genai:gemini",
        "ollama:medgemma",
        "offline-rag-clinical-synth",
    ] = Field(description="LLM provider or synthesis engine that generated this response")
    failover_reason: Optional[str] = Field(
        default=None,
        description="Details on why fallback occurred (latency, missing keys, offline mode, network failure)",
    )
    offline_mode: bool = Field(description="True if generated via local or offline systems")
    earth_comm_latency_sec: float = Field(description="Active Earth communication round-trip latency")
    triage_tier: str = Field(
        description="TIER_1_SELF_CARE | TIER_2_CMO_REVIEW | TIER_3_GROUND_SURGEON",
    )
    retrieved_knowledge: list[KnowledgeDocumentSchema] = Field(
        default_factory=list,
        description="Authoritative NASA HRP / CSA protocols retrieved via RAG",
    )
    recommended_actions: list[str] = Field(
        default_factory=list,
        description="Step-by-step clinical countermeasures or operational actions",
    )
    voice_payload: Optional[TTSResponse] = Field(
        default=None,
        description="Synthesized voice audio payload if requested",
    )
