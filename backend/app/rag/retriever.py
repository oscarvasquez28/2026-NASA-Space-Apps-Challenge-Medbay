"""Space medicine knowledge base seeder and vector cosine similarity retriever."""

import json
import logging
import math
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.rag.embedder import (
    deterministic_fallback_embedding,
    generate_embedding,
)
from app.rag.models import (
    KnowledgeDocumentSchema,
    MedicalKnowledgeChunk,
)
from app.rag.seed_data import SPACE_MEDICINE_SEED_CHUNKS

logger = logging.getLogger(__name__)


async def seed_knowledge_base(session: AsyncSession) -> int:
    """Seed the database with curated NASA HRP and CSA clinical protocols if empty.

    Returns:
        int: Total number of seeded chunks in database.
    """
    statement = select(MedicalKnowledgeChunk).limit(1)
    result = await session.execute(statement)
    existing_chunk = result.scalar_one_or_none()

    if existing_chunk is not None:
        count_stmt = select(MedicalKnowledgeChunk)
        all_chunks = (await session.execute(count_stmt)).scalars().all()
        return len(all_chunks)

    seeded_records = []
    for chunk_dict in SPACE_MEDICINE_SEED_CHUNKS:
        combined_text = (
            f"{chunk_dict['title']}\n"
            f"{chunk_dict['category']}\n"
            f"{chunk_dict['content_high_level']}\n"
            f"{chunk_dict['content_technical']}"
        )
        vec, provider = await generate_embedding(combined_text)

        record = MedicalKnowledgeChunk(
            chunk_key=chunk_dict["chunk_key"],
            title=chunk_dict["title"],
            category=chunk_dict["category"],
            content_high_level=chunk_dict["content_high_level"],
            content_technical=chunk_dict["content_technical"],
            source_reference=chunk_dict["source_reference"],
            embedding_json=json.dumps(vec),
        )
        session.add(record)
        seeded_records.append(record)

    await session.commit()
    logger.info(
        "Seeded %d space medicine knowledge chunks using provider %s.",
        len(seeded_records),
        provider,
    )
    return len(seeded_records)


def _compute_cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if not vec_a or not vec_b:
        return 0.0
    if len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    # Clip between 0.0 and 1.0 (since vectors are L2-normalized)
    return max(0.0, min(1.0, float(dot)))


async def retrieve_knowledge(
    session: AsyncSession,
    query: str,
    top_k: int = 3,
    category: Optional[str] = None,
) -> tuple[list[KnowledgeDocumentSchema], str, int]:
    """Retrieve top-k relevant NASA HRP / CSA protocol chunks using vector similarity.

    Args:
        session: Active asynchronous SQLModel database session.
        query: Clinical query, symptom string, or search term.
        top_k: Maximum number of chunks to return.
        category: Optional category filter (e.g. 'SANS', 'EVA/Hypoxia').

    Returns:
        tuple: (list of KnowledgeDocumentSchema, embedding_provider, total_chunks_searched)
    """
    # 1. Generate query embedding
    query_vec, provider = await generate_embedding(query)

    # 2. Query knowledge chunks from database
    statement = select(MedicalKnowledgeChunk)
    if category:
        statement = statement.where(MedicalKnowledgeChunk.category == category)

    result = await session.execute(statement)
    chunks = result.scalars().all()

    if not chunks:
        # If DB was never seeded, seed it dynamically
        await seed_knowledge_base(session)
        result = await session.execute(statement)
        chunks = result.scalars().all()

    total_chunks = len(chunks)
    scored_chunks: list[tuple[float, MedicalKnowledgeChunk]] = []

    for chunk in chunks:
        chunk_vec = chunk.embedding
        if len(chunk_vec) != len(query_vec):
            # Fallback embedding if dimensions differ (e.g. 768 vs 64)
            combined_text = f"{chunk.title} {chunk.content_high_level}"
            chunk_vec = deterministic_fallback_embedding(combined_text)

        sim_score = _compute_cosine_similarity(chunk_vec, query_vec)
        scored_chunks.append((sim_score, chunk))

    # Sort descending by similarity score
    scored_chunks.sort(key=lambda item: item[0], reverse=True)

    results: list[KnowledgeDocumentSchema] = []
    for score, chunk in scored_chunks[:top_k]:
        results.append(
            KnowledgeDocumentSchema(
                id=chunk.id,
                chunk_key=chunk.chunk_key,
                title=chunk.title,
                category=chunk.category,
                content_high_level=chunk.content_high_level,
                content_technical=chunk.content_technical,
                source_reference=chunk.source_reference,
                score=round(score, 4),
                similarity_score=round(score, 4),
            )
        )

    return (results, provider, total_chunks)
