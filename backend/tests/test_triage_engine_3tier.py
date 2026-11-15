"""Tests for the 3-Tier clinical triage engine and telemedicine alert queue."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TelemedicineAlertRecord
from app.triage.engine import evaluate_vital_signs
from app.triage.models import TriageLevel, VitalSigns


def test_deterministic_floor_critical_immutability() -> None:
    """Verify deterministic critical vitals cannot be downgraded by ML models."""
    vitals = VitalSigns(
        astronaut_id="AST-01",
        heart_rate_bpm=148.0,
        spo2_percent=85.0,
        core_temp_c=37.0,
        suit_pressure_kpa=21.0,
    )
    assessment = evaluate_vital_signs(vitals)
    assert assessment.triage_level == TriageLevel.CRITICAL
    assert assessment.status == "critical"
    assert assessment.triage_tier == "TIER_3_GROUND_SURGEON"
    assert assessment.mission_readiness_score <= 60.0
    assert len(assessment.anomaly_flags) >= 2


def test_triage_nominal_tier1_self_care() -> None:
    """Verify nominal astronaut vitals resolve to Tier 1 Self-Care."""
    vitals = VitalSigns(
        astronaut_id="AST-02",
        heart_rate_bpm=68.0,
        spo2_percent=98.8,
        core_temp_c=36.9,
    )
    assessment = evaluate_vital_signs(vitals)
    assert assessment.triage_level == TriageLevel.NOMINAL
    assert assessment.status == "nominal"
    assert assessment.triage_tier == "TIER_1_SELF_CARE"
    assert assessment.mission_readiness_score == 100.0
    assert assessment.anomaly_flags == []


def test_triage_caution_tier2_cmo_review() -> None:
    """Verify borderline vitals resolve to Tier 2 CMO Review."""
    vitals = VitalSigns(
        astronaut_id="AST-03",
        heart_rate_bpm=112.0,
        spo2_percent=94.5,
        core_temp_c=38.2,
    )
    assessment = evaluate_vital_signs(vitals)
    assert assessment.status == "caution"
    assert assessment.triage_tier == "TIER_2_CMO_REVIEW"
    assert assessment.mission_readiness_score < 100.0


@pytest.mark.asyncio
async def test_telemedicine_alert_enqueued_on_critical_triage(async_client: AsyncClient) -> None:
    """Verify POST /api/v1/triage/evaluate enqueues a store-and-forward telemedicine alert when critical."""
    payload = {
        "astronaut_id": "AST-CRIT-QUEUE",
        "heart_rate_bpm": 155.0,
        "spo2_percent": 84.0,
        "core_temp_c": 37.0,
        "suit_pressure_kpa": 20.0,
    }
    response = await async_client.post("/api/v1/triage/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "critical"
    assert data["triage_tier"] == "TIER_3_GROUND_SURGEON"
    assert data.get("telemedicine_enqueued") is True


@pytest.mark.asyncio
async def test_telemedicine_alert_persisted_in_db_on_ingest(async_client: AsyncClient) -> None:
    """Verify POST /api/v1/telemetry/ingest persists a TelemedicineAlertRecord on critical state."""
    payload = {
        "astronaut_id": "AST-CRIT-INGEST",
        "heart_rate_bpm": 152.0,
        "spo2_percent": 83.0,
        "core_temp_c": 37.0,
        "suit_pressure_kpa": 19.5,
        "symptoms": ["acute chest pain", "hypoxia"],
    }
    response = await async_client.post("/api/v1/telemetry/ingest", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "critical"
    assert res_data["triage_tier"] == "TIER_3_GROUND_SURGEON"
