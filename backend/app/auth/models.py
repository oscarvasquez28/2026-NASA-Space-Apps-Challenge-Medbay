"""SQLModel database tables and Pydantic schemas for operator sessions and facial recognition."""

from datetime import datetime, timezone
import json
from typing import List, Literal, Optional

from pydantic import BaseModel, Field
from sqlmodel import Field as SQLField, SQLModel


# ---------------------------------------------------------------------------
# Database Tables
# ---------------------------------------------------------------------------


class OperatorUserRecord(SQLModel, table=True):
    """Persisted console operator account."""

    __tablename__ = "operator_users"

    id: str = SQLField(primary_key=True, nullable=False)
    name: str = SQLField(nullable=False)
    callsign: Optional[str] = SQLField(default=None)
    role: str = SQLField(default="user", nullable=False)
    astronaut_id: str = SQLField(index=True, nullable=False)
    face_photo: str = SQLField(nullable=False)
    wheel_spins_claimed: int = SQLField(default=0, nullable=False)
    created_at: datetime = SQLField(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class FaceCredentialRecord(SQLModel, table=True):
    """Saved facial embedding mapped to an operator user_id."""

    __tablename__ = "face_credentials"

    id: Optional[int] = SQLField(default=None, primary_key=True)
    user_id: str = SQLField(index=True, nullable=False)
    label: str = SQLField(default="primary", nullable=False)
    embedding_json: str = SQLField(default="[]", nullable=False)
    model_name: str = SQLField(default="sface_2021dec", nullable=False)
    is_active: bool = SQLField(default=True, nullable=False)
    created_at: datetime = SQLField(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_matched_at: Optional[datetime] = SQLField(default=None)

    @property
    def embedding(self) -> List[float]:
        """Deserialize stored JSON face embedding vector."""
        try:
            return [float(x) for x in json.loads(self.embedding_json)]
        except (json.JSONDecodeError, TypeError, ValueError):
            return []

    def set_embedding(self, vec: List[float]) -> None:
        """Serialize float embedding vector to JSON string."""
        self.embedding_json = json.dumps([round(float(x), 6) for x in vec])


class OperatorCheckInRecord(SQLModel, table=True):
    """Idempotent daily check-in log per operator."""

    __tablename__ = "operator_checkins"

    id: Optional[int] = SQLField(default=None, primary_key=True)
    user_id: str = SQLField(index=True, nullable=False)
    day: str = SQLField(index=True, nullable=False)
    at: datetime = SQLField(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class OperatorUserSchema(BaseModel):
    """Serialized operator matching frontend LocalUser shape plus spin tracking."""

    id: str
    name: str
    callsign: Optional[str] = None
    role: Literal["medic", "user"]
    facePhoto: str
    astronautId: str
    wheelSpinsClaimed: int = 0
    createdAt: str


class CheckInRecordSchema(BaseModel):
    """Serialized check-in matching frontend CheckInRecord shape."""

    userId: str
    day: str
    at: str


class FaceCredentialSummary(BaseModel):
    """Safe metadata view of a stored face credential (never leaks raw vector)."""

    id: int
    user_id: str
    label: str
    model_name: str
    embedding_dim: int
    is_active: bool
    created_at: datetime
    last_matched_at: Optional[datetime] = None


class AuthSessionStateResponse(BaseModel):
    """Complete operator session state hydrated by the frontend on boot."""

    status: Literal["nominal", "caution", "critical"] = "nominal"
    users: List[OperatorUserSchema]
    check_ins: List[CheckInRecordSchema]
    face_credentials_count: int


class RegisterOperatorRequest(BaseModel):
    """Payload to enroll a new operator and save their face embedding."""

    id: Optional[str] = None
    name: str = Field(min_length=1, max_length=120)
    callsign: Optional[str] = Field(default=None, max_length=64)
    role: Optional[Literal["medic", "user"]] = "user"
    astronaut_id: Optional[str] = Field(default=None, max_length=64)
    face_photo: str = Field(min_length=10, description="Base64 data URL or raw base64 image")
    label: str = Field(default="primary", max_length=64)


class RegisterOperatorResponse(BaseModel):
    """Response returned after enrolling a new operator and face credential."""

    status: Literal["nominal", "caution", "critical"] = "nominal"
    user: OperatorUserSchema
    face_credential_id: int
    embedding_dim: int
    model_name: str


class EnrollAdditionalFaceRequest(BaseModel):
    """Payload to attach an extra face sample/angle to an existing operator."""

    face_photo: str = Field(min_length=10)
    label: str = Field(default="alternate", max_length=64)


class FaceIdentifyRequest(BaseModel):
    """Frame captured by on-device camera for facial recognition login."""

    face_photo: str = Field(min_length=10, description="Base64 data URL or raw base64 frame")


class FaceIdentifyResponse(BaseModel):
    """Result of identifying a camera frame against saved face_credentials."""

    status: Literal["matched", "unknown_face", "no_face"]
    matched_user: Optional[OperatorUserSchema] = None
    confidence: float = 0.0
    threshold: float = 0.363
    model_name: str
    message: str


class OperatorCheckInRequest(BaseModel):
    """Request to record a daily check-in for an operator."""

    user_id: str
    day: Optional[str] = Field(default=None, description="Optional YYYY-MM-DD override")


class OperatorCheckInResponse(BaseModel):
    """Response summarizing check-in idempotency, streak, and prize-drum spin eligibility."""

    status: Literal["nominal", "caution", "critical"] = "nominal"
    is_new_day: bool
    earned_spin: bool
    streak: int
    total_checkins: int
    pending_spins: int
    check_in: CheckInRecordSchema


class ClaimWheelSpinRequest(BaseModel):
    """Request to consume an earned Prize Drum spin and persist the unlocked skin."""

    user_id: str
    unlocked_skin_id: Optional[str] = None
    equip: bool = False


class ClaimWheelSpinResponse(BaseModel):
    """Response after claiming a Prize Drum spin and persisting unlocked skins."""

    status: Literal["nominal", "caution", "critical"] = "nominal"
    user_id: str
    wheel_spins_claimed: int
    pending_spins: int
    unlocked_skin_id: Optional[str] = None
    unlocked_skins: List[str] = Field(default_factory=list)
