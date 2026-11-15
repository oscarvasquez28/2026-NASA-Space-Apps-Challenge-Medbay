"""Tests for multi-modal telemetry and vitals ingestion endpoint."""

import io

import pytest
from httpx import AsyncClient
from PIL import Image


def _create_test_image_bytes(format: str = "PNG") -> bytes:
    """Generate in-memory test image bytes using Pillow."""
    img = Image.new("RGB", (64, 64), color=(30, 144, 255))
    buffer = io.BytesIO()
    img.save(buffer, format=format)
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_telemetry_ingest_nominal_json(async_client: AsyncClient) -> None:
    """Verify nominal JSON telemetry payload is classified as Tier 1 Self-Care."""
    payload = {
        "astronaut_id": "AST-01",
        "heart_rate_bpm": 72.0,
        "systolic_bp_mmhg": 118.0,
        "diastolic_bp_mmhg": 78.0,
        "blood_sugar_mg_dl": 92.0,
        "core_temp_c": 37.0,
        "spo2_percent": 98.8,
        "sleep_hours": 7.5,
        "mood_score": 8.5,
        "stress_level": 1.5,
        "symptoms": [],
    }
    response = await async_client.post("/api/v1/telemetry/ingest", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "nominal"
    assert data["triage_tier"] == "TIER_1_SELF_CARE"
    assert data["mission_readiness_score"] >= 90.0
    assert len(data["anomaly_flags"]) == 0
    assert len(data["recommended_actions"]) >= 1
    assert len(data["high_level"]) > 10
    assert len(data["technical"]) > 10
    assert data["id"] > 0


@pytest.mark.asyncio
async def test_telemetry_ingest_critical_hypoxia_json(async_client: AsyncClient) -> None:
    """Verify severe hypoxemia triggers Critical Tier 3 Ground Surgeon escalation."""
    payload = {
        "astronaut_id": "AST-02",
        "heart_rate_bpm": 142.0,
        "systolic_bp_mmhg": 150.0,
        "diastolic_bp_mmhg": 95.0,
        "blood_sugar_mg_dl": 105.0,
        "core_temp_c": 37.5,
        "spo2_percent": 84.0,
        "suit_pressure_kpa": 22.0,
        "symptoms": ["dyspnea", "dizziness"],
        "target_anatomical_zone": "cardiovascular_chest",
    }
    response = await async_client.post("/api/v1/telemetry/ingest", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "critical"
    assert data["triage_tier"] == "TIER_3_GROUND_SURGEON"
    assert len(data["anomaly_flags"]) >= 2
    assert len(data["recommended_actions"]) >= 1
    assert "CRITICAL" in data["high_level"]
    assert "TIER_3_GROUND_SURGEON" in data["technical"]
    assert data["target_anatomical_zone"] == "cardiovascular_chest"
    assert data["mission_readiness_score"] <= 60.0


@pytest.mark.asyncio
async def test_telemetry_ingest_multipart_image(async_client: AsyncClient) -> None:
    """Verify diagnostic image upload via multipart/form-data succeeds with metadata."""
    img_bytes = _create_test_image_bytes("PNG")
    files = {
        "diagnostic_image": ("test_rash.png", img_bytes, "image/png"),
    }
    data = {
        "astronaut_id": "AST-03",
        "heart_rate_bpm": "80.0",
        "spo2_percent": "97.5",
        "core_temp_c": "37.1",
        "target_anatomical_zone": "skin",
        "symptoms": '["pruritic rash", "erythema"]',
    }
    response = await async_client.post(
        "/api/v1/telemetry/ingest",
        data=data,
        files=files,
    )
    assert response.status_code == 200
    result = response.json()

    assert result["image_stored"] is True
    assert result["image_path"] is not None
    assert result["image_metadata"] is not None
    meta = result["image_metadata"]
    assert meta["width"] == 64
    assert meta["height"] == 64
    assert meta["format"] == "PNG"
    assert result["target_anatomical_zone"] == "skin"


@pytest.mark.asyncio
async def test_telemetry_ingest_corrupted_image(async_client: AsyncClient) -> None:
    """Verify corrupted non-image file returns 400 Bad Request."""
    corrupt_bytes = b"NOT_A_VALID_IMAGE_DATA_STREAM"
    files = {
        "diagnostic_image": ("corrupted.png", corrupt_bytes, "image/png"),
    }
    data = {
        "astronaut_id": "AST-04",
        "heart_rate_bpm": "75.0",
        "spo2_percent": "98.0",
    }
    response = await async_client.post(
        "/api/v1/telemetry/ingest",
        data=data,
        files=files,
    )
    assert response.status_code == 400
    assert "Invalid or corrupted image format" in response.json()["detail"]


@pytest.mark.asyncio
async def test_telemetry_ingest_invalid_vitals(async_client: AsyncClient) -> None:
    """Verify physically impossible heart rate returns 422 Unprocessable Entity."""
    payload = {
        "astronaut_id": "AST-05",
        "heart_rate_bpm": -15.0,
        "spo2_percent": 98.0,
    }
    response = await async_client.post("/api/v1/telemetry/ingest", json=payload)
    assert response.status_code == 422
