"""SQLModel and Pydantic models for vectorized space medicine knowledge base."""

from datetime import datetime, timezone
import json
from typing import Any, Literal, Optional

from pydantic import BaseModel
from sqlmodel import Field, SQLModel


class MedicalKnowledgeChunk(SQLModel, table=True):
    """Persisted space medicine clinical protocol chunk with vector embeddings."""

    __tablename__ = "medical_knowledge_chunks"

    id: Optional[int] = Field(default=None, primary_key=True)
    chunk_key: str = Field(index=True, unique=True, nullable=False)
    title: str = Field(nullable=False)
    category: str = Field(index=True, nullable=False)
    content_high_level: str = Field(nullable=False)
    content_technical: str = Field(nullable=False)
    source_reference: str = Field(nullable=False)
    embedding_json: str = Field(default="[]", nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @property
    def embedding(self) -> list[float]:
        """Deserialize stored JSON vector to float list."""
        try:
            return json.loads(self.embedding_json)
        except (json.JSONDecodeError, TypeError):
            return []

    def set_embedding(self, vec: list[float]) -> None:
        """Serialize float list to JSON string."""
        self.embedding_json = json.dumps(vec)


class KnowledgeDocumentSchema(BaseModel):
    """Schema for retrieved knowledge chunk with similarity scoring."""

    id: Optional[int] = None
    chunk_key: str
    title: str
    category: str
    content_high_level: str
    content_technical: str
    source_reference: str
    score: float = Field(default=0.0, description="Normalized similarity score (0.0 - 1.0)")
    similarity_score: float = Field(default=0.0, description="Alias matching score for client flexibility")


class KnowledgeSearchResponse(BaseModel):
    """Standardized response for space medicine semantic knowledge queries."""

    status: Literal["nominal", "caution", "critical"] = Field(
        default="nominal",
        description="Search status",
    )
    high_level: str = Field(description="Crew-friendly summary of retrieved knowledge")
    technical: str = Field(description="Flight Surgeon technical reference summary")
    total_chunks: int = Field(description="Total chunks retrieved or matching in knowledge base")
    embedding_provider: str = Field(description="Active embedding generator used for query vector")
    results: list[KnowledgeDocumentSchema] = Field(
        default_factory=list,
        description="Ranked clinical protocol chunks",
    )
