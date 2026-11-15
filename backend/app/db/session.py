"""Asynchronous database session and resilient connection engine."""

import json
import logging
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, text
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

logger = logging.getLogger(__name__)

DEFAULT_SQLITE_URL = "sqlite+aiosqlite:///./astronaut_triage.db"

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

    # Seed default baseline context if location_contexts is empty
    session_factory = get_sessionmaker()
    async with session_factory() as session:
        statement = select(LocationContextRecord).limit(1)
        result = await session.execute(statement)
        existing_context = result.scalar_one_or_none()

        if existing_context is None:
            default_multipliers = {
                "space_radiation": 1.2,
                "isolation_and_confinement": 1.1,
                "distance_from_earth": 1.0,
                "gravity_fields": 1.8,
                "hostile_closed_environments": 1.2,
                "composite_multiplier": 1.26,
            }
            default_context = LocationContextRecord(
                location_setting="Space Station [0g]",
                temperature_c=21.5,
                pressure_kpa=101.3,
                lighting_lux=450.0,
                noise_dba=55.0,
                microbial_cfu_m3=200.0,
                co2_mmhg=3.0,
                earth_comm_latency_sec=0.05,
                offline_fallback_active=False,
                hazard_multipliers_json=json.dumps(default_multipliers),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(default_context)
            await session.commit()
            logger.info("Default baseline location context seeded: Space Station [0g]")

        # Seed space medicine knowledge base if empty
        seeded_count = await seed_knowledge_base(session)
        logger.info("Space medicine knowledge base initialized (%d chunks present).", seeded_count)
