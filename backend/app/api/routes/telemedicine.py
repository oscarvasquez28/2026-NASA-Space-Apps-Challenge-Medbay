"""API routes for Tempus Pro asynchronous telemedicine sync queue."""

from typing import Optional

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.telemedicine.models import (
    TelemedicineFlushRequest,
    TelemedicineFlushResponse,
    TelemedicineSyncQueueResponse,
)
from app.telemedicine.service import flush_sync_queue, get_sync_queue

router = APIRouter(prefix="/telemedicine", tags=["Telemedicine"])


@router.get("/sync-queue", response_model=TelemedicineSyncQueueResponse)
async def get_telemedicine_sync_queue(
    astronaut_id: Optional[str] = Query(None, description="Optional astronaut identifier filter"),
    transmission_status: Optional[str] = Query(
        None, description="Filter by transmission status: 'pending' or 'transmitted'"
    ),
    session: AsyncSession = Depends(get_session),
) -> TelemedicineSyncQueueResponse:
    """Inspect the Tempus Pro store-and-forward telemedicine sync queue with standard measures & trend summaries."""
    return await get_sync_queue(
        session=session,
        astronaut_id=astronaut_id,
        transmission_status=transmission_status,
    )


@router.post("/flush", response_model=TelemedicineFlushResponse)
async def flush_telemedicine_queue(
    request: TelemedicineFlushRequest = Body(default_factory=TelemedicineFlushRequest),
    session: AsyncSession = Depends(get_session),
) -> TelemedicineFlushResponse:
    """Flush pending store-and-forward packets in an asynchronous burst transmission to Earth Flight Surgeons."""
    return await flush_sync_queue(
        session=session,
        request=request,
    )
