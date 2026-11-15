"""API routes for operator registration, facial recognition login, and check-in sessions."""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import (
    AuthSessionStateResponse,
    ClaimWheelSpinRequest,
    ClaimWheelSpinResponse,
    EnrollAdditionalFaceRequest,
    FaceCredentialSummary,
    FaceIdentifyRequest,
    FaceIdentifyResponse,
    OperatorCheckInRequest,
    OperatorCheckInResponse,
    RegisterOperatorRequest,
    RegisterOperatorResponse,
)
from app.auth.service import (
    claim_wheel_spin,
    delete_operator,
    enroll_additional_face,
    get_session_state,
    identify_face,
    list_user_faces,
    record_operator_checkin,
    register_operator,
)
from app.db.session import get_session

router = APIRouter(prefix="/auth", tags=["Operator Auth & Facial Recognition"])


@router.get(
    "/session-state",
    response_model=AuthSessionStateResponse,
    summary="Fetch all enrolled operators, check-in records, and face credential count",
)
async def session_state_endpoint(
    session: AsyncSession = Depends(get_session),
) -> AuthSessionStateResponse:
    return await get_session_state(session)


@router.post(
    "/register",
    response_model=RegisterOperatorResponse,
    summary="Enroll a new console operator and save their face embedding",
)
async def register_operator_endpoint(
    request: RegisterOperatorRequest,
    session: AsyncSession = Depends(get_session),
) -> RegisterOperatorResponse:
    return await register_operator(session, request)


@router.post(
    "/identify",
    response_model=FaceIdentifyResponse,
    summary="Identify an operator from a captured camera frame using local face embeddings",
)
async def identify_face_endpoint(
    request: FaceIdentifyRequest,
    session: AsyncSession = Depends(get_session),
) -> FaceIdentifyResponse:
    return await identify_face(session, request)


@router.post(
    "/checkin",
    response_model=OperatorCheckInResponse,
    summary="Idempotently record an operator daily check-in and sync gamification streak",
)
async def checkin_endpoint(
    request: OperatorCheckInRequest,
    session: AsyncSession = Depends(get_session),
) -> OperatorCheckInResponse:
    return await record_operator_checkin(session, request)


@router.post(
    "/claim-wheel-spin",
    response_model=ClaimWheelSpinResponse,
    summary="Consume a Prize Drum spin and persist the unlocked companion skin",
)
async def claim_wheel_spin_endpoint(
    request: ClaimWheelSpinRequest,
    session: AsyncSession = Depends(get_session),
) -> ClaimWheelSpinResponse:
    return await claim_wheel_spin(session, request)


@router.get(
    "/users/{user_id}/faces",
    response_model=List[FaceCredentialSummary],
    summary="List saved face credentials mapped to an operator user_id",
)
async def list_user_faces_endpoint(
    user_id: str,
    session: AsyncSession = Depends(get_session),
) -> List[FaceCredentialSummary]:
    return await list_user_faces(session, user_id)


@router.post(
    "/users/{user_id}/faces",
    response_model=FaceCredentialSummary,
    summary="Add an additional face embedding sample for an existing operator",
)
async def enroll_additional_face_endpoint(
    user_id: str,
    request: EnrollAdditionalFaceRequest,
    session: AsyncSession = Depends(get_session),
) -> FaceCredentialSummary:
    return await enroll_additional_face(session, user_id, request)


@router.delete(
    "/users/{user_id}",
    summary="Remove an operator, their saved face credentials, and their check-in history",
)
async def delete_operator_endpoint(
    user_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    return await delete_operator(session, user_id)
