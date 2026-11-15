"""Integration tests for GET /api/v1/trends/{indicator} time-series forecasting API."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_trends_nominal_heart_rate(async_client: AsyncClient) -> None:
    """Verify nominal cold start trend analysis for heart rate with confidence intervals."""
    response = await async_client.get("/api/v1/trends/heart_rate_bpm?astronaut_id=AST-01&history_limit=20&forecast_steps=10")
    assert response.status_code == 200
    data = response.json()

    assert data["indicator"] == "heart_rate_bpm"
    assert data["astronaut_id"] == "AST-01"
    assert data["unit"] == "bpm"
    assert data["status"] == "nominal"
    assert data["threshold_warning"] is False
    assert len(data["historical_points"]) >= 5
    assert len(data["forecast_points"]) == 10
    assert len(data["event_markers"]) == 3
    assert len(data["high_level"]) > 10
    assert len(data["technical"]) > 10

    # Verify confidence intervals are statistically consistent: lower_ci <= predicted_value <= upper_ci
    for pt in data["forecast_points"]:
        assert pt["lower_ci"] <= pt["predicted_value"], f"lower_ci {pt['lower_ci']} > predicted {pt['predicted_value']}"
        assert pt["predicted_value"] <= pt["upper_ci"], f"predicted {pt['predicted_value']} > upper_ci {pt['upper_ci']}"


@pytest.mark.asyncio
async def test_get_trends_critical_threshold_crossing(async_client: AsyncClient) -> None:
    """Verify ingesting severe hypoxemia causes SpO2 trend to report critical threshold crossing warning."""
    # Ingest critical hypoxemia telemetry
    critical_telemetry = {
        "astronaut_id": "AST-HYPOXIA",
        "heart_rate_bpm": 135.0,
        "spo2_percent": 86.0,
        "core_temp_c": 37.0,
        "symptoms": ["severe dyspnea"],
    }
    ingest_res = await async_client.post("/api/v1/telemetry/ingest", json=critical_telemetry)
    assert ingest_res.status_code == 200

    trends_res = await async_client.get("/api/v1/trends/spo2_percent?astronaut_id=AST-HYPOXIA&history_limit=20&forecast_steps=5")
    assert trends_res.status_code == 200
    data = trends_res.json()

    assert data["indicator"] == "spo2_percent"
    assert data["status"] == "critical"
    assert data["threshold_warning"] is True
    assert data["warning_details"] is not None
    assert "critical" in data["warning_details"].lower() or "hypoxemia" in data["warning_details"].lower()


@pytest.mark.asyncio
async def test_get_trends_invalid_indicator_400(async_client: AsyncClient) -> None:
    """Verify invalid indicator name returns 400 Bad Request with supported options."""
    response = await async_client.get("/api/v1/trends/invalid_vital_indicator")
    assert response.status_code == 400
    data = response.json()
    assert "Unsupported trend indicator" in data["detail"]
    assert "heart_rate_bpm" in data["detail"]


@pytest.mark.asyncio
async def test_get_trends_various_indicators(async_client: AsyncClient) -> None:
    """Verify forecasting functions across various physiological indicators."""
    indicators = [
        ("blood_sugar_mg_dl", "mg/dL"),
        ("bone_mineral_density_t_score", "T-score"),
        ("visual_acuity_logmar", "LogMAR"),
        ("mission_readiness_score", "%"),
    ]
    for ind, expected_unit in indicators:
        res = await async_client.get(f"/api/v1/trends/{ind}?astronaut_id=AST-MULTI&forecast_steps=5")
        assert res.status_code == 200, f"Failed for {ind}: {res.text}"
        payload = res.json()
        assert payload["indicator"] == ind
        assert payload["unit"] == expected_unit
        assert len(payload["forecast_points"]) == 5
