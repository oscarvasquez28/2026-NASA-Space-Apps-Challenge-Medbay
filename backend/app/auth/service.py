"""Service layer for operator sessions, face enrollment/identification, and check-in sync."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
import time
from typing import List, Optional, Set
import uuid

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.face_engine import (
    FALLBACK_MODEL_NAME,
    cosine_similarity,
    extract_face_embedding,
)
from app.auth.models import (
    AuthSessionStateResponse,
    CheckInRecordSchema,
    ClaimWheelSpinRequest,
    ClaimWheelSpinResponse,
    EnrollAdditionalFaceRequest,
    FaceCredentialRecord,
    FaceCredentialSummary,
    FaceIdentifyRequest,
    FaceIdentifyResponse,
    OperatorCheckInRecord,
    OperatorCheckInRequest,
    OperatorCheckInResponse,
    OperatorUserRecord,
    OperatorUserSchema,
    RegisterOperatorRequest,
    RegisterOperatorResponse,
)
from app.core.config import get_settings
from app.gamification.models import SKIN_ALIASES, SKIN_CATALOG
from app.gamification.service import get_or_create_profile

logger = logging.getLogger(__name__)

WHEEL_EVERY_N = 5


def _to_user_schema(user: OperatorUserRecord) -> OperatorUserSchema:
    role_val = "medic" if user.role == "medic" else "user"
    return OperatorUserSchema(
        id=user.id,
        name=user.name,
        callsign=user.callsign,
        role=role_val,
        facePhoto=user.face_photo,
        astronautId=user.astronaut_id,
        wheelSpinsClaimed=user.wheel_spins_claimed,
        createdAt=user.created_at.isoformat(),
    )


def _to_checkin_schema(rec: OperatorCheckInRecord) -> CheckInRecordSchema:
    return CheckInRecordSchema(
        userId=rec.user_id,
        day=rec.day,
        at=rec.at.isoformat(),
    )


def _day_offset(base_day: str, offset_days: int) -> str:
    dt = datetime.strptime(base_day, "%Y-%m-%d").date() + timedelta(days=offset_days)
    return dt.isoformat()


def compute_streak(days: Set[str], reference_day: str) -> int:
    """Compute consecutive check-in streak ending on reference_day (or yesterday)."""
    if not days:
        return 0
    cursor = 0 if reference_day in days else -1
    streak = 0
    while _day_offset(reference_day, cursor) in days:
        streak += 1
        cursor -= 1
    return streak


def _resolve_threshold(model_name: str) -> float:
    settings = get_settings()
    if model_name == FALLBACK_MODEL_NAME:
        return max(float(settings.face_match_threshold), 0.85)
    return float(settings.face_match_threshold)


async def get_session_state(session: AsyncSession) -> AuthSessionStateResponse:
    """Return all persisted operators, daily check-in logs, and face credential count."""
    users_res = await session.execute(
        select(OperatorUserRecord).order_by(OperatorUserRecord.created_at.asc())
    )
    users = [_to_user_schema(u) for u in users_res.scalars().all()]

    checkins_res = await session.execute(
        select(OperatorCheckInRecord).order_by(OperatorCheckInRecord.at.asc())
    )
    check_ins = [_to_checkin_schema(c) for c in checkins_res.scalars().all()]

    face_count = int(
        (
            await session.execute(
                select(func.count())
                .select_from(FaceCredentialRecord)
                .where(FaceCredentialRecord.is_active == True)  # noqa: E712
            )
        ).scalar_one()
        or 0
    )

    return AuthSessionStateResponse(
        status="nominal",
        users=users,
        check_ins=check_ins,
        face_credentials_count=face_count,
    )


async def register_operator(
    session: AsyncSession,
    request: RegisterOperatorRequest,
) -> RegisterOperatorResponse:
    """Enroll a new console operator, save their face embedding, and seed gamification."""
    try:
        extraction = extract_face_embedding(request.face_photo)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not extraction.face_detected or not extraction.embedding:
        raise HTTPException(
            status_code=422,
            detail=extraction.reason or "No face detected in the provided photo.",
        )

    existing_count = int(
        (await session.execute(select(func.count()).select_from(OperatorUserRecord))).scalar_one()
        or 0
    )

    # First enrolled operator is always enforced to hold medic clearance.
    resolved_role = "medic" if existing_count == 0 else (request.role or "user")
    user_id = (
        request.id.strip()
        if request.id and request.id.strip()
        else f"usr_{int(time.time() * 1000)}_{uuid.uuid4().hex[:4]}"
    )

    existing_user = (
        await session.execute(select(OperatorUserRecord).where(OperatorUserRecord.id == user_id))
    ).scalar_one_or_none()
    if existing_user is not None:
        raise HTTPException(status_code=409, detail=f"Operator '{user_id}' already exists.")

    astronaut_id = (
        request.astronaut_id.strip()
        if request.astronaut_id and request.astronaut_id.strip()
        else f"AST-U{existing_count + 1:02d}"
    )

    now = datetime.now(timezone.utc)
    user = OperatorUserRecord(
        id=user_id,
        name=request.name.strip(),
        callsign=request.callsign.strip() if request.callsign and request.callsign.strip() else None,
        role=resolved_role,
        astronaut_id=astronaut_id,
        face_photo=request.face_photo,
        wheel_spins_claimed=0,
        created_at=now,
    )
    session.add(user)

    face_cred = FaceCredentialRecord(
        user_id=user.id,
        label=request.label.strip() or "primary",
        model_name=extraction.model_name,
        is_active=True,
        created_at=now,
    )
    face_cred.set_embedding(extraction.embedding)
    session.add(face_cred)

    await session.commit()
    await session.refresh(user)
    await session.refresh(face_cred)

    # Seed gamification profile linked to this operator's astronaut_id
    await get_or_create_profile(session, astronaut_id=user.astronaut_id)

    logger.info(
        "Registered operator %s (%s, role=%s, ast=%s) with %s face credential #%s",
        user.id,
        user.name,
        user.role,
        user.astronaut_id,
        extraction.model_name,
        face_cred.id,
    )

    return RegisterOperatorResponse(
        status="nominal",
        user=_to_user_schema(user),
        face_credential_id=int(face_cred.id or 0),
        embedding_dim=len(extraction.embedding),
        model_name=extraction.model_name,
    )


async def enroll_additional_face(
    session: AsyncSession,
    user_id: str,
    request: EnrollAdditionalFaceRequest,
) -> FaceCredentialSummary:
    """Save an additional face embedding mapped to an existing operator user_id."""
    user = (
        await session.execute(select(OperatorUserRecord).where(OperatorUserRecord.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail=f"Operator '{user_id}' not found.")

    try:
        extraction = extract_face_embedding(request.face_photo)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not extraction.face_detected or not extraction.embedding:
        raise HTTPException(
            status_code=422,
            detail=extraction.reason or "No face detected in the provided photo.",
        )

    face_cred = FaceCredentialRecord(
        user_id=user.id,
        label=request.label.strip() or "alternate",
        model_name=extraction.model_name,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    face_cred.set_embedding(extraction.embedding)
    session.add(face_cred)
    await session.commit()
    await session.refresh(face_cred)

    return FaceCredentialSummary(
        id=int(face_cred.id or 0),
        user_id=face_cred.user_id,
        label=face_cred.label,
        model_name=face_cred.model_name,
        embedding_dim=len(extraction.embedding),
        is_active=face_cred.is_active,
        created_at=face_cred.created_at,
        last_matched_at=face_cred.last_matched_at,
    )


async def list_user_faces(session: AsyncSession, user_id: str) -> List[FaceCredentialSummary]:
    """List saved face credential metadata rows mapped to a user_id."""
    rows = (
        await session.execute(
            select(FaceCredentialRecord)
            .where(FaceCredentialRecord.user_id == user_id)
            .order_by(FaceCredentialRecord.created_at.asc())
        )
    ).scalars().all()
    return [
        FaceCredentialSummary(
            id=int(r.id or 0),
            user_id=r.user_id,
            label=r.label,
            model_name=r.model_name,
            embedding_dim=len(r.embedding),
            is_active=r.is_active,
            created_at=r.created_at,
            last_matched_at=r.last_matched_at,
        )
        for r in rows
    ]


async def identify_face(
    session: AsyncSession,
    request: FaceIdentifyRequest,
) -> FaceIdentifyResponse:
    """Detect a face in the camera frame and match against saved face_credentials."""
    try:
        extraction = extract_face_embedding(request.face_photo)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    threshold = _resolve_threshold(extraction.model_name)

    if not extraction.face_detected or not extraction.embedding:
        return FaceIdentifyResponse(
            status="no_face",
            matched_user=None,
            confidence=0.0,
            threshold=threshold,
            model_name=extraction.model_name,
            message="No face detected in camera frame.",
        )

    creds = (
        await session.execute(
            select(FaceCredentialRecord).where(
                FaceCredentialRecord.is_active == True,  # noqa: E712
                FaceCredentialRecord.model_name == extraction.model_name,
            )
        )
    ).scalars().all()

    best_cred: Optional[FaceCredentialRecord] = None
    best_score = -1.0

    for cred in creds:
        stored_vec = cred.embedding
        if not stored_vec or len(stored_vec) != len(extraction.embedding):
            continue
        score = cosine_similarity(extraction.embedding, stored_vec)
        if score > best_score:
            best_score = score
            best_cred = cred

    if best_cred is not None and best_score >= threshold:
        user = (
            await session.execute(
                select(OperatorUserRecord).where(OperatorUserRecord.id == best_cred.user_id)
            )
        ).scalar_one_or_none()
        if user is not None:
            best_cred.last_matched_at = datetime.now(timezone.utc)
            session.add(best_cred)
            await session.commit()
            return FaceIdentifyResponse(
                status="matched",
                matched_user=_to_user_schema(user),
                confidence=round(float(best_score), 4),
                threshold=threshold,
                model_name=extraction.model_name,
                message=f"Recognized operator {user.name}.",
            )

    return FaceIdentifyResponse(
        status="unknown_face",
        matched_user=None,
        confidence=round(max(float(best_score), 0.0), 4),
        threshold=threshold,
        model_name=extraction.model_name,
        message="Face detected, but no matching operator account was found.",
    )


async def record_operator_checkin(
    session: AsyncSession,
    request: OperatorCheckInRequest,
) -> OperatorCheckInResponse:
    """Idempotently log today's check-in for an operator and sync gamification streak."""
    user = (
        await session.execute(
            select(OperatorUserRecord).where(OperatorUserRecord.id == request.user_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail=f"Operator '{request.user_id}' not found.")

    day = (
        request.day.strip()
        if request.day and request.day.strip()
        else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    )

    existing = (
        await session.execute(
            select(OperatorCheckInRecord).where(
                OperatorCheckInRecord.user_id == user.id,
                OperatorCheckInRecord.day == day,
            )
        )
    ).scalar_one_or_none()

    is_new_day = existing is None
    if existing is None:
        now = datetime.now(timezone.utc)
        rec = OperatorCheckInRecord(user_id=user.id, day=day, at=now)
        session.add(rec)
        await session.commit()
        await session.refresh(rec)
    else:
        rec = existing

    all_checkins = (
        await session.execute(
            select(OperatorCheckInRecord).where(OperatorCheckInRecord.user_id == user.id)
        )
    ).scalars().all()
    day_set = {c.day for c in all_checkins}
    total_checkins = len(all_checkins)
    streak = compute_streak(day_set, day)
    earned_spin = is_new_day and (total_checkins % WHEEL_EVERY_N == 0)
    pending_spins = max(0, (total_checkins // WHEEL_EVERY_N) - user.wheel_spins_claimed)

    # Sync streak and checkup count with backend GamificationProfileRecord
    if is_new_day:
        profile = await get_or_create_profile(session, astronaut_id=user.astronaut_id)
        profile.readiness_streak_days = max(streak, 1)
        profile.total_checkups_completed += 1
        profile.gachapon_tokens += 1
        profile.last_checkup_at = datetime.now(timezone.utc)
        profile.updated_at = datetime.now(timezone.utc)
        session.add(profile)
        await session.commit()

    return OperatorCheckInResponse(
        status="nominal",
        is_new_day=is_new_day,
        earned_spin=earned_spin,
        streak=streak,
        total_checkins=total_checkins,
        pending_spins=pending_spins,
        check_in=_to_checkin_schema(rec),
    )


async def claim_wheel_spin(
    session: AsyncSession,
    request: ClaimWheelSpinRequest,
) -> ClaimWheelSpinResponse:
    """Increment wheel_spins_claimed and unlock any awarded skin in GamificationProfileRecord."""
    user = (
        await session.execute(
            select(OperatorUserRecord).where(OperatorUserRecord.id == request.user_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail=f"Operator '{request.user_id}' not found.")

    user.wheel_spins_claimed += 1
    session.add(user)

    profile = await get_or_create_profile(session, astronaut_id=user.astronaut_id)
    unlocked_skins = list(profile.unlocked_skins)
    normalized_skin: Optional[str] = None

    if request.unlocked_skin_id:
        candidate = SKIN_ALIASES.get(request.unlocked_skin_id, request.unlocked_skin_id)
        valid_ids = {s["skin_id"] for s in SKIN_CATALOG}
        if candidate not in valid_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown skin_id '{request.unlocked_skin_id}'.",
            )
        normalized_skin = candidate
        if candidate not in unlocked_skins:
            unlocked_skins.append(candidate)
            profile.set_unlocked_skins(unlocked_skins)
        if request.equip:
            profile.equipped_skin_id = candidate
        profile.updated_at = datetime.now(timezone.utc)
        session.add(profile)

    await session.commit()
    await session.refresh(user)
    await session.refresh(profile)

    total_checkins = int(
        (
            await session.execute(
                select(func.count())
                .select_from(OperatorCheckInRecord)
                .where(OperatorCheckInRecord.user_id == user.id)
            )
        ).scalar_one()
        or 0
    )
    pending_spins = max(0, (total_checkins // WHEEL_EVERY_N) - user.wheel_spins_claimed)

    return ClaimWheelSpinResponse(
        status="nominal",
        user_id=user.id,
        wheel_spins_claimed=user.wheel_spins_claimed,
        pending_spins=pending_spins,
        unlocked_skin_id=normalized_skin,
        unlocked_skins=profile.unlocked_skins,
    )


async def delete_operator(session: AsyncSession, user_id: str) -> dict[str, str]:
    """Delete an operator, their saved face embeddings, and their check-ins."""
    user = (
        await session.execute(
            select(OperatorUserRecord).where(OperatorUserRecord.id == user_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail=f"Operator '{user_id}' not found.")

    await session.execute(delete(FaceCredentialRecord).where(FaceCredentialRecord.user_id == user_id))
    await session.execute(delete(OperatorCheckInRecord).where(OperatorCheckInRecord.user_id == user_id))
    await session.execute(delete(OperatorUserRecord).where(OperatorUserRecord.id == user_id))
    await session.commit()

    return {"status": "deleted", "user_id": user_id}
