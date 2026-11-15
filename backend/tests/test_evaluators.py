"""Unit tests for the 4 modular NASA HRP / CSA domain evaluators and master aggregator."""

import pytest

from app.triage.evaluators import (
    evaluate_all_domains,
    evaluate_countermeasures_aging,
    evaluate_eva_hypoxia,
    evaluate_radiation_immune,
    evaluate_sans,
)


# ==============================================================================
# SANS Evaluator Tests
# ==============================================================================

def test_sans_evaluator_nominal() -> None:
    """Scenario 1: LogMAR 0.0, normal CO2 -> Status: nominal."""
    telemetry = {
        "visual_acuity_logmar": 0.0,
        "co2_partial_pressure_mmhg": 3.0,
        "symptoms": [],
    }
    result = evaluate_sans(telemetry)
    assert result.evaluator_id == "sans"
    assert result.severity == "nominal"
    assert result.target_zones == ["head_eyes"]
    assert any("Near-Vision" in p for p in result.prescribed_protocols)
    assert len(result.self_exam_steps) >= 1


def test_sans_evaluator_caution_thigh_cuffs_and_b_complex() -> None:
    """Scenario 2: LogMAR 0.28, CO2 4.2 mmHg -> Status: caution, Thigh Cuffs + B-Complex."""
    telemetry = {
        "visual_acuity_logmar": 0.28,
        "co2_partial_pressure_mmhg": 4.2,
        "symptoms": ["mild headache", "eye strain"],
    }
    result = evaluate_sans(telemetry)
    assert result.severity == "caution"
    assert any("Thigh Cuffs" in p for p in result.prescribed_protocols)
    assert any("B-Complex" in p for p in result.prescribed_protocols)
    assert len(result.anomaly_flags) >= 1
    assert "head_eyes" in result.target_zones


def test_sans_evaluator_critical_vision_loss() -> None:
    """Scenario 3: LogMAR 0.65 and symptom 'central scotoma' -> Status: critical, OCT + LBNP."""
    telemetry = {
        "visual_acuity_logmar": 0.65,
        "co2_partial_pressure_mmhg": 3.8,
        "symptoms": ["central scotoma", "severe vision loss"],
    }
    result = evaluate_sans(telemetry)
    assert result.severity == "critical"
    assert any("OCT" in p for p in result.prescribed_protocols)
    assert any("LBNP" in p for p in result.prescribed_protocols)


# ==============================================================================
# Radiation & Immune Evaluator Tests
# ==============================================================================

def test_radiation_immune_evaluator_nominal() -> None:
    """Scenario 4: 12.0 mSv dose, sleep 7.5h, stress 2.0 -> Status: nominal."""
    telemetry = {
        "radiation_dose_msv": 12.0,
        "sleep_hours": 7.5,
        "stress_level": 2.0,
        "symptoms": [],
    }
    result = evaluate_radiation_immune(telemetry)
    assert result.evaluator_id == "radiation_immune"
    assert result.severity == "nominal"
    assert "skin" in result.target_zones
    assert "gut_microbiome" in result.target_zones


def test_radiation_immune_evaluator_caution_rash_and_sleep_debt() -> None:
    """Scenario 5: Skin rash symptom + sleep 4.5h + stress 8.0 -> Status: caution, Ceramide + Prebiotics."""
    telemetry = {
        "radiation_dose_msv": 25.0,
        "sleep_hours": 4.5,
        "stress_level": 8.0,
        "symptoms": ["pruritic rash", "erythema"],
        "target_anatomical_zone": "skin",
    }
    result = evaluate_radiation_immune(telemetry)
    assert result.severity == "caution"
    assert any("Ceramide" in p for p in result.prescribed_protocols)
    assert any("Prebiotic" in p for p in result.prescribed_protocols)
    assert any("PCR" in p for p in result.prescribed_protocols)


def test_radiation_immune_evaluator_critical_spe() -> None:
    """Scenario 6: Radiation dose 320 mSv -> Status: critical, Storm Shelter + Antiviral."""
    telemetry = {
        "radiation_dose_msv": 320.0,
        "sleep_hours": 6.0,
        "stress_level": 5.0,
        "symptoms": [],
    }
    result = evaluate_radiation_immune(telemetry)
    assert result.severity == "critical"
    assert any("Storm Shelter" in p for p in result.prescribed_protocols)
    assert any("Antiviral" in p for p in result.prescribed_protocols)


# ==============================================================================
# EVA Hypoxia Evaluator Tests
# ==============================================================================

def test_eva_hypoxia_evaluator_nominal() -> None:
    """Scenario 7: SpO2 98.5%, suit pressure 29.6 kPa -> Status: nominal."""
    telemetry = {
        "spo2_percent": 98.5,
        "suit_pressure_kpa": 29.6,
        "heart_rate_bpm": 75.0,
        "co2_partial_pressure_mmhg": 3.0,
        "symptoms": [],
    }
    result = evaluate_eva_hypoxia(telemetry)
    assert result.evaluator_id == "eva_hypoxia"
    assert result.severity == "nominal"
    assert "cardiovascular_chest" in result.target_zones


def test_eva_hypoxia_evaluator_caution_co2_buildup() -> None:
    """Scenario 8: CO2 4.8 mmHg in helmet -> Status: caution, LiOH scrubber changeout."""
    telemetry = {
        "spo2_percent": 96.0,
        "suit_pressure_kpa": 29.6,
        "heart_rate_bpm": 80.0,
        "co2_partial_pressure_mmhg": 4.8,
        "symptoms": ["mild headache"],
    }
    result = evaluate_eva_hypoxia(telemetry)
    assert result.severity == "caution"
    assert any("Scrubber" in p for p in result.prescribed_protocols)


def test_eva_hypoxia_evaluator_critical_depressurization_and_bends() -> None:
    """Scenario 9: Suit pressure 21.0 kPa, SpO2 83.0% -> Status: critical, Abort + Bends Protocol."""
    telemetry = {
        "spo2_percent": 83.0,
        "suit_pressure_kpa": 21.0,
        "heart_rate_bpm": 138.0,
        "symptoms": ["bends", "joint pain", "dyspnea"],
    }
    result = evaluate_eva_hypoxia(telemetry)
    assert result.severity == "critical"
    assert any("Abort" in p for p in result.prescribed_protocols)
    assert any("Bends" in p for p in result.prescribed_protocols)


# ==============================================================================
# Countermeasures & Accelerated Aging Evaluator Tests
# ==============================================================================

def test_countermeasures_aging_evaluator_nominal() -> None:
    """Scenario 10: BMD T-score 0.1, blood glucose 88.0 mg/dL -> Status: nominal."""
    telemetry = {
        "bone_mineral_density_t_score": 0.1,
        "blood_sugar_mg_dl": 88.0,
        "heart_rate_bpm": 70.0,
        "symptoms": [],
    }
    result = evaluate_countermeasures_aging(telemetry)
    assert result.evaluator_id == "countermeasures_aging"
    assert result.severity == "nominal"
    assert "spine_skeletal" in result.target_zones


def test_countermeasures_aging_evaluator_caution_bone_and_glucose() -> None:
    """Scenario 11: BMD -1.75, glucose 118.0 mg/dL -> Status: caution, Zero T2 + Food Physiology + Gardening."""
    telemetry = {
        "bone_mineral_density_t_score": -1.75,
        "blood_sugar_mg_dl": 118.0,
        "heart_rate_bpm": 74.0,
        "symptoms": ["calf cramp", "mild back pain"],
    }
    result = evaluate_countermeasures_aging(telemetry)
    assert result.severity == "caution"
    assert any("Zero T2" in p for p in result.prescribed_protocols)
    assert any("Food Physiology" in p for p in result.prescribed_protocols)
    assert any("Space Gardening" in p for p in result.prescribed_protocols)


def test_countermeasures_aging_evaluator_critical_osteoporosis() -> None:
    """Scenario 12: BMD T-score -2.85 -> Status: critical, Halt axial loading."""
    telemetry = {
        "bone_mineral_density_t_score": -2.85,
        "blood_sugar_mg_dl": 92.0,
        "heart_rate_bpm": 70.0,
        "symptoms": [],
    }
    result = evaluate_countermeasures_aging(telemetry)
    assert result.severity == "critical"
    assert any("Halt High-Impact" in p for p in result.prescribed_protocols)


# ==============================================================================
# Master Aggregator Test
# ==============================================================================

def test_evaluate_all_domains_aggregation() -> None:
    """Scenario 13: Verifies evaluate_all_domains executes all 4 evaluators safely."""
    telemetry = {
        "visual_acuity_logmar": 0.25,
        "co2_partial_pressure_mmhg": 4.2,
        "radiation_dose_msv": 30.0,
        "spo2_percent": 97.0,
        "bone_mineral_density_t_score": -1.4,
        "blood_sugar_mg_dl": 115.0,
        "symptoms": ["mild fatigue"],
    }
    results = evaluate_all_domains(telemetry)
    assert len(results) == 4
    assert "sans" in results
    assert "radiation_immune" in results
    assert "eva_hypoxia" in results
    assert "countermeasures_aging" in results
    for key, res in results.items():
        assert res.evaluator_id == key
        assert res.severity in ["nominal", "caution", "critical"]
        assert len(res.prescribed_protocols) >= 1
