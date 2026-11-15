"""Test suite for Feature 3.1: Vectorized Space Medicine Knowledge Base (RAG)."""

import math
import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import select

from app.db.session import get_sessionmaker
from app.main import app
from app.rag.embedder import deterministic_fallback_embedding, generate_embedding
from app.rag.models import MedicalKnowledgeChunk
from app.rag.retriever import retrieve_knowledge, seed_knowledge_base


@pytest.mark.asyncio
async def test_rag_seeding_and_idempotency() -> None:
    """Verify that seed_knowledge_base populates all 8 clinical domains idempotently."""
    session_factory = get_sessionmaker()
    async with session_factory() as session:
        count = await seed_knowledge_base(session)
        assert count >= 8

        # Query all records
        stmt = select(MedicalKnowledgeChunk)
        chunks = (await session.execute(stmt)).scalars().all()
        assert len(chunks) >= 8

        categories = {chunk.category for chunk in chunks}
        expected_categories = {
            "SANS",
            "Radiation/CANS",
            "EVA/Hypoxia",
            "Countermeasures/Aging",
            "Cardiovascular",
            "Skin/Microbiome",
            "Behavioral/Sleep",
            "Telemedicine",
        }
        for exp in expected_categories:
            assert exp in categories, f"Category '{exp}' missing from seeded chunks"

        # Verify chunk attributes and vector embedding validity
        for chunk in chunks:
            assert chunk.chunk_key.startswith(("nasa-", "csa-"))
            assert len(chunk.title) > 0
            assert len(chunk.content_high_level) > 0
            assert len(chunk.content_technical) > 0
            assert len(chunk.source_reference) > 0

            vec = chunk.embedding
            assert isinstance(vec, list)
            assert len(vec) == 64
            norm = math.sqrt(sum(x * x for x in vec))
            assert abs(norm - 1.0) < 1e-4

        # Verify idempotency
        second_count = await seed_knowledge_base(session)
        assert second_count == count


@pytest.mark.asyncio
async def test_embedder_fallback_and_properties() -> None:
    """Verify deterministic fallback embedding properties: dimension, L2-norm, and discrimination."""
    query_sans = "SANS optic disc edema and hyperopic vision blur"
    vec_sans, provider_sans = await generate_embedding(query_sans)

    assert isinstance(vec_sans, list)
    assert len(vec_sans) == 64
    assert provider_sans in ["deterministic-trigram-fallback", "ollama:nomic-embed-text"]

    norm_sans = math.sqrt(sum(x * x for x in vec_sans))
    assert abs(norm_sans - 1.0) < 1e-4

    # Test distinct query discriminability
    query_eva = "SpO2 critical drop and suit pressure failure during spacewalk"
    vec_eva, _ = await generate_embedding(query_eva)

    # Cosine similarity between SANS and EVA queries
    dot_sim = sum(a * b for a, b in zip(vec_sans, vec_eva))
    assert dot_sim < 0.90, f"Expected distinct vectors, got cosine similarity {dot_sim}"


@pytest.mark.asyncio
async def test_cosine_retrieval_ranking() -> None:
    """Verify cosine retrieval ranking accuracy and domain filtering."""
    session_factory = get_sessionmaker()
    async with session_factory() as session:
        # SANS query should rank SANS chunk highest
        results, provider, total = await retrieve_knowledge(
            session=session,
            query="intracranial pressure and optic nerve disc swelling with blurred vision",
            top_k=3,
        )
        assert len(results) >= 1
        assert total >= 8
        top_match = results[0]
        assert top_match.category == "SANS"
        assert top_match.chunk_key == "nasa-hrp-sans-001"
        assert top_match.score > 0.0
        assert top_match.similarity_score == top_match.score

        # Verify scores are sorted descending
        for i in range(len(results) - 1):
            assert results[i].score >= results[i + 1].score

        # Test category-specific retrieval
        countermeasure_results, _, _ = await retrieve_knowledge(
            session=session,
            query="exercise workout bone loading and insulin resistance",
            top_k=2,
            category="Countermeasures/Aging",
        )
        assert len(countermeasure_results) >= 1
        for res in countermeasure_results:
            assert res.category == "Countermeasures/Aging"


@pytest.mark.asyncio
async def test_knowledge_rest_endpoint() -> None:
    """Verify GET /api/v1/ai/knowledge REST endpoint response structure."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/ai/knowledge?q=SANS&top_k=2")
        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "nominal"
        assert "SANS" in data["high_level"] or "protocols" in data["high_level"]
        assert len(data["technical"]) > 0
        assert data["total_chunks"] >= 8
        assert "embedding_provider" in data
        assert len(data["results"]) == 2

        doc0 = data["results"][0]
        assert "chunk_key" in doc0
        assert "title" in doc0
        assert "score" in doc0
        assert "similarity_score" in doc0
        assert doc0["score"] > 0.0
