"""Integration tests for PUT/PATCH /api/v1/tests/dbsnapshot seeder restoration."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_put_dbsnapshot_restores_clean_seeder_state(async_client: AsyncClient) -> None:
    """Verify PUT /api/v1/tests/dbsnapshot resets mutated context, telemetry, alerts, and gamification."""
    # 1. Mutate operational context to Mars [3/8g]
    ctx_resp = await async_client.post(
        "/api/v1/context/location",
        json={"location_setting": "Mars [3/8g]"},
    )
    assert ctx_resp.status_code == 200
    assert ctx_resp.json()["location_setting"] == "Mars [3/8g]"

    # 2. Ingest critical telemetry for AST-01 (triggers critical body status, trends, and alert queue)
    tel_resp = await async_client.post(
        "/api/v1/telemetry/ingest",
        json={
            "astronaut_id": "AST-01",
            "heart_rate_bpm": 148.0,
            "spo2_percent": 82.0,
            "core_temp_c": 37.0,
            "suit_pressure_kpa": 21.0,
            "symptoms": ["severe dyspnea"],
        },
    )
    assert tel_resp.status_code == 200
    assert tel_resp.json()["status"] == "critical"

    # 3. Advance gamification state for AST-01
    gam_resp = await async_client.post(
        "/api/v1/gamification/checkup-complete",
        json={
            "astronaut_id": "AST-01",
            "completed_tasks": ["task_morning_vitals", "task_ared_exercise"],
            "perform_gachapon_roll": True,
            "deterministic_seed": 42,
        },
    )
    assert gam_resp.status_code == 200

    # 4. Restore database snapshot via PUT /api/v1/tests/dbsnapshot
    restore_resp = await async_client.put("/api/v1/tests/dbsnapshot")
    assert restore_resp.status_code == 200
    restore_data = restore_resp.json()

    assert restore_data["status"] == "nominal"
    assert restore_data["restored"] is True
    assert restore_data["default_astronaut_id"] == "AST-01"
    assert restore_data["default_location_setting"] == "Space Station [0g]"
    assert len(restore_data["high_level"]) > 10
    assert len(restore_data["technical"]) > 10
    assert restore_data["seeded_counts"] == {
        "location_contexts": 1,
        "telemetry_records": 6,
        "gamification_profiles": 1,
        "telemedicine_alerts": 0,
        "medical_knowledge_chunks": 8,
    }

    # 5. Verify all downstream services reflect restored baseline sample data
    ctx_after = await async_client.get("/api/v1/context/location")
    assert ctx_after.status_code == 200
    assert ctx_after.json()["location_setting"] == "Space Station [0g]"
    assert ctx_after.json()["offline_fallback_active"] is False

    body_after = await async_client.get("/api/v1/astronaut/body-status?astronaut_id=AST-01")
    assert body_after.status_code == 200
    assert body_after.json()["status"] == "nominal"
    assert body_after.json()["overall_status"] == "nominal"

    trend_after = await async_client.get(
        "/api/v1/trends/heart_rate_bpm?astronaut_id=AST-01&history_limit=20&forecast_steps=10"
    )
    assert trend_after.status_code == 200
    trend_data = trend_after.json()
    assert trend_data["status"] == "nominal"
    assert trend_data["threshold_warning"] is False
    assert len(trend_data["historical_points"]) == 6

    temp_after = await async_client.get(
        "/api/v1/trends/core_temp_c?astronaut_id=AST-01&history_limit=20&forecast_steps=10"
    )
    assert temp_after.status_code == 200
    assert temp_after.json()["status"] == "nominal"
    assert temp_after.json()["threshold_warning"] is False

    queue_after = await async_client.get("/api/v1/telemedicine/sync-queue?astronaut_id=AST-01")
    assert queue_after.status_code == 200
    assert queue_after.json()["pending_count"] == 0
    assert queue_after.json()["packets"] == []

    gam_after = await async_client.get("/api/v1/gamification/status?astronaut_id=AST-01")
    assert gam_after.status_code == 200
    gam_data = gam_after.json()
    assert gam_data["readiness_streak_days"] == 1
    assert gam_data["total_checkups_completed"] == 0
    assert gam_data["gachapon_tokens"] == 1
    assert gam_data["unlocked_skins_count"] == 1


@pytest.mark.asyncio
async def test_patch_dbsnapshot_restores_clean_seeder_state(async_client: AsyncClient) -> None:
    """Verify PATCH /api/v1/tests/dbsnapshot also restores seeder snapshot cleanly."""
    resp = await async_client.patch("/api/v1/tests/dbsnapshot")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "nominal"
    assert data["restored"] is True
    assert data["seeded_counts"]["telemetry_records"] == 6
