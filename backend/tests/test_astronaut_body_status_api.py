"""Tests for the astronaut 6-zone anatomical body status endpoint."""

import pytest
from httpx import AsyncClient

EXPECTED_ZONES = [
    "head_eyes",
    "cardiovascular_chest",
    "spine_skeletal",
    "musculoskeletal_limbs",
    "gut_microbiome",
    "skin",
]


@pytest.mark.asyncio
async def test_get_body_status_nominal(async_client: AsyncClient) -> None:
    """Verify nominal astronaut body status provides all 6 zones with UI tokens."""
    response = await async_client.get("/api/v1/astronaut/body-status?astronaut_id=AST-NOMINAL")
    assert response.status_code == 200
    data = response.json()

    assert data["astronaut_id"] == "AST-NOMINAL"
    assert data["status"] == "nominal"
    assert data["overall_status"] == "nominal"
    assert data["overall_ui_token"] == "status-nominal"
    assert len(data["high_level"]) > 10
    assert len(data["technical"]) > 10
    assert "zones" in data

    for zone_key in EXPECTED_ZONES:
        assert zone_key in data["zones"], f"Zone {zone_key} missing from response"
        zone = data["zones"][zone_key]
        assert zone["status"] in ["nominal", "caution", "critical"]
        assert zone["ui_token"] in ["status-nominal", "status-caution", "status-critical"]


@pytest.mark.asyncio
async def test_get_body_status_after_critical_telemetry(async_client: AsyncClient) -> None:
    """Verify ingesting critical telemetry causes cardiovascular zone to reflect critical state."""
    critical_telemetry = {
        "astronaut_id": "AST-CRIT",
        "heart_rate_bpm": 145.0,
        "spo2_percent": 82.0,
        "core_temp_c": 37.0,
        "target_anatomical_zone": "cardiovascular_chest",
        "symptoms": ["acute chest pressure", "dyspnea"],
    }
    ingest_res = await async_client.post("/api/v1/telemetry/ingest", json=critical_telemetry)
    assert ingest_res.status_code == 200

    status_res = await async_client.get("/api/v1/astronaut/body-status?astronaut_id=AST-CRIT")
    assert status_res.status_code == 200
    status_data = status_res.json()

    cv_zone = status_data["zones"]["cardiovascular_chest"]
    assert cv_zone["status"] == "critical"
    assert cv_zone["ui_token"] == "status-critical"
    assert status_data["overall_status"] == "critical"
    assert status_data["overall_ui_token"] == "status-critical"


@pytest.mark.asyncio
async def test_body_status_dual_view_completeness(async_client: AsyncClient) -> None:
    """Verify every zone contains astronaut high-level summary and surgeon technical telemetry."""
    response = await async_client.get("/api/v1/astronaut/body-status?astronaut_id=AST-01")
    assert response.status_code == 200
    data = response.json()

    for zone_key, zone in data["zones"].items():
        assert len(zone["high_level"].strip()) > 10, f"{zone_key} high_level is too short"
        assert len(zone["technical"].strip()) > 10, f"{zone_key} technical is too short"
        assert len(zone["self_exam_steps"]) >= 1, f"{zone_key} has no self-exam steps"
        assert len(zone["recommended_countermeasures"]) >= 1, f"{zone_key} has no countermeasures"
