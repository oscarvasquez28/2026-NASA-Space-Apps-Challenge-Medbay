"""Pytest test configuration and asynchronous fixtures."""

import os
from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.db.session import init_db, set_engine
from app.main import app

TEST_DB_FILE = "./test_astronaut_triage.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

_shared_test_engine: AsyncEngine | None = None


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database_session() -> AsyncGenerator[None, None]:
    """Configure an isolated SQLite test database engine for the session."""
    global _shared_test_engine
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

    _shared_test_engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
        connect_args={"check_same_thread": False},
    )
    set_engine(_shared_test_engine)
    await init_db()

    yield

    if _shared_test_engine is not None:
        await _shared_test_engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


@pytest_asyncio.fixture(autouse=True)
async def reset_test_engine_per_test() -> None:
    """Ensure the shared test engine is active before every test function."""
    if _shared_test_engine is not None:
        set_engine(_shared_test_engine)


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Yield an HTTPX AsyncClient bound to the FastAPI application."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
