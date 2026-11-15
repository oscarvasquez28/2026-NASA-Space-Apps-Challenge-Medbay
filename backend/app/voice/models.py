"""Data models and schemas for the hybrid voice synthesis gateway."""

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


class VisemeCue(BaseModel):
    """Phoneme / viseme timing marker for 3D avatar facial animation and lip-sync."""

    start_ms: int = Field(..., description="Viseme onset in milliseconds from audio start")
    end_ms: int = Field(..., description="Viseme conclusion in milliseconds")
    viseme: str = Field(..., description="Standardized mouth shape identifier (A, E, I, O, U, M, rest)")


class TTSRequest(BaseModel):
    """Speech synthesis request payload."""

    text: str = Field(..., min_length=1, description="Clinical or advisory text to synthesize")
    astronaut_id: Optional[str] = Field(default="AST-01", description="Target astronaut identifier")
    voice_id: Optional[str] = Field(default=None, description="Optional custom ElevenLabs voice ID")
    severity: Literal["nominal", "caution", "critical"] = Field(
        default="nominal",
        description="Alert severity modulating acoustic tone, warble, and pitch",
    )
    force_offline: bool = Field(
        default=False,
        description="Force local offline RIFF/WAV PCM audio generator",
    )
    view_mode: Literal["high_level", "technical"] = Field(
        default="high_level",
        description="View perspective formatting",
    )


class TTSResponse(BaseModel):
    """Standardized response from voice synthesis gateway with audio and viseme cues."""

    status: Literal["nominal", "caution", "critical"] = Field(
        default="nominal",
        description="Acoustic severity status",
    )
    high_level: str = Field(description="Operational voice synthesis summary")
    technical: str = Field(description="Technical acoustic parameters and buffer metrics")
    provider_used: Literal["elevenlabs", "local-riff-wav-synth"] = Field(
        description="Synthesis provider utilized",
    )
    offline_mode: bool = Field(description="True if synthesized offline locally")
    mime_type: Literal["audio/wav", "audio/mpeg"] = Field(
        default="audio/wav",
        description="MIME container type of base64 audio payload",
    )
    audio_base64: str = Field(description="Base64-encoded audio byte stream")
    duration_ms: int = Field(description="Calculated audio playback duration in milliseconds")
    viseme_cues: list[VisemeCue] = Field(
        default_factory=list,
        description="Time-aligned mouth viseme cues for lip synchronization",
    )
    browser_speech_hint: dict[str, Any] = Field(
        description="Fallback parameters for window.speechSynthesis",
    )
