"""Application settings loaded from environment variables."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for local Docker Compose and GCP Cloud Run."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    project_name: str = "Astronaut Health Monitoring & Autonomous Triage API"
    version: str = "0.1.0"
    environment: str = Field(default="local", alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    port: int = Field(default=8080, alias="PORT")
    cors_origins_raw: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
    )

    triage_mode: Literal["deterministic", "hybrid", "ai_advisory"] = Field(
        default="deterministic",
        alias="TRIAGE_MODE",
    )
    gcp_project_id: str = Field(default="", alias="GCP_PROJECT_ID")
    gcp_region: str = Field(default="us-central1", alias="GCP_REGION")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    vertex_ai_model: str = Field(default="gemini-2.5-flash", alias="VERTEX_AI_MODEL")

    # Database (PostgreSQL / SQLite fallback)
    database_url: str = Field(
        default="postgresql+asyncpg://astronaut:spaceapps2026@db:5432/astronaut_triage",
        alias="DATABASE_URL",
    )

    # Local Offline LLM & Embeddings (Ollama)
    ollama_base_url: str = Field(default="http://ollama:11434", alias="OLLAMA_BASE_URL")
    ollama_llm_model: str = Field(default="medgemma", alias="OLLAMA_LLM_MODEL")
    ollama_embed_model: str = Field(default="nomic-embed-text", alias="OLLAMA_EMBED_MODEL")

    # Voice Synthesis (ElevenLabs Primary + Local Fallback)
    elevenlabs_api_key: str = Field(default="", alias="ELEVENLABS_API_KEY")
    elevenlabs_voice_id: str = Field(default="", alias="ELEVENLABS_VOICE_ID")

    # Multi-Modal Uploads & GCS Storage
    upload_dir: str = Field(default="/tmp/uploads", alias="UPLOAD_DIR")
    gcs_bucket_name: str = Field(default="", alias="GCS_BUCKET_NAME")

    # Local Facial Recognition (OpenCV YuNet + SFace)
    face_model_dir: str = Field(default="/app/models/face", alias="FACE_MODEL_DIR")
    face_match_threshold: float = Field(default=0.363, alias="FACE_MATCH_THRESHOLD")

    # Weekly check-in bonus: one wheel spin per N consecutive check-in days.
    # Spec cadence is 7; set to 1 in dev/test environments to try the wheel
    # on the first check-in of the day.
    wheel_cadence_days: int = Field(default=7, ge=1, alias="WHEEL_CADENCE_DAYS")


    @property
    def cors_origins(self) -> list[str]:
        """Parse comma-separated CORS origins into a clean list."""
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
