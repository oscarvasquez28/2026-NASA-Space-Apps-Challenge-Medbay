"""Machine learning health problem predictor and physiological anomaly engine."""

import logging
from pathlib import Path
from typing import Any, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier

from app.context.models import HazardMultipliers

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent / "models"
MODEL_PATH = MODEL_DIR / "health_predictor.joblib"

FEATURE_COLUMNS = [
    "heart_rate_bpm",
    "spo2_percent",
    "core_temp_c",
    "systolic_bp_mmhg",
    "diastolic_bp_mmhg",
    "blood_sugar_mg_dl",
    "sleep_hours",
    "mood_score",
    "stress_level",
    "suit_pressure_kpa",
    "co2_partial_pressure_mmhg",
    "radiation_dose_msv",
    "visual_acuity_logmar",
    "bone_mineral_density_t_score",
    "symptom_count",
    "hazard_space_radiation",
    "hazard_isolation_and_confinement",
    "hazard_distance_from_earth",
    "hazard_gravity_fields",
    "hazard_hostile_closed_environments",
    "hazard_composite_multiplier",
]

TIER_CLASSES = ["TIER_1_SELF_CARE", "TIER_2_CMO_REVIEW", "TIER_3_GROUND_SURGEON"]


class HealthPredictor:
    """Predicts clinical risk tiers and anomaly scores weighted by active 5-hazards."""

    def __init__(self) -> None:
        self.isolation_forest: IsolationForest | None = None
        self.random_forest: RandomForestClassifier | None = None
        self.is_fitted: bool = False

    def generate_synthetic_data(self, n_samples: int = 1500) -> Tuple[pd.DataFrame, np.ndarray]:
        """Generate aerospace-calibrated synthetic telemetry dataset."""
        rng = np.random.default_rng(42)
        n_nominal = int(n_samples * 0.70)
        n_caution = int(n_samples * 0.20)
        n_critical = n_samples - n_nominal - n_caution

        # Nominal samples (Tier 1)
        data_nom = {
            "heart_rate_bpm": rng.normal(70.0, 7.0, n_nominal),
            "spo2_percent": rng.uniform(96.5, 99.8, n_nominal),
            "core_temp_c": rng.normal(37.0, 0.25, n_nominal),
            "systolic_bp_mmhg": rng.normal(118.0, 7.0, n_nominal),
            "diastolic_bp_mmhg": rng.normal(78.0, 5.0, n_nominal),
            "blood_sugar_mg_dl": rng.normal(95.0, 8.0, n_nominal),
            "sleep_hours": rng.normal(7.5, 0.7, n_nominal),
            "mood_score": rng.normal(8.2, 0.8, n_nominal),
            "stress_level": rng.normal(2.0, 0.8, n_nominal),
            "suit_pressure_kpa": rng.normal(101.3, 1.0, n_nominal),
            "co2_partial_pressure_mmhg": rng.normal(3.0, 0.3, n_nominal),
            "radiation_dose_msv": rng.exponential(0.2, n_nominal),
            "visual_acuity_logmar": rng.normal(0.0, 0.05, n_nominal),
            "bone_mineral_density_t_score": rng.normal(0.0, 0.2, n_nominal),
            "symptom_count": np.zeros(n_nominal),
            "hazard_space_radiation": rng.uniform(1.0, 1.8, n_nominal),
            "hazard_isolation_and_confinement": rng.uniform(1.0, 1.5, n_nominal),
            "hazard_distance_from_earth": rng.uniform(1.0, 1.5, n_nominal),
            "hazard_gravity_fields": rng.uniform(1.0, 2.0, n_nominal),
            "hazard_hostile_closed_environments": rng.uniform(1.0, 1.6, n_nominal),
            "hazard_composite_multiplier": rng.uniform(1.0, 1.6, n_nominal),
        }
        labels_nom = np.zeros(n_nominal, dtype=int)

        # Caution / CMO Review (Tier 2)
        caut_hr = np.where(rng.random(n_caution) > 0.5, rng.uniform(42.0, 49.0, n_caution), rng.uniform(101.0, 125.0, n_caution))
        data_caut = {
            "heart_rate_bpm": caut_hr,
            "spo2_percent": rng.uniform(93.0, 95.5, n_caution),
            "core_temp_c": rng.uniform(37.8, 38.8, n_caution),
            "systolic_bp_mmhg": rng.uniform(135.0, 155.0, n_caution),
            "diastolic_bp_mmhg": rng.uniform(88.0, 98.0, n_caution),
            "blood_sugar_mg_dl": rng.uniform(125.0, 170.0, n_caution),
            "sleep_hours": rng.uniform(3.5, 5.5, n_caution),
            "mood_score": rng.uniform(4.0, 6.5, n_caution),
            "stress_level": rng.uniform(6.0, 8.5, n_caution),
            "suit_pressure_kpa": rng.normal(100.0, 3.0, n_caution),
            "co2_partial_pressure_mmhg": rng.uniform(4.0, 6.0, n_caution),
            "radiation_dose_msv": rng.uniform(1.0, 5.0, n_caution),
            "visual_acuity_logmar": rng.uniform(0.2, 0.55, n_caution),
            "bone_mineral_density_t_score": rng.uniform(-1.8, -0.9, n_caution),
            "symptom_count": rng.integers(1, 4, size=n_caution),
            "hazard_space_radiation": rng.uniform(1.5, 3.0, n_caution),
            "hazard_isolation_and_confinement": rng.uniform(1.5, 3.0, n_caution),
            "hazard_distance_from_earth": rng.uniform(1.5, 2.5, n_caution),
            "hazard_gravity_fields": rng.uniform(1.5, 2.5, n_caution),
            "hazard_hostile_closed_environments": rng.uniform(1.8, 3.2, n_caution),
            "hazard_composite_multiplier": rng.uniform(1.6, 2.8, n_caution),
        }
        labels_caut = np.ones(n_caution, dtype=int)

        # Critical / Ground Surgeon (Tier 3)
        crit_hr = np.where(rng.random(n_critical) > 0.5, rng.uniform(30.0, 39.0, n_critical), rng.uniform(142.0, 175.0, n_critical))
        crit_temp = np.where(rng.random(n_critical) > 0.5, rng.uniform(33.0, 34.8, n_critical), rng.uniform(39.2, 41.0, n_critical))
        crit_bp = np.where(rng.random(n_critical) > 0.5, rng.uniform(65.0, 85.0, n_critical), rng.uniform(165.0, 205.0, n_critical))
        crit_suit = np.where(rng.random(n_critical) > 0.5, rng.uniform(15.0, 24.5, n_critical), rng.uniform(95.0, 102.0, n_critical))

        data_crit = {
            "heart_rate_bpm": crit_hr,
            "spo2_percent": rng.uniform(80.0, 89.5, n_critical),
            "core_temp_c": crit_temp,
            "systolic_bp_mmhg": crit_bp,
            "diastolic_bp_mmhg": rng.uniform(95.0, 125.0, n_critical),
            "blood_sugar_mg_dl": rng.uniform(220.0, 380.0, n_critical),
            "sleep_hours": rng.uniform(1.0, 4.0, n_critical),
            "mood_score": rng.uniform(1.0, 4.0, n_critical),
            "stress_level": rng.uniform(8.0, 10.0, n_critical),
            "suit_pressure_kpa": crit_suit,
            "co2_partial_pressure_mmhg": rng.uniform(6.5, 12.0, n_critical),
            "radiation_dose_msv": rng.uniform(15.0, 80.0, n_critical),
            "visual_acuity_logmar": rng.uniform(0.6, 1.4, n_critical),
            "bone_mineral_density_t_score": rng.uniform(-3.5, -2.1, n_critical),
            "symptom_count": rng.integers(2, 6, size=n_critical),
            "hazard_space_radiation": rng.uniform(2.5, 4.8, n_critical),
            "hazard_isolation_and_confinement": rng.uniform(2.0, 4.5, n_critical),
            "hazard_distance_from_earth": rng.uniform(2.0, 4.5, n_critical),
            "hazard_gravity_fields": rng.uniform(1.5, 3.5, n_critical),
            "hazard_hostile_closed_environments": rng.uniform(2.5, 4.5, n_critical),
            "hazard_composite_multiplier": rng.uniform(2.5, 4.5, n_critical),
        }
        labels_crit = np.full(n_critical, 2, dtype=int)

        df = pd.concat([pd.DataFrame(data_nom), pd.DataFrame(data_caut), pd.DataFrame(data_crit)], ignore_index=True)
        y = np.concatenate([labels_nom, labels_caut, labels_crit])
        return df[FEATURE_COLUMNS], y

    def train_and_save(self) -> None:
        """Train IsolationForest and RandomForestClassifier and persist via joblib."""
        X, y = self.generate_synthetic_data()

        iso_forest = IsolationForest(n_estimators=100, contamination=0.15, random_state=42)
        iso_forest.fit(X)

        rf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
        rf.fit(X, y)

        self.isolation_forest = iso_forest
        self.random_forest = rf
        self.is_fitted = True

        try:
            MODEL_DIR.mkdir(parents=True, exist_ok=True)
            payload = {
                "isolation_forest": iso_forest,
                "random_forest": rf,
                "columns": FEATURE_COLUMNS,
                "classes": TIER_CLASSES,
            }
            joblib.dump(payload, MODEL_PATH)
            logger.info("Trained and saved ML HealthPredictor model to %s", MODEL_PATH)
        except Exception as e:
            logger.warning("Could not persist model to disk (%s); operating in-memory.", e)

    def load_or_train(self) -> None:
        """Load existing persisted model or train a fresh one."""
        if MODEL_PATH.exists():
            try:
                payload = joblib.load(MODEL_PATH)
                self.isolation_forest = payload["isolation_forest"]
                self.random_forest = payload["random_forest"]
                self.is_fitted = True
                logger.info("Loaded ML HealthPredictor from %s", MODEL_PATH)
                return
            except Exception as load_err:
                logger.warning("Failed to load cached model (%s); retraining fresh...", load_err)
        self.train_and_save()

    def build_feature_vector(
        self,
        vitals: Any,
        hazards: Optional[HazardMultipliers] = None,
    ) -> np.ndarray:
        """Extract and normalize feature array from VitalSigns or TelemetryIngestRequest."""
        h_rad = hazards.space_radiation if hazards else 1.2
        h_iso = hazards.isolation_and_confinement if hazards else 1.1
        h_dist = hazards.distance_from_earth if hazards else 1.0
        h_grav = hazards.gravity_fields if hazards else 1.8
        h_host = hazards.hostile_closed_environments if hazards else 1.2
        h_comp = hazards.composite_multiplier if hazards else 1.26

        suit_p = getattr(vitals, "suit_pressure_kpa", None)
        suit_val = suit_p if suit_p is not None else 101.3

        features = [
            float(getattr(vitals, "heart_rate_bpm", 72.0)),
            float(getattr(vitals, "spo2_percent", 98.5)),
            float(getattr(vitals, "core_temp_c", 37.0)),
            float(getattr(vitals, "systolic_bp_mmhg", 120.0)),
            float(getattr(vitals, "diastolic_bp_mmhg", 80.0)),
            float(getattr(vitals, "blood_sugar_mg_dl", 95.0)),
            float(getattr(vitals, "sleep_hours", 7.5)),
            float(getattr(vitals, "mood_score", 8.0)),
            float(getattr(vitals, "stress_level", 2.0)),
            float(suit_val),
            float(getattr(vitals, "co2_partial_pressure_mmhg", None) or 3.0),
            float(getattr(vitals, "radiation_dose_msv", None) or getattr(vitals, "radiation_msv_hr", None) or 0.1),
            float(getattr(vitals, "visual_acuity_logmar", None) or 0.0),
            float(getattr(vitals, "bone_mineral_density_t_score", None) or 0.0),
            float(len(getattr(vitals, "symptoms", []))),
            float(h_rad),
            float(h_iso),
            float(h_dist),
            float(h_grav),
            float(h_host),
            float(h_comp),
        ]
        return np.array(features, dtype=float).reshape(1, -1)

    def predict_anomaly(self, X: np.ndarray) -> Tuple[bool, float]:
        """Return (is_anomaly, anomaly_score_0_to_1)."""
        if not self.is_fitted or self.isolation_forest is None:
            self.load_or_train()
        assert self.isolation_forest is not None
        X_df = pd.DataFrame(X, columns=FEATURE_COLUMNS) if isinstance(X, np.ndarray) else X
        score_raw = self.isolation_forest.score_samples(X_df)[0]
        # Invert and normalize: typical nominal is around -0.4, anomaly is < -0.6
        norm_score = max(0.0, min(1.0, round(float(-1.5 * score_raw - 0.2), 2)))
        pred = self.isolation_forest.predict(X_df)[0]
        return bool(pred == -1), norm_score

    def predict_triage_tier(
        self,
        X: np.ndarray,
        composite_multiplier: float = 1.0,
    ) -> Tuple[str, dict[str, float]]:
        """Return predicted tier name and probability dictionary."""
        if not self.is_fitted or self.random_forest is None:
            self.load_or_train()
        assert self.random_forest is not None
        X_df = pd.DataFrame(X, columns=FEATURE_COLUMNS) if isinstance(X, np.ndarray) else X
        probs = self.random_forest.predict_proba(X_df)[0]
        prob_dict = {TIER_CLASSES[i]: round(float(probs[i]), 3) for i in range(len(TIER_CLASSES))}
        predicted_idx = int(np.argmax(probs))
        return TIER_CLASSES[predicted_idx], prob_dict


_predictor_instance: HealthPredictor | None = None


def get_health_predictor() -> HealthPredictor:
    """Module-level singleton accessor for HealthPredictor."""
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = HealthPredictor()
        _predictor_instance.load_or_train()
    return _predictor_instance
