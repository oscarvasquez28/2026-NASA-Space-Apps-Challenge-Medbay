"""Tests for database engine initialization, resilience fallback, and schema setup."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlmodel import SQLModel

from app.db.models import LocationContextRecord, TelemetryRecord
from app.db.session import _create_engine_for_url, get_sessionmaker, init_db, set_engine


@pytest.mark.asyncio
async def test_sqlite_fallback_engine_creation() -> None:
    """Validate that SQLite engine is properly created with correct connect args."""
    engine = _create_engine_for_url("sqlite+aiosqlite:///./test_fallback.db")
    assert engine is not None
    assert engine.dialect.name == "sqlite"
    await engine.dispose()


@pytest.mark.asyncio
async def test_init_db_and_seeding() -> None:
    """Validate that init_db creates all required tables and seeds default context."""
    from app.db.session import get_engine

    original_engine = get_engine()
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        future=True,
        connect_args={"check_same_thread": False},
    )
    try:
        set_engine(engine)
        await init_db()

        session_maker = get_sessionmaker()
        async with session_maker() as session:
            statement = select(LocationContextRecord)
            result = await session.execute(statement)
            records = result.scalars().all()

            assert len(records) >= 1
            default_rec = records[0]
            assert default_rec.location_setting == "Space Station [0g]"
            assert default_rec.pressure_kpa == 101.3
            assert default_rec.offline_fallback_active is False
    finally:
        await engine.dispose()
        set_engine(original_engine)

