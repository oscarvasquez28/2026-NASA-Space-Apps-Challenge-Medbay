"""Context & 5-Hazards domain module."""

from app.context.models import (
    HazardMultipliers,
    LocationContextResponse,
    LocationContextUpdate,
    LocationSetting,
)
from app.context.service import (
    calculate_hazard_multipliers,
    get_current_location_context,
    update_location_context,
)

__all__ = [
    "HazardMultipliers",
    "LocationContextResponse",
    "LocationContextUpdate",
    "LocationSetting",
    "calculate_hazard_multipliers",
    "get_current_location_context",
    "update_location_context",
]
