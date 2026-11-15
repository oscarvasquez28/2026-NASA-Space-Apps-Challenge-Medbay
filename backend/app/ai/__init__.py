"""AI clinical advisory and routing package."""

from app.ai.client import generate_clinical_advisory
from app.ai.router_service import handle_ai_chat
from app.ai.schemas import AIChatRequest, AIChatResponse

__all__ = [
    "AIChatRequest",
    "AIChatResponse",
    "handle_ai_chat",
    "generate_clinical_advisory",
]
