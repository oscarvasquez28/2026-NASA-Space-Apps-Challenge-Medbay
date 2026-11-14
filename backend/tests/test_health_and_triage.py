"""Smoke tests for health and autonomous triage baseline endpoints."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "backend"


def test_triage_nominal() -> None:
    response = client.post(
        "/api/v1/triage/evaluate",
        json={
            "astronaut_id": "AST-01",
            "heart_rate_bpm": 72.0,
            "spo2_percent": 98.5,
            "core_temp_c": 37.0,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["triage_level"] == "NOMINAL"
    assert payload["anomaly_flags"] == []


def test_triage_critical_hypoxemia() -> None:
    response = client.post(
        "/api/v1/triage/evaluate",
        json={
            "astronaut_id": "AST-02",
            "heart_rate_bpm": 135.0,
            "spo2_percent": 86.0,
            "core_temp_c": 37.4,
            "suit_pressure_kpa": 22.0,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["triage_level"] == "CRITICAL"
    assert len(payload["anomaly_flags"]) >= 2
