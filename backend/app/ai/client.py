"""AI clinical reasoning adapter with offline deterministic fallback."""

from app.core.config import Settings
from app.triage.models import TriageAssessment, VitalSigns


async def generate_clinical_advisory(
    vitals: VitalSigns,
    baseline: TriageAssessment,
    settings: Settings,
) -> str | None:
    """Return supplementary AI guidance when enabled and configured.

    In `deterministic` mode or when no credentials (`GEMINI_API_KEY` /
    `GCP_PROJECT_ID`) are configured, returns None so triage never blocks on
    external network connectivity.
    """
    if settings.triage_mode == "deterministic":
        return None

    if not settings.gemini_api_key and not settings.gcp_project_id:
        return (
            "AI advisory skipped: no GEMINI_API_KEY or GCP_PROJECT_ID configured; "
            "relying on deterministic spacecraft triage rules."
        )

    # Placeholder hook for Vertex AI / Google GenAI SDK integration.
    return (
        f"[Advisory stub via {settings.vertex_ai_model}] "
        f"Baseline classification is {baseline.triage_level} for {vitals.astronaut_id}."
    )
