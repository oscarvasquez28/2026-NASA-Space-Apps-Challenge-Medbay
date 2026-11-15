"""Asynchronous database session and resilient connection engine."""

import json
import logging
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlmodel import SQLModel

from app.core.config import get_settings
from app.db.models import LocationContextRecord, TelemedicineAlertRecord, TelemetryRecord
from app.gamification.models import GamificationProfileRecord
from app.rag.models import MedicalKnowledgeChunk
from app.rag.retriever import seed_knowledge_base
from app.rag.seed_data import SPACE_MEDICINE_SEED_CHUNKS

logger = logging.getLogger(__name__)

DEFAULT_SQLITE_URL = "sqlite+aiosqlite:///./astronaut_triage.db"
DEFAULT_ASTRONAUT_ID = "AST-01"
DEFAULT_LOCATION_SETTING = "Space Station [0g]"

_DEFAULT_LOCATION_MULTIPLIERS: dict[str, float] = {
    "space_radiation": 1.2,
    "isolation_and_confinement": 1.1,
    "distance_from_earth": 1.0,
    "gravity_fields": 1.8,
    "hostile_closed_environments": 1.2,
    "composite_multiplier": 1.26,
}

# Six nominal telemetry points spaced 10 minutes apart for clean trend & body-status baselines.
_BASELINE_TELEMETRY_SERIES: tuple[dict[str, float], ...] = (
    {
        "heart_rate_bpm": 71.5,
        "systolic_bp_mmhg": 118.0,
        "diastolic_bp_mmhg": 78.0,
        "blood_sugar_mg_dl": 93.0,
        "core_temp_c": 36.95,
        "spo2_percent": 98.4,
        "sleep_hours": 7.5,
        "mood_score": 8.4,
        "stress_level": 2.0,
        "co2_partial_pressure_mmhg": 3.0,
        "radiation_dose_msv": 4.10,
        "visual_acuity_logmar": 0.01,
        "bone_mineral_density_t_score": 0.10,
        "mission_readiness_score": 98.5,
    },
    {
        "heart_rate_bpm": 71.6,
        "systolic_bp_mmhg": 118.5,
        "diastolic_bp_mmhg": 78.5,
        "blood_sugar_mg_dl": 93.4,
        "core_temp_c": 36.97,
        "spo2_percent": 98.4,
        "sleep_hours": 7.5,
        "mood_score": 8.4,
        "stress_level": 2.0,
        "co2_partial_pressure_mmhg": 3.0,
        "radiation_dose_msv": 4.15,
        "visual_acuity_logmar": 0.01,
        "bone_mineral_density_t_score": 0.10,
        "mission_readiness_score": 98.6,
    },
    {
        "heart_rate_bpm": 71.7,
        "systolic_bp_mmhg": 119.0,
        "diastolic_bp_mmhg": 79.0,
        "blood_sugar_mg_dl": 93.8,
        "core_temp_c": 36.99,
        "spo2_percent": 98.5,
        "sleep_hours": 7.6,
        "mood_score": 8.5,
        "stress_level": 2.0,
        "co2_partial_pressure_mmhg": 3.0,
        "radiation_dose_msv": 4.20,
        "visual_acuity_logmar": 0.01,
        "bone_mineral_density_t_score": 0.10,
        "mission_readiness_score": 98.7,
    },
    {
        "heart_rate_bpm": 71.8,
        "systolic_bp_mmhg": 119.0,
        "diastolic_bp_mmhg": 79.0,
        "blood_sugar_mg_dl": 94.2,
        "core_temp_c": 37.01,
        "spo2_percent": 98.5,
        "sleep_hours": 7.6,
        "mood_score": 8.5,
        "stress_level": 1.9,
        "co2_partial_pressure_mmhg": 3.0,
        "radiation_dose_msv": 4.25,
        "visual_acuity_logmar": 0.01,
        "bone_mineral_density_t_score": 0.10,
        "mission_readiness_score": 98.8,
    },
    {
        "heart_rate_bpm": 71.9,
        "systolic_bp_mmhg": 119.5,
        "diastolic_bp_mmhg": 79.5,
        "blood_sugar_mg_dl": 94.6,
        "core_temp_c": 37.03,
        "spo2_percent": 98.6,
        "sleep_hours": 7.5,
        "mood_score": 8.5,
        "stress_level": 2.0,
        "co2_partial_pressure_mmhg": 3.0,
        "radiation_dose_msv": 4.30,
        "visual_acuity_logmar": 0.01,
        "bone_mineral_density_t_score": 0.10,
        "mission_readiness_score": 98.9,
    },
    {
        "heart_rate_bpm": 72.0,
        "systolic_bp_mmhg": 120.0,
        "diastolic_bp_mmhg": 80.0,
        "blood_sugar_mg_dl": 95.0,
        "core_temp_c": 37.05,
        "spo2_percent": 98.6,
        "sleep_hours": 7.5,
        "mood_score": 8.5,
        "stress_level": 2.0,
        "co2_partial_pressure_mmhg": 3.0,
        "radiation_dose_msv": 4.35,
        "visual_acuity_logmar": 0.01,
        "bone_mineral_density_t_score": 0.10,
        "mission_readiness_score": 99.0,
    },
)

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _create_engine_for_url(db_url: str) -> AsyncEngine:
    """Create an AsyncEngine tailored to the database dialect."""
    if db_url.startswith("sqlite"):
        return create_async_engine(
            db_url,
            echo=False,
            future=True,
            connect_args={"check_same_thread": False},
        )
    return create_async_engine(
        db_url,
        echo=False,
        future=True,
        pool_pre_ping=True,
    )


def get_engine() -> AsyncEngine:
    """Retrieve or initialize the active AsyncEngine."""
    global _engine, _sessionmaker
    if _engine is None:
        settings = get_settings()
        target_url = settings.database_url or DEFAULT_SQLITE_URL
        _engine = _create_engine_for_url(target_url)
        _sessionmaker = async_sessionmaker(
            bind=_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _engine


def set_engine(engine: AsyncEngine) -> None:
    """Explicitly override the active database engine (used by test fixtures)."""
    global _engine, _sessionmaker
    _engine = engine
    _sessionmaker = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    """Retrieve or initialize the active async session maker."""
    global _sessionmaker
    if _sessionmaker is None:
        get_engine()
    assert _sessionmaker is not None
    return _sessionmaker


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session."""
    session_factory = get_sessionmaker()
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


def _build_default_location_context() -> LocationContextRecord:
    """Construct the baseline Space Station [0g] operational context record."""
    return LocationContextRecord(
        location_setting=DEFAULT_LOCATION_SETTING,
        temperature_c=21.5,
        pressure_kpa=101.3,
        lighting_lux=450.0,
        noise_dba=55.0,
        microbial_cfu_m3=200.0,
        co2_mmhg=3.0,
        earth_comm_latency_sec=0.05,
        offline_fallback_active=False,
        hazard_multipliers_json=json.dumps(_DEFAULT_LOCATION_MULTIPLIERS),
        updated_at=datetime.now(timezone.utc),
    )


async def seed_baseline_telemetry(
    session: AsyncSession,
    astronaut_id: str = DEFAULT_ASTRONAUT_ID,
) -> int:
    """Insert 6 nominal historical telemetry points spaced 10 minutes apart over the past hour."""
    now = datetime.now(timezone.utc)
    total_points = len(_BASELINE_TELEMETRY_SERIES)
    for idx, sample in enumerate(_BASELINE_TELEMETRY_SERIES):
        offset_minutes = 10 * (total_points - 1 - idx)
        record = TelemetryRecord(
            astronaut_id=astronaut_id,
            timestamp=now - timedelta(minutes=offset_minutes),
            location_setting=DEFAULT_LOCATION_SETTING,
            heart_rate_bpm=sample["heart_rate_bpm"],
            systolic_bp_mmhg=sample["systolic_bp_mmhg"],
            diastolic_bp_mmhg=sample["diastolic_bp_mmhg"],
            blood_sugar_mg_dl=sample["blood_sugar_mg_dl"],
            core_temp_c=sample["core_temp_c"],
            spo2_percent=sample["spo2_percent"],
            sleep_hours=sample["sleep_hours"],
            mood_score=sample["mood_score"],
            stress_level=sample["stress_level"],
            suit_pressure_kpa=None,
            co2_partial_pressure_mmhg=sample["co2_partial_pressure_mmhg"],
            radiation_dose_msv=sample["radiation_dose_msv"],
            visual_acuity_logmar=sample["visual_acuity_logmar"],
            bone_mineral_density_t_score=sample["bone_mineral_density_t_score"],
            symptoms_json="[]",
            target_anatomical_zone=None,
            status="nominal",
            triage_tier="TIER_1_SELF_CARE",
            mission_readiness_score=sample["mission_readiness_score"],
        )
        session.add(record)
    return total_points


def _build_default_gamification_profile(
    astronaut_id: str = DEFAULT_ASTRONAUT_ID,
) -> GamificationProfileRecord:
    """Construct the baseline gamification profile matching get_or_create_profile defaults."""
    return GamificationProfileRecord(
        astronaut_id=astronaut_id,
        readiness_streak_days=1,
        total_checkups_completed=0,
        gachapon_tokens=1,
        unlocked_skins_json=json.dumps(["skin_standard_suit"]),
        equipped_skin_id="skin_standard_suit",
        completed_tasks_today_json=json.dumps([]),
        last_checkup_at=None,
        updated_at=datetime.now(timezone.utc),
    )


async def _seed_defaults_if_missing(session: AsyncSession) -> dict[str, int]:
    """Seed baseline context, telemetry, gamification profile, and knowledge base when absent."""
    seeded_contexts = 0
    existing_ctx = (await session.execute(select(LocationContextRecord.id).limit(1))).scalar_one_or_none()
    if existing_ctx is None:
        session.add(_build_default_location_context())
        seeded_contexts = 1
        logger.info("Default baseline location context seeded: %s", DEFAULT_LOCATION_SETTING)

    seeded_telemetry = 0
    existing_tel = (await session.execute(select(TelemetryRecord.id).limit(1))).scalar_one_or_none()
    if existing_tel is None:
        seeded_telemetry = await seed_baseline_telemetry(session, DEFAULT_ASTRONAUT_ID)
        logger.info("Default baseline telemetry seeded (%d records for %s).", seeded_telemetry, DEFAULT_ASTRONAUT_ID)

    seeded_profiles = 0
    existing_prof = (
        await session.execute(
            select(GamificationProfileRecord.id)
            .where(GamificationProfileRecord.astronaut_id == DEFAULT_ASTRONAUT_ID)
            .limit(1)
        )
    ).scalar_one_or_none()
    if existing_prof is None:
        session.add(_build_default_gamification_profile(DEFAULT_ASTRONAUT_ID))
        seeded_profiles = 1

    await session.commit()

    knowledge_chunks = await seed_knowledge_base(session)
    return {
        "location_contexts": seeded_contexts,
        "telemetry_records": seeded_telemetry,
        "gamification_profiles": seeded_profiles,
        "telemedicine_alerts": 0,
        "medical_knowledge_chunks": knowledge_chunks,
    }


async def restore_database_snapshot(session: AsyncSession) -> dict[str, Any]:
    """Reset runtime tables back to the exact clean seeder baseline snapshot."""
    await session.execute(delete(TelemedicineAlertRecord))
    await session.execute(delete(TelemetryRecord))
    await session.execute(delete(GamificationProfileRecord))
    await session.execute(delete(LocationContextRecord))

    chunk_count_res = await session.execute(select(func.count()).select_from(MedicalKnowledgeChunk))
    chunk_count = int(chunk_count_res.scalar_one() or 0)
    if chunk_count != len(SPACE_MEDICINE_SEED_CHUNKS):
        await session.execute(delete(MedicalKnowledgeChunk))

    await session.commit()

    seeded_counts = await _seed_defaults_if_missing(session)
    logger.info("Database snapshot restored to baseline seeder state: %s", seeded_counts)
    return {
        "restored": True,
        "restored_at": datetime.now(timezone.utc),
        "default_astronaut_id": DEFAULT_ASTRONAUT_ID,
        "default_location_setting": DEFAULT_LOCATION_SETTING,
        "seeded_counts": seeded_counts,
    }


async def init_db() -> None:
    """Initialize database tables, extensions, and default baseline records."""
    global _engine, _sessionmaker
    engine = get_engine()

    # Test initial connectivity, fallback to SQLite if PostgreSQL is unreachable
    try:
        async with engine.begin() as conn:
            if engine.dialect.name == "postgresql":
                try:
                    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                    logger.info("pgvector extension verified or created.")
                except Exception as ext_err:
                    logger.warning(
                        "Unable to create vector extension (continuing without vector support): %s",
                        ext_err,
                    )
            await conn.run_sync(SQLModel.metadata.create_all)
    except Exception as conn_err:
        logger.warning(
            "Primary database connection failed (%s). Falling back to resilient SQLite: %s",
            conn_err,
            DEFAULT_SQLITE_URL,
        )
        _engine = _create_engine_for_url(DEFAULT_SQLITE_URL)
        _sessionmaker = async_sessionmaker(
            bind=_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
        async with _engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

    session_factory = get_sessionmaker()
    async with session_factory() as session:
        counts = await _seed_defaults_if_missing(session)
        logger.info(
            "Space medicine knowledge base initialized (%d chunks present).",
            counts["medical_knowledge_chunks"],
        )
