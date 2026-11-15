"""Service logic for Tempus Pro asynchronous store-and-forward telemedicine sync queue."""

from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import LocationContextRecord, TelemedicineAlertRecord, TelemetryRecord
from app.telemedicine.models import (
    TelemedicineFlushRequest,
    TelemedicineFlushResponse,
    TelemedicineSyncQueueResponse,
    TempusProPacketSchema,
)
from app.trends.service import generate_trend_analysis

logger = logging.getLogger(__name__)


async def _get_latest_telemetry_snapshot(
    session: AsyncSession,
    astronaut_id: str,
    raw_snapshot_json: str,
) -> Dict[str, Any]:
    """Retrieve standard measures telemetry snapshot from TelemetryRecord or fallback to alert JSON."""
    stmt = (
        select(TelemetryRecord)
        .where(TelemetryRecord.astronaut_id == astronaut_id)
        .order_by(TelemetryRecord.timestamp.desc())
        .limit(1)
    )
    res = await session.execute(stmt)
    latest = res.scalar_one_or_none()

    if latest:
        return {
            "heart_rate_bpm": latest.heart_rate_bpm,
            "systolic_bp_mmhg": latest.systolic_bp_mmhg,
            "diastolic_bp_mmhg": latest.diastolic_bp_mmhg,
            "blood_sugar_mg_dl": latest.blood_sugar_mg_dl,
            "core_temp_c": latest.core_temp_c,
            "spo2_percent": latest.spo2_percent,
            "sleep_hours": latest.sleep_hours,
            "mood_score": latest.mood_score,
            "stress_level": latest.stress_level,
            "suit_pressure_kpa": latest.suit_pressure_kpa,
            "radiation_dose_msv": latest.radiation_dose_msv,
            "visual_acuity_logmar": latest.visual_acuity_logmar,
            "bone_mineral_density_t_score": latest.bone_mineral_density_t_score,
            "mission_readiness_score": latest.mission_readiness_score,
            "target_anatomical_zone": latest.target_anatomical_zone,
            "image_path": latest.image_path,
        }

    try:
        return json.loads(raw_snapshot_json)
    except Exception:
        return {}


async def _get_trend_forecasts_summary(
    session: AsyncSession,
    astronaut_id: str,
) -> Dict[str, Any]:
    """Generate Ridge regression trend summaries for key indicators (heart_rate_bpm, spo2_percent)."""
    summary: Dict[str, Any] = {}
    for indicator in ("heart_rate_bpm", "spo2_percent"):
        try:
            trend = await generate_trend_analysis(
                indicator=indicator,
                astronaut_id=astronaut_id,
                session=session,
                history_limit=20,
                forecast_steps=5,
            )
            summary[indicator] = {
                "indicator": indicator,
                "unit": trend.unit,
                "status": trend.status,
                "threshold_warning": trend.threshold_warning,
                "warning_details": trend.warning_details,
                "predicted_next": (
                    trend.forecast_points[0].predicted_value if trend.forecast_points else None
                ),
                "forecast_trajectory": [
                    {"step": i + 1, "predicted_value": p.predicted_value}
                    for i, p in enumerate(trend.forecast_points[:3])
                ],
                "high_level": trend.high_level,
                "technical": trend.technical,
            }
        except Exception as exc:
            logger.warning("Failed to generate trend summary for %s: %s", indicator, exc)
            summary[indicator] = {
                "indicator": indicator,
                "status": "nominal",
                "threshold_warning": False,
                "warning_details": None,
                "error": str(exc),
            }
    return summary


async def get_sync_queue(
    session: AsyncSession,
    astronaut_id: Optional[str] = None,
    transmission_status: Optional[str] = None,
) -> TelemedicineSyncQueueResponse:
    """Retrieve all queued store-and-forward alerts bundled into Tempus Pro packets."""
    # 1. Fetch active location context
    ctx_stmt = select(LocationContextRecord).order_by(LocationContextRecord.id.desc()).limit(1)
    ctx_res = await session.execute(ctx_stmt)
    latest_ctx = ctx_res.scalar_one_or_none()

    location_setting = latest_ctx.location_setting if latest_ctx else "Space Station [0g]"
    comm_latency = latest_ctx.earth_comm_latency_sec if latest_ctx else 0.05
    offline_fallback = latest_ctx.offline_fallback_active if latest_ctx else False
    comm_window_open = not offline_fallback

    # 2. Get pending and transmitted counts
    pending_stmt = select(func.count(TelemedicineAlertRecord.id)).where(
        TelemedicineAlertRecord.transmission_status == "pending"
    )
    transmitted_stmt = select(func.count(TelemedicineAlertRecord.id)).where(
        TelemedicineAlertRecord.transmission_status == "transmitted"
    )
    if astronaut_id:
        pending_stmt = pending_stmt.where(TelemedicineAlertRecord.astronaut_id == astronaut_id)
        transmitted_stmt = transmitted_stmt.where(TelemedicineAlertRecord.astronaut_id == astronaut_id)

    pending_count = (await session.execute(pending_stmt)).scalar() or 0
    transmitted_count = (await session.execute(transmitted_stmt)).scalar() or 0

    # 3. Query alerts matching criteria
    query = select(TelemedicineAlertRecord).order_by(TelemedicineAlertRecord.timestamp.desc())
    if astronaut_id:
        query = query.where(TelemedicineAlertRecord.astronaut_id == astronaut_id)
    if transmission_status:
        query = query.where(TelemedicineAlertRecord.transmission_status == transmission_status)

    alerts_res = await session.execute(query)
    alerts = list(alerts_res.scalars().all())

    # 4. Cache telemetry & trend summaries per astronaut to avoid redundant queries
    telem_cache: Dict[str, Dict[str, Any]] = {}
    trend_cache: Dict[str, Dict[str, Any]] = {}

    packets: List[TempusProPacketSchema] = []
    for alert in alerts:
        aid = alert.astronaut_id
        if aid not in telem_cache:
            telem_cache[aid] = await _get_latest_telemetry_snapshot(
                session=session,
                astronaut_id=aid,
                raw_snapshot_json=alert.telemetry_snapshot_json,
            )
        if aid not in trend_cache:
            trend_cache[aid] = await _get_trend_forecasts_summary(
                session=session,
                astronaut_id=aid,
            )

        try:
            anomaly_flags = json.loads(alert.anomaly_flags_json)
        except Exception:
            anomaly_flags = []

        try:
            recommended_actions = json.loads(alert.recommended_actions_json)
        except Exception:
            recommended_actions = []

        packet = TempusProPacketSchema(
            packet_id=alert.id,
            astronaut_id=alert.astronaut_id,
            timestamp=alert.timestamp,
            location_setting=alert.location_setting,
            triage_tier=alert.triage_tier,
            status=alert.status,
            priority=alert.priority,
            transmission_status=alert.transmission_status,
            transmitted_at=alert.transmitted_at,
            earth_comm_latency_sec=alert.earth_comm_latency_sec,
            anomaly_flags=anomaly_flags,
            recommended_actions=recommended_actions,
            standard_measures_telemetry=telem_cache[aid],
            trend_forecasts_summary=trend_cache[aid],
        )
        packets.append(packet)

    # 5. Determine overall queue status
    if any(p.status == "critical" and p.transmission_status == "pending" for p in packets):
        overall_status = "critical"
    elif pending_count > 0:
        overall_status = "caution"
    else:
        overall_status = "nominal"

    high_level = (
        f"Tempus Pro Telemedicine Sync Queue has {pending_count} pending alert packet(s) "
        f"awaiting Earth Flight Surgeon review. Comm window is {'OPEN' if comm_window_open else 'BUFFERED (Offline)'}."
    )
    technical = (
        f"TempusProQueue[{location_setting}]: pending={pending_count}, transmitted={transmitted_count}, "
        f"earth_latency={comm_latency:.2f}s, comm_window={'ACTIVE' if comm_window_open else 'DEEP_SPACE_STORE_AND_FORWARD'}."
    )

    return TelemedicineSyncQueueResponse(
        status=overall_status,
        high_level=high_level,
        technical=technical,
        location_setting=location_setting,
        earth_comm_latency_sec=comm_latency,
        offline_fallback_active=offline_fallback,
        comm_window_open=comm_window_open,
        pending_count=pending_count,
        transmitted_count=transmitted_count,
        packets=packets,
    )


async def flush_sync_queue(
    session: AsyncSession,
    request: TelemedicineFlushRequest,
) -> TelemedicineFlushResponse:
    """Flush pending packets by transitioning transmission_status to 'transmitted'."""
    # 1. Check comm window status
    ctx_stmt = select(LocationContextRecord).order_by(LocationContextRecord.id.desc()).limit(1)
    ctx_res = await session.execute(ctx_stmt)
    latest_ctx = ctx_res.scalar_one_or_none()
    offline_active = latest_ctx.offline_fallback_active if latest_ctx else False

    if offline_active and not request.force_flush:
        raise HTTPException(
            status_code=400,
            detail="Communication window is currently closed (RF blackout/deep-space delay). Pass force_flush=true to override.",
        )

    # 2. Select pending alerts to flush
    query = select(TelemedicineAlertRecord).where(TelemedicineAlertRecord.transmission_status == "pending")
    if request.astronaut_id:
        query = query.where(TelemedicineAlertRecord.astronaut_id == request.astronaut_id)
    if request.packet_ids:
        query = query.where(TelemedicineAlertRecord.id.in_(request.packet_ids))
    query = query.order_by(TelemedicineAlertRecord.id.asc())

    res = await session.execute(query)
    alerts_to_flush = list(res.scalars().all())

    # 3. Transition to transmitted with UTC timestamp
    now_utc = datetime.now(timezone.utc)
    flushed_packets: List[TempusProPacketSchema] = []

    telem_cache: Dict[str, Dict[str, Any]] = {}
    trend_cache: Dict[str, Dict[str, Any]] = {}

    for alert in alerts_to_flush:
        alert.transmission_status = "transmitted"
        alert.transmitted_at = now_utc
        session.add(alert)

        aid = alert.astronaut_id
        if aid not in telem_cache:
            telem_cache[aid] = await _get_latest_telemetry_snapshot(
                session=session,
                astronaut_id=aid,
                raw_snapshot_json=alert.telemetry_snapshot_json,
            )
        if aid not in trend_cache:
            trend_cache[aid] = await _get_trend_forecasts_summary(
                session=session,
                astronaut_id=aid,
            )

        try:
            anomaly_flags = json.loads(alert.anomaly_flags_json)
        except Exception:
            anomaly_flags = []
        try:
            recommended_actions = json.loads(alert.recommended_actions_json)
        except Exception:
            recommended_actions = []

        flushed_packets.append(
            TempusProPacketSchema(
                packet_id=alert.id,
                astronaut_id=alert.astronaut_id,
                timestamp=alert.timestamp,
                location_setting=alert.location_setting,
                triage_tier=alert.triage_tier,
                status=alert.status,
                priority=alert.priority,
                transmission_status="transmitted",
                transmitted_at=now_utc,
                earth_comm_latency_sec=alert.earth_comm_latency_sec,
                anomaly_flags=anomaly_flags,
                recommended_actions=recommended_actions,
                standard_measures_telemetry=telem_cache[aid],
                trend_forecasts_summary=trend_cache[aid],
            )
        )

    await session.commit()

    # 4. Count remaining pending packets
    rem_stmt = select(func.count(TelemedicineAlertRecord.id)).where(
        TelemedicineAlertRecord.transmission_status == "pending"
    )
    if request.astronaut_id:
        rem_stmt = rem_stmt.where(TelemedicineAlertRecord.astronaut_id == request.astronaut_id)
    remaining_pending = (await session.execute(rem_stmt)).scalar() or 0

    flush_status = "nominal" if remaining_pending == 0 else "caution"
    high_level = (
        f"Successfully flushed {len(flushed_packets)} telemedicine packet(s) to {request.ground_station}. "
        f"{remaining_pending} packet(s) remaining in queue."
    )
    technical = (
        f"TempusProFlushComplete: target={request.ground_station}, flushed={len(flushed_packets)}, "
        f"backlog_remaining={remaining_pending}, tx_timestamp={now_utc.isoformat()}."
    )

    return TelemedicineFlushResponse(
        status=flush_status,
        high_level=high_level,
        technical=technical,
        flushed_count=len(flushed_packets),
        remaining_pending_count=remaining_pending,
        ground_station=request.ground_station,
        transmitted_at=now_utc,
        flushed_packets=flushed_packets,
    )
