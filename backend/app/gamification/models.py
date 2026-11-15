"""SQLModel and Pydantic models for Routine Measurement Scheduler and Gachapon Engine."""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from sqlmodel import Field as SQLField, SQLModel

# ---------------------------------------------------------------------------
# Database Record
# ---------------------------------------------------------------------------

class GamificationProfileRecord(SQLModel, table=True):
    """Persisted astronaut gamification profile, streak, tokens, and skins."""

    __tablename__ = "gamification_profiles"

    id: Optional[int] = SQLField(default=None, primary_key=True)
    astronaut_id: str = SQLField(index=True, unique=True, nullable=False, default="AST-01")
    readiness_streak_days: int = SQLField(default=1, nullable=False)
    total_checkups_completed: int = SQLField(default=0, nullable=False)
    gachapon_tokens: int = SQLField(default=1, nullable=False)
    unlocked_skins_json: str = SQLField(default='["skin_standard_suit"]', nullable=False)
    equipped_skin_id: str = SQLField(default="skin_standard_suit", nullable=False)
    completed_tasks_today_json: str = SQLField(default="[]", nullable=False)
    last_checkup_at: Optional[datetime] = SQLField(default=None)
    updated_at: datetime = SQLField(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @property
    def unlocked_skins(self) -> List[str]:
        try:
            return json.loads(self.unlocked_skins_json)
        except (json.JSONDecodeError, TypeError):
            return ["skin_standard_suit"]

    def set_unlocked_skins(self, skins: List[str]) -> None:
        unique = list(dict.fromkeys(skins))
        if "skin_standard_suit" not in unique:
            unique.insert(0, "skin_standard_suit")
        self.unlocked_skins_json = json.dumps(unique)

    @property
    def completed_tasks_today(self) -> List[str]:
        try:
            return json.loads(self.completed_tasks_today_json)
        except (json.JSONDecodeError, TypeError):
            return []

    def set_completed_tasks_today(self, tasks: List[str]) -> None:
        unique = list(dict.fromkeys(tasks))
        self.completed_tasks_today_json = json.dumps(unique)


# ---------------------------------------------------------------------------
# Skin Catalog & Tasks Catalog Constants
# ---------------------------------------------------------------------------

TIER_WEIGHTS: Dict[str, float] = {
    "COMMON": 60.0,
    "RARE": 25.0,
    "EPIC": 12.0,
    "LEGENDARY": 3.0,
}

SKIN_CATALOG: List[Dict[str, Any]] = [
    # COMMON (60% weight total)
    {
        "skin_id": "skin_standard_suit",
        "name": "Standard EMU EVA Flight Suit",
        "rarity": "COMMON",
        "description": "Standard ISS intravehicular operational pressurized suit with navy blue telemetry patches.",
        "probability_percent": 20.0,
    },
    {
        "skin_id": "skin_flight_suit",
        "name": "Blue Flight Operations Suit",
        "rarity": "COMMON",
        "description": "Classic blue operations flight suit worn by astronaut test pilots during pre-flight quarantine.",
        "probability_percent": 20.0,
    },
    {
        "skin_id": "skin_exercise_apparel",
        "name": "ARED Resistance Fitness Gear",
        "rarity": "COMMON",
        "description": "High-flexibility moisture-wicking training suit designed for daily microgravity exercise counters.",
        "probability_percent": 20.0,
    },
    # RARE (25% weight total)
    {
        "skin_id": "skin_lunar_explorer",
        "name": "Artemis Lunar Regolith Suit",
        "rarity": "RARE",
        "description": "Next-gen Exploration Extravehicular Mobility Unit built for extreme shadows and ice crater exploration.",
        "probability_percent": 8.33,
    },
    {
        "skin_id": "skin_martian_pioneer",
        "name": "Mars Surface Exoskeleton",
        "rarity": "RARE",
        "description": "Dust-sealed exploration pressure frame engineered for high-mobility traverse across Martian dunes.",
        "probability_percent": 8.33,
    },
    {
        "skin_id": "skin_apollo_heritage",
        "name": "Apollo 11 Heritage A7L",
        "rarity": "RARE",
        "description": "Iconic thermal-micrometeoroid lunar surface spacesuit honoring the Apollo 11 Sea of Tranquility landing.",
        "probability_percent": 8.34,
    },
    # EPIC (12% weight total)
    {
        "skin_id": "skin_bioluminescent_pulse",
        "name": "Bio-Telemetry Cyber Mesh",
        "rarity": "EPIC",
        "description": "Advanced biological feedback exosuit featuring integrated microfluidic cooling channels and real-time pulse glow.",
        "probability_percent": 4.0,
    },
    {
        "skin_id": "skin_solar_flare_shield",
        "name": "Aegis Radiation Storm Shield",
        "rarity": "EPIC",
        "description": "Reinforced boron-polyethylene nanocomposite armor engineered for Deep Space Solar Particle Event operations.",
        "probability_percent": 4.0,
    },
    {
        "skin_id": "skin_cybernetic_visor",
        "name": "Cybernetic Neuro-Visor",
        "rarity": "EPIC",
        "description": "Augmented-reality neural interface helmet rendering SANS visual acuity grids and intracranial pressure diagnostics.",
        "probability_percent": 4.0,
    },
    # LEGENDARY (3% weight total)
    {
        "skin_id": "skin_deep_space_quantum",
        "name": "Nebula Quantum Commander",
        "rarity": "LEGENDARY",
        "description": "Experimental luminescent quantum-dot fabric reflecting cosmic deep-space stellar radiation with prismatic optics.",
        "probability_percent": 1.0,
    },
    {
        "skin_id": "skin_mars_vanguard",
        "name": "Mars Dune Vanguard Suit",
        "rarity": "LEGENDARY",
        "description": "Sealed carbon-aerogel surface survival armor with electrostatic perchlorate-repelling dust plating.",
        "probability_percent": 1.0,
    },
    {
        "skin_id": "skin_canadarm_cybershell",
        "name": "CSA Canadarm Cyber-Shell",
        "rarity": "LEGENDARY",
        "description": "Canadian Space Agency titanium robotic armature companion skin inspired by orbital Canadarm2 robotics.",
        "probability_percent": 1.0,
    },
]

# Skin aliases to ensure cross-compatibility with any alternate naming convention
SKIN_ALIASES: Dict[str, str] = {
    "skin_flight_jacket": "skin_flight_suit",
    "skin_training_jumpsuit": "skin_exercise_apparel",
    "skin_artemis_explorer": "skin_lunar_explorer",
    "skin_shuttle_specialist": "skin_martian_pioneer",
    "skin_deep_space_bioarmor": "skin_bioluminescent_pulse",
    "skin_cans_heavy_shield": "skin_solar_flare_shield",
    "skin_quantum_starlight": "skin_deep_space_quantum",
}

ROUTINE_MEASUREMENT_TASKS: List[Dict[str, Any]] = [
    {
        "task_id": "task_morning_vitals",
        "title": "Daily Morning Vitals Baseline",
        "frequency": "daily",
        "category": "physiological",
        "description": "Measure resting heart rate, blood pressure, core temperature, and SpO2 using the health dock.",
    },
    {
        "task_id": "task_ared_exercise",
        "title": "ARED Resistance Countermeasure Log",
        "frequency": "daily",
        "category": "musculoskeletal",
        "description": "Complete and log 2.5 hours of Advanced Resistive Exercise Device (ARED) and T2 treadmill session to mitigate microgravity atrophy.",
    },
    {
        "task_id": "task_hydration_nutrition",
        "title": "Hydration & Space Garden Nutrition Log",
        "frequency": "daily",
        "category": "metabolic",
        "description": "Record daily fluid intake (target >= 2.5L), sodium/potassium electrolyte balance, and metabolic blood sugar readings.",
    },
    {
        "task_id": "task_sans_visual",
        "title": "SANS Visual Acuity & OCT Eye Screening",
        "frequency": "daily",
        "category": "neuro_ophthalmology",
        "description": "Perform optical coherence tomography (OCT) or visual acuity LogMAR screening to detect Spaceflight-Associated Neuro-ocular Syndrome optic disc edema.",
    },
    {
        "task_id": "task_weekly_dosimetry_skin",
        "title": "Dosimeter Load & Skin Barrier Inspection",
        "frequency": "weekly",
        "category": "radiation_dermatology",
        "description": "Upload crew wearable dosimeter cumulative mSv readings and perform high-resolution dermatological self-examination for microgravity rash/dermatitis.",
    },
]

TASK_ALIASES: Dict[str, str] = {
    "task_sans_screening": "task_sans_visual",
    "task_dosimetry_skin": "task_weekly_dosimetry_skin",
}

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class CompanionSkinSchema(BaseModel):
    """Schema for a 3D AI companion visual skin."""
    skin_id: str
    name: str
    rarity: Literal["COMMON", "RARE", "EPIC", "LEGENDARY"]
    description: str
    unlocked: bool = False
    equipped: bool = False
    probability_percent: float = Field(description="Drop chance percentage in Gachapon roll")


class RoutineTaskSchema(BaseModel):
    """Schema for daily/weekly astronaut routine health measurement tasks."""
    task_id: str
    title: str
    frequency: str = Field(description="'daily' or 'weekly'")
    category: str
    completed: bool = False
    description: Optional[str] = None


class GachaponRollResult(BaseModel):
    """Result of a single Gachapon token roll."""
    rolled_skin: CompanionSkinSchema
    is_new_unlock: bool
    rarity: Literal["COMMON", "RARE", "EPIC", "LEGENDARY"]
    probability_percent: float
    message: str


class GamificationStatusResponse(BaseModel):
    """Standardized response summarizing gamification status, streak, tasks, and companion skin."""
    status: Literal["nominal", "caution", "critical"] = "nominal"
    high_level: str = Field(description="Astronaut-friendly mission morale and readiness summary")
    technical: str = Field(description="Flight Surgeon telemetry and protocol compliance audit")
    astronaut_id: str
    readiness_streak_days: int
    total_checkups_completed: int
    gachapon_tokens: int
    compliance_rate_percent: float
    equipped_skin: CompanionSkinSchema
    routine_tasks: List[RoutineTaskSchema]
    unlocked_skins_count: int
    total_skins_count: int
    catalog: List[CompanionSkinSchema]


class CheckupCompleteRequest(BaseModel):
    """Request to mark routine tasks as completed and optionally roll Gachapon."""
    astronaut_id: str = Field(default="AST-01", description="Astronaut unique identifier")
    completed_tasks: List[str] = Field(default_factory=list, description="List of routine task IDs completed in this checkup")
    perform_gachapon_roll: bool = Field(default=True, description="Whether to spend 1 token to roll a companion skin")
    equip_skin_id: Optional[str] = Field(default=None, description="Optional skin ID to immediately equip if unlocked")
    deterministic_seed: Optional[int] = Field(default=None, description="Optional seed for deterministic Gachapon rolls in tests")


class CheckupCompleteResponse(BaseModel):
    """Response after completing a checkup and optional Gachapon roll."""
    status: Literal["nominal", "caution", "critical"] = "nominal"
    high_level: str
    technical: str
    astronaut_id: str
    readiness_streak_days: int
    total_checkups_completed: int
    gachapon_tokens: int
    tokens_awarded: int
    roll_performed: bool
    roll_result: Optional[GachaponRollResult] = None
    equipped_skin: CompanionSkinSchema
    completed_tasks_today: List[str]
    compliance_rate_percent: float
