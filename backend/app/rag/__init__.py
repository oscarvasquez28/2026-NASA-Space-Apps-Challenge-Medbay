"""Vectorized Space Medicine Knowledge Base Package."""

from app.rag.embedder import (
    deterministic_fallback_embedding,
    generate_embedding,
)
from app.rag.models import (
    KnowledgeDocumentSchema,
    KnowledgeSearchResponse,
    MedicalKnowledgeChunk,
)
from app.rag.retriever import retrieve_knowledge, seed_knowledge_base

__all__ = [
    "MedicalKnowledgeChunk",
    "KnowledgeDocumentSchema",
    "KnowledgeSearchResponse",
    "generate_embedding",
    "deterministic_fallback_embedding",
    "retrieve_knowledge",
    "seed_knowledge_base",
]
