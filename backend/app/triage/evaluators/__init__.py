"""Specialized clinical domain evaluators based on NASA Human Research Program and CSA literature."""

import logging
from typing import Any, Optional

from app.triage.evaluators.countermeasures_aging import evaluate_countermeasures_aging
from app.triage.evaluators.eva_hypoxia import evaluate_eva_hypoxia
from app.triage.evaluators.models import DomainEvaluationResult
from app.triage.evaluators.radiation_immune import evaluate_radiation_immune
from app.triage.evaluators.sans import evaluate_sans

logger = logging.getLogger(__name__)

__all__ = [
    "DomainEvaluationResult",
    "evaluate_sans",
    "evaluate_radiation_immune",
    "evaluate_eva_hypoxia",
    "evaluate_countermeasures_aging",
    "evaluate_all_domains",
]


def evaluate_all_domains(
    telemetry: Any,
    context: Optional[Any] = None,
) -> dict[str, DomainEvaluationResult]:
    """Execute all 4 NASA HRP / CSA evaluators and return results mapped by domain key."""
    results: dict[str, DomainEvaluationResult] = {}

    evaluators = [
        ("sans", evaluate_sans),
        ("radiation_immune", evaluate_radiation_immune),
        ("eva_hypoxia", evaluate_eva_hypoxia),
        ("countermeasures_aging", evaluate_countermeasures_aging),
    ]

    for domain_key, eval_func in evaluators:
        try:
            results[domain_key] = eval_func(telemetry, context)
        except Exception as exc:
            logger.error("Error executing evaluator %s: %s", domain_key, exc, exc_info=True)
            # Safe nominal fallback
            results[domain_key] = DomainEvaluationResult(
                evaluator_id=domain_key,
                evaluator_name=f"{domain_key.capitalize()} Fallback Evaluator",
                target_zones=[],
                severity="nominal",
                anomaly_flags=[],
                clinical_findings=[f"Evaluator error; defaulted to nominal fallback: {exc}"],
                recommended_actions=["Review system telemetry diagnostic logs."],
                prescribed_protocols=["Nominal Monitoring"],
                self_exam_steps=[],
                risk_factors={},
                high_level="Nominal: Evaluator operational fallback active.",
                technical=f"EvaluatorException: {exc}",
            )

    return results
