"""Unit and integration tests for the ML HealthPredictor and anomaly detection engine."""

import numpy as np
import pytest

from app.context.models import HazardMultipliers
from app.ml.predictor import (
    FEATURE_COLUMNS,
    TIER_CLASSES,
    HealthPredictor,
    get_health_predictor,
)
from app.triage.models import VitalSigns


def test_predictor_initialization_and_fit() -> None:
    """Verify HealthPredictor initializes, trains or loads model, and exposes 21 features."""
    predictor = get_health_predictor()
    assert predictor.is_fitted is True
    assert predictor.isolation_forest is not None
    assert predictor.random_forest is not None
    assert len(FEATURE_COLUMNS) == 21


def test_feature_vector_shape_and_values() -> None:
    """Verify feature vector construction produces correct 1x21 matrix from VitalSigns."""
    predictor = get_health_predictor()
    vitals = VitalSigns(
        astronaut_id="AST-01",
        heart_rate_bpm=72.0,
        spo2_percent=98.5,
        core_temp_c=37.0,
        systolic_bp_mmhg=120.0,
        suit_pressure_kpa=101.3,
        symptoms=["mild fatigue"],
    )
    hazards = HazardMultipliers(
        space_radiation=2.0,
        isolation_and_confinement=1.5,
        distance_from_earth=1.2,
        gravity_fields=1.8,
        hostile_closed_environments=1.4,
        composite_multiplier=1.75,
    )
    X = predictor.build_feature_vector(vitals, hazards)
    assert isinstance(X, np.ndarray)
    assert X.shape == (1, 21)
    # Check specific mapped features
    assert X[0, 0] == 72.0  # heart_rate_bpm
    assert X[0, 1] == 98.5  # spo2_percent
    assert X[0, 14] == 1.0  # symptom_count
    assert X[0, 20] == 1.75  # hazard_composite_multiplier


def test_anomaly_prediction_nominal_vs_critical() -> None:
    """Verify isolation forest distinguishes nominal from extreme physiological deviations."""
    predictor = get_health_predictor()

    nom_vitals = VitalSigns(
        astronaut_id="AST-01",
        heart_rate_bpm=70.0,
        spo2_percent=99.0,
        core_temp_c=37.0,
        systolic_bp_mmhg=118.0,
    )
    X_nom = predictor.build_feature_vector(nom_vitals)
    is_anomaly_nom, score_nom = predictor.predict_anomaly(X_nom)
    assert 0.0 <= score_nom <= 1.0

    crit_vitals = VitalSigns(
        astronaut_id="AST-02",
        heart_rate_bpm=160.0,
        spo2_percent=81.0,
        core_temp_c=39.8,
        systolic_bp_mmhg=195.0,
        suit_pressure_kpa=18.0,
        symptoms=["severe chest pain", "dyspnea", "dizziness", "chokes"],
    )
    crit_hazards = HazardMultipliers(
        space_radiation=4.5,
        isolation_and_confinement=3.0,
        distance_from_earth=4.0,
        gravity_fields=3.0,
        hostile_closed_environments=4.0,
        composite_multiplier=3.85,
    )
    X_crit = predictor.build_feature_vector(crit_vitals, crit_hazards)
    is_anomaly_crit, score_crit = predictor.predict_anomaly(X_crit)

    # Critical anomaly score must be higher than nominal
    assert score_crit > score_nom
    assert is_anomaly_crit is True


def test_triage_tier_prediction_probabilities() -> None:
    """Verify random forest outputs valid tier probabilities summing to 1.0."""
    predictor = get_health_predictor()
    vitals = VitalSigns(
        astronaut_id="AST-03",
        heart_rate_bpm=115.0,
        spo2_percent=94.0,
        core_temp_c=38.2,
    )
    X = predictor.build_feature_vector(vitals)
    predicted_tier, prob_dict = predictor.predict_triage_tier(X)

    assert predicted_tier in TIER_CLASSES
    for cls_name in TIER_CLASSES:
        assert cls_name in prob_dict
        assert 0.0 <= prob_dict[cls_name] <= 1.0
    total_prob = sum(prob_dict.values())
    assert abs(total_prob - 1.0) < 0.05
