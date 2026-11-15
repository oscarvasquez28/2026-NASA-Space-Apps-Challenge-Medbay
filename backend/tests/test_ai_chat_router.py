"""Test suite for Feature 3.2: Hybrid Cloud + Local LLM Clinical Router."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_ai_chat_offline_fallback_clinical_synthesis() -> None:
    """Verify that force_offline chat request uses offline RAG clinical synthesizer with 200 OK."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "astronaut_id": "AST-01",
            "message": "I'm having blurred vision and a headache in the station.",
            "view_mode": "high_level",
            "force_offline": True,
            "include_voice": False,
        }
        response = await client.post("/api/v1/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["provider_used"] == "offline-rag-clinical-synth"
        assert data["offline_mode"] is True
        assert data["view_mode"] == "high_level"
        assert data["reply"] == data["high_level"]
        assert "Thigh Cuffs" in data["reply"] or "B-complex" in data["reply"]
        assert len(data["retrieved_knowledge"]) >= 1
        assert len(data["recommended_actions"]) >= 1
        assert data["status"] in ["nominal", "caution", "critical"]
        assert len(data["technical"]) > 0
        assert data["voice_payload"] is None


@pytest.mark.asyncio
async def test_ai_chat_technical_view_mode_critical_eva() -> None:
    """Verify flight surgeon technical view mode and critical triage elevation on hypoxia."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "astronaut_id": "AST-01",
            "message": "SpO2 is 86% and EVA suit pressure is 24 kPa.",
            "view_mode": "technical",
            "force_offline": True,
        }
        response = await client.post("/api/v1/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["view_mode"] == "technical"
        assert data["reply"] == data["technical"]
        assert data["status"] == "critical"
        assert data["triage_tier"] == "TIER_3_GROUND_SURGEON"
        assert "abort" in data["reply"].lower() or "repressuriz" in data["reply"].lower()
        assert len(data["recommended_actions"]) >= 1


@pytest.mark.asyncio
async def test_ai_chat_multimodal_diagnostic_image() -> None:
    """Verify handling of base64 diagnostic image without server errors."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "astronaut_id": "AST-01",
            "message": "Painful rash on lower back with tingling blisters",
            "diagnostic_image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "force_offline": True,
            "view_mode": "high_level",
        }
        response = await client.post("/api/v1/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["offline_mode"] is True
        reply_lower = data["reply"].lower()
        assert (
            "valacyclovir" in reply_lower
            or "ceramide" in reply_lower
            or "barrier" in reply_lower
            or "shingles" in reply_lower
            or "rash" in reply_lower
        )
        assert len(data["recommended_actions"]) > 0


@pytest.mark.asyncio
async def test_ai_chat_include_voice_payload() -> None:
    """Verify voice payload inclusion in chat response when include_voice is True."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "astronaut_id": "AST-01",
            "message": "Status check for crew module",
            "include_voice": True,
            "force_offline": True,
        }
        response = await client.post("/api/v1/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["voice_payload"] is not None
        voice = data["voice_payload"]
        assert len(voice["audio_base64"]) > 0
        assert voice["mime_type"] == "audio/wav"
        assert len(voice["viseme_cues"]) > 0
        assert voice["duration_ms"] > 0
        assert voice["provider_used"] == "local-riff-wav-synth"


@pytest.mark.asyncio
async def test_ai_chat_mars_latency_auto_edge_routing() -> None:
    """Verify that deep space latency automatically forces edge/offline synthesis without cloud calls."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Update context to Mars with 720s latency
        context_update = {
            "location_setting": "Mars [3/8g]",
        }
        ctx_resp = await client.post("/api/v1/context/location", json=context_update)
        assert ctx_resp.status_code == 200

        # Query chat without forcing offline
        payload = {
            "astronaut_id": "AST-01",
            "message": "Routine morning checkup on Mars base",
            "force_offline": False,
        }
        chat_resp = await client.post("/api/v1/ai/chat", json=payload)
        assert chat_resp.status_code == 200
        chat_data = chat_resp.json()

        assert chat_data["offline_mode"] is True
        assert chat_data["earth_comm_latency_sec"] == 720.0
        assert chat_data["failover_reason"] is not None

        # Reset location context
        reset_ctx = {
            "location_setting": "Space Station [0g]",
        }
        await client.post("/api/v1/context/location", json=reset_ctx)
