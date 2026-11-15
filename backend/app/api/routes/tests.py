"""Test utility and demonstration reset endpoints."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session, restore_database_snapshot

router = APIRouter(prefix="/tests", tags=["Tests"])


class DatabaseSnapshotRestoreResponse(BaseModel):
    """Response schema returned after restoring the database to seeder baseline."""

    status: Literal["nominal", "caution", "critical"] = "nominal"
    high_level: str
    technical: str
    restored: bool
    restored_at: datetime
    default_astronaut_id: str
    default_location_setting: str
    seeded_counts: dict[str, int]


async def _handle_restore_snapshot(session: AsyncSession) -> DatabaseSnapshotRestoreResponse:
    """Reset mutated database tables back to the clean seeder baseline snapshot."""
    result = await restore_database_snapshot(session)
    counts = result["seeded_counts"]
    astronaut_id = result["default_astronaut_id"]
    location = result["default_location_setting"]

    high_level = (
        f"Database restored to clean mission baseline. Astronaut {astronaut_id} is nominal "
        f"at {location} with fresh baseline sample telemetry ready for demonstration."
    )
    technical = (
        f"SnapshotRestore[dbsnapshot]: reset runtime tables and seeded "
        f"{counts['location_contexts']} LocationContextRecord, "
        f"{counts['telemetry_records']} TelemetryRecord ({astronaut_id}), "
        f"{counts['gamification_profiles']} GamificationProfileRecord, "
        f"{counts['telemedicine_alerts']} TelemedicineAlertRecord, and "
        f"{counts['medical_knowledge_chunks']} MedicalKnowledgeChunk rows."
    )

    return DatabaseSnapshotRestoreResponse(
        status="nominal",
        high_level=high_level,
        technical=technical,
        restored=bool(result["restored"]),
        restored_at=result["restored_at"],
        default_astronaut_id=astronaut_id,
        default_location_setting=location,
        seeded_counts=counts,
    )


@router.put(
    "/dbsnapshot",
    response_model=DatabaseSnapshotRestoreResponse,
    summary="Restore database to clean seeder baseline snapshot",
)
async def restore_dbsnapshot_put(
    session: AsyncSession = Depends(get_session),
) -> DatabaseSnapshotRestoreResponse:
    """Reset runtime telemetry, context, alerts, and gamification state to seeder baseline."""
    return await _handle_restore_snapshot(session)


@router.patch(
    "/dbsnapshot",
    response_model=DatabaseSnapshotRestoreResponse,
    include_in_schema=False,
)
async def restore_dbsnapshot_patch(
    session: AsyncSession = Depends(get_session),
) -> DatabaseSnapshotRestoreResponse:
    """Reset runtime database tables to seeder baseline via PATCH."""
    return await _handle_restore_snapshot(session)


@router.post(
    "/dbsnapshot",
    response_model=DatabaseSnapshotRestoreResponse,
    include_in_schema=False,
)
async def restore_dbsnapshot_post(
    session: AsyncSession = Depends(get_session),
) -> DatabaseSnapshotRestoreResponse:
    """Reset runtime database tables to seeder baseline via POST."""
    return await _handle_restore_snapshot(session)
