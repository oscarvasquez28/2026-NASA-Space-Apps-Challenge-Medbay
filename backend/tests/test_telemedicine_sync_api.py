"""Integration test suite for Tempus Pro Asynchronous Telemedicine Sync Queue API."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_empty_telemedicine_sync_queue(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/telemedicine/sync-queue on empty queue returns nominal status and 0 packets."""
    resp = await async_client.get("/api/v1/telemedicine/sync-queue?astronaut_id=AST-EMPTY-TEST")
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "nominal"
    assert data["pending_count"] == 0
    assert data["packets"] == []
    assert "high_level" in data
    assert "technical" in data
    assert "comm_window_open" in data


@pytest.mark.asyncio
async def test_critical_telemetry_enqueues_and_inspect_queue(async_client: AsyncClient) -> None:
    """Verify critical telemetry automatically enqueues a store-and-forward alert inspectable in sync queue."""
    # 1. Ingest critical telemetry
    telemetry_payload = {
        "astronaut_id": "AST-SYNC-01",
        "heart_rate_bpm": 145.0,
        "systolic_bp_mmhg": 150.0,
        "diastolic_bp_mmhg": 98.0,
        "blood_sugar_mg_dl": 105.0,
        "core_temp_c": 38.8,
        "spo2_percent": 82.0,  # Critical hypoxemia
        "sleep_hours": 3.0,
        "mood_score": 3.0,
        "stress_level": 9.0,
    }
    ingest_resp = await async_client.post("/api/v1/telemetry/ingest", json=telemetry_payload)
    assert ingest_resp.status_code == 200
    assert ingest_resp.json()["status"] == "critical"

    # 2. Inspect sync queue
    queue_resp = await async_client.get("/api/v1/telemedicine/sync-queue?astronaut_id=AST-SYNC-01")
    assert queue_resp.status_code == 200
    queue_data = queue_resp.json()

    assert queue_data["pending_count"] >= 1
    assert len(queue_data["packets"]) >= 1

    packet = queue_data["packets"][0]
    assert packet["astronaut_id"] == "AST-SYNC-01"
    assert packet["status"] == "critical"
    assert packet["transmission_status"] == "pending"
    assert packet["transmitted_at"] is None

    # Verify standard measures telemetry snapshot
    assert "standard_measures_telemetry" in packet
    telem = packet["standard_measures_telemetry"]
    assert telem["spo2_percent"] == 82.0
    assert telem["heart_rate_bpm"] == 145.0

    # Verify Ridge regression trend forecasts summary
    assert "trend_forecasts_summary" in packet
    trends = packet["trend_forecasts_summary"]
    assert "heart_rate_bpm" in trends
    assert "spo2_percent" in trends
    assert "forecast_trajectory" in trends["heart_rate_bpm"]


@pytest.mark.asyncio
async def test_flush_telemedicine_queue_transitions_packets(async_client: AsyncClient) -> None:
    """Verify POST /api/v1/telemedicine/flush transitions pending alerts to transmitted with timestamp."""
    flush_payload = {
        "astronaut_id": "AST-SYNC-01",
        "force_flush": True,
        "ground_station": "NASA-JSC-MCC-Houston",
    }
    flush_resp = await async_client.post("/api/v1/telemedicine/flush", json=flush_payload)
    assert flush_resp.status_code == 200
    flush_data = flush_resp.json()

    assert flush_data["flushed_count"] >= 1
    assert flush_data["remaining_pending_count"] == 0
    assert flush_data["ground_station"] == "NASA-JSC-MCC-Houston"
    assert flush_data["transmitted_at"] is not None

    for flushed_packet in flush_data["flushed_packets"]:
        assert flushed_packet["transmission_status"] == "transmitted"
        assert flushed_packet["transmitted_at"] is not None


@pytest.mark.asyncio
async def test_filter_by_transmission_status(async_client: AsyncClient) -> None:
    """Verify filtering sync queue by transmission_status returns only matching records."""
    resp = await async_client.get(
        "/api/v1/telemedicine/sync-queue?astronaut_id=AST-SYNC-01&transmission_status=transmitted"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["packets"]) >= 1
    for packet in data["packets"]:
        assert packet["transmission_status"] == "transmitted"


@pytest.mark.asyncio
async def test_flush_empty_queue_is_safe(async_client: AsyncClient) -> None:
    """Verify flushing with no matching pending records completes gracefully."""
    flush_payload = {
        "astronaut_id": "AST-NONEXISTENT-999",
        "force_flush": True,
        "ground_station": "ESA-Darmstadt-ESOC",
    }
    resp = await async_client.post("/api/v1/telemedicine/flush", json=flush_payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["flushed_count"] == 0
    assert data["remaining_pending_count"] == 0
    assert data["flushed_packets"] == []
    assert data["status"] == "nominal"


@pytest.mark.asyncio
async def test_comm_window_offline_lockout_behavior(async_client: AsyncClient) -> None:
    """Verify offline fallback blocks unforced flush and force_flush overrides."""
    # 1. Update location context to Mars deep space with offline fallback
    loc_payload = {
        "location_setting": "Mars [3/8g]",
    }
    loc_resp = await async_client.post("/api/v1/context/location", json=loc_payload)
    assert loc_resp.status_code == 200

    # 2. Ingest critical telemetry
    telem_payload = {
        "astronaut_id": "AST-MARS-01",
        "heart_rate_bpm": 155.0,
        "spo2_percent": 80.0,
    }
    await async_client.post("/api/v1/telemetry/ingest", json=telem_payload)

    # 3. Queue shows comm_window_open == False
    queue_resp = await async_client.get("/api/v1/telemedicine/sync-queue?astronaut_id=AST-MARS-01")
    assert queue_resp.status_code == 200
    queue_data = queue_resp.json()
    assert queue_data["comm_window_open"] is False
    assert queue_data["offline_fallback_active"] is True

    # 4. Flush without force_flush fails with 400
    flush_block_resp = await async_client.post(
        "/api/v1/telemedicine/flush",
        json={"astronaut_id": "AST-MARS-01", "force_flush": False},
    )
    assert flush_block_resp.status_code == 400
    assert "Communication window is currently closed" in flush_block_resp.json()["detail"]

    # 5. Flush with force_flush=True succeeds
    flush_force_resp = await async_client.post(
        "/api/v1/telemedicine/flush",
        json={"astronaut_id": "AST-MARS-01", "force_flush": True},
    )
    assert flush_force_resp.status_code == 200
    assert flush_force_resp.json()["flushed_count"] >= 1
