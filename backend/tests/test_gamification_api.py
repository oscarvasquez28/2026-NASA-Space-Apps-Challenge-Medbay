"""Integration test suite for Routine Measurement Scheduler & Gachapon Engine API."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_gamification_auto_seeding_and_status(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/gamification/status auto-seeds default profile for new astronaut."""
    resp = await async_client.get("/api/v1/gamification/status?astronaut_id=AST-AUTO-01")
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] in ("nominal", "caution")
    assert data["astronaut_id"] == "AST-AUTO-01"
    assert data["readiness_streak_days"] == 1
    assert data["total_checkups_completed"] == 0
    assert data["gachapon_tokens"] == 1
    assert data["compliance_rate_percent"] == 0.0
    assert data["equipped_skin"]["skin_id"] == "skin_standard_suit"
    assert data["unlocked_skins_count"] == 1
    assert data["total_skins_count"] == 12
    assert len(data["routine_tasks"]) == 5
    assert len(data["catalog"]) == 12
    assert "high_level" in data
    assert "technical" in data


@pytest.mark.asyncio
async def test_checkup_complete_with_deterministic_roll(async_client: AsyncClient) -> None:
    """Verify checkup completion increments streak, advances compliance, and executes deterministic roll."""
    payload = {
        "astronaut_id": "AST-ROLL-01",
        "completed_tasks": ["task_morning_vitals", "task_ared_exercise"],
        "perform_gachapon_roll": True,
        "deterministic_seed": 42,
    }
    resp = await async_client.post("/api/v1/gamification/checkup-complete", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "nominal"
    assert data["astronaut_id"] == "AST-ROLL-01"
    assert data["readiness_streak_days"] == 2
    assert data["total_checkups_completed"] == 1
    assert data["tokens_awarded"] == 1
    assert data["roll_performed"] is True
    assert data["roll_result"] is not None
    assert data["roll_result"]["rarity"] in ("COMMON", "RARE", "EPIC", "LEGENDARY")
    assert data["compliance_rate_percent"] == 40.0
    assert len(data["completed_tasks_today"]) == 2
    assert "task_morning_vitals" in data["completed_tasks_today"]
    assert "task_ared_exercise" in data["completed_tasks_today"]


@pytest.mark.asyncio
async def test_checkup_deterministic_seed_repeatability(async_client: AsyncClient) -> None:
    """Verify identical seeds produce identical roll outcomes."""
    payload_a = {
        "astronaut_id": "AST-SEED-A",
        "completed_tasks": ["task_morning_vitals"],
        "perform_gachapon_roll": True,
        "deterministic_seed": 777,
    }
    payload_b = {
        "astronaut_id": "AST-SEED-B",
        "completed_tasks": ["task_morning_vitals"],
        "perform_gachapon_roll": True,
        "deterministic_seed": 777,
    }
    resp_a = await async_client.post("/api/v1/gamification/checkup-complete", json=payload_a)
    resp_b = await async_client.post("/api/v1/gamification/checkup-complete", json=payload_b)

    assert resp_a.status_code == 200
    assert resp_b.status_code == 200

    roll_a = resp_a.json()["roll_result"]
    roll_b = resp_b.json()["roll_result"]

    assert roll_a["rarity"] == roll_b["rarity"]
    assert roll_a["rolled_skin"]["skin_id"] == roll_b["rolled_skin"]["skin_id"]


@pytest.mark.asyncio
async def test_checkup_without_roll_accumulates_tokens(async_client: AsyncClient) -> None:
    """Verify completing checkup without rolling awards +1 token without spending."""
    payload = {
        "astronaut_id": "AST-TOKENS-01",
        "completed_tasks": ["task_hydration_nutrition"],
        "perform_gachapon_roll": False,
    }
    resp = await async_client.post("/api/v1/gamification/checkup-complete", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["roll_performed"] is False
    assert data["roll_result"] is None
    # Initial token was 1, awarded 1, spent 0 -> total 2
    assert data["gachapon_tokens"] == 2
    assert data["readiness_streak_days"] == 2


@pytest.mark.asyncio
async def test_equip_unlocked_skin(async_client: AsyncClient) -> None:
    """Verify astronaut can equip an already unlocked skin."""
    payload = {
        "astronaut_id": "AST-EQUIP-01",
        "completed_tasks": ["task_morning_vitals"],
        "perform_gachapon_roll": False,
        "equip_skin_id": "skin_standard_suit",
    }
    resp = await async_client.post("/api/v1/gamification/checkup-complete", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["equipped_skin"]["skin_id"] == "skin_standard_suit"


@pytest.mark.asyncio
async def test_equip_locked_skin_raises_400(async_client: AsyncClient) -> None:
    """Verify attempting to equip an unowned skin returns 400 Bad Request."""
    payload = {
        "astronaut_id": "AST-LOCKED-01",
        "completed_tasks": [],
        "perform_gachapon_roll": False,
        "equip_skin_id": "skin_deep_space_quantum",
    }
    resp = await async_client.post("/api/v1/gamification/checkup-complete", json=payload)
    assert resp.status_code == 400
    assert "not unlocked" in resp.json()["detail"]
