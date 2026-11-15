"""Tests for the operational context and 5-hazards REST endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_default_location_context(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/context/location returns nominal default profile."""
    response = await async_client.get("/api/v1/context/location")
    assert response.status_code == 200
    data = response.json()

    assert "location_setting" in data
    assert "gravity_g" in data
    assert data["status"] in ["nominal", "caution", "critical"]
    assert len(data["high_level"]) > 10
    assert len(data["technical"]) > 10
    assert "hazard_multipliers" in data
    hazards = data["hazard_multipliers"]
    assert "space_radiation" in hazards
    assert "isolation_and_confinement" in hazards
    assert "distance_from_earth" in hazards
    assert "gravity_fields" in hazards
    assert "hostile_closed_environments" in hazards
    assert "composite_multiplier" in hazards
    assert hazards["composite_multiplier"] > 0.0


@pytest.mark.asyncio
async def test_update_location_context_spacecraft(async_client: AsyncClient) -> None:
    """Verify switching to Spacecraft [0g Transit] updates latency and sets offline active."""
    response = await async_client.post(
        "/api/v1/context/location",
        json={"location_setting": "Spacecraft [0g Transit]"},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["location_setting"] == "Spacecraft [0g Transit]"
    assert data["earth_comm_latency_sec"] == 45.0
    assert data["offline_fallback_active"] is True
    assert data["hazard_multipliers"]["space_radiation"] == 2.5


@pytest.mark.asyncio
async def test_update_location_context_mars(async_client: AsyncClient) -> None:
    """Verify updating to Mars [3/8g] correctly reflects surface profile."""
    response = await async_client.post(
        "/api/v1/context/location",
        json={"location_setting": "Mars [3/8g]"},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["location_setting"] == "Mars [3/8g]"
    assert data["gravity_g"] == 0.376
    assert data["earth_comm_latency_sec"] == 720.0
    assert data["offline_fallback_active"] is True
    assert data["status"] in ["caution", "critical"]
    assert "Mars [3/8g]" in data["high_level"]
    assert "Mars [3/8g]" in data["technical"]
    assert data["hazard_multipliers"]["isolation_and_confinement"] == 2.8


@pytest.mark.asyncio
async def test_context_hazard_multiplier_elevation(async_client: AsyncClient) -> None:
    """Verify high CO2 dynamically elevates the hostile closed environment multiplier."""
    response = await async_client.post(
        "/api/v1/context/location",
        json={
            "location_setting": "Space Station [0g]",
            "co2_mmhg": 5.2,
            "pressure_kpa": 88.0,
        },
    )
    assert response.status_code == 200
    data = response.json()

    hazards = data["hazard_multipliers"]
    # Base hostile_closed is 1.2; with co2 > 4.0 and pressure < 90, it must be significantly higher
    assert hazards["hostile_closed_environments"] > 1.5


@pytest.mark.asyncio
async def test_invalid_location_setting(async_client: AsyncClient) -> None:
    """Verify invalid location setting returns 422 Unprocessable Entity."""
    response = await async_client.post(
        "/api/v1/context/location",
        json={"location_setting": "NonExistentSector"},
    )
    assert response.status_code == 422
