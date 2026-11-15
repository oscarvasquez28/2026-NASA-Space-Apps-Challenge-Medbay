"""API routes for multi-modal telemetry and vitals ingestion."""

import json
from typing import Any, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.telemetry.models import (
    ImageMetadata,
    TelemetryIngestRequest,
    TelemetryIngestResponse,
)
from app.telemetry.service import ingest_telemetry_data
from app.telemetry.storage import process_and_store_image

router = APIRouter(prefix="/telemetry", tags=["Multi-Modal Telemetry Ingestion"])


def _parse_form_field(form_val: Any, val_type: type, default: Any = None) -> Any:
    """Helper to safely parse scalar form fields."""
    if form_val is None or form_val == "":
        return default
    try:
        return val_type(form_val)
    except (ValueError, TypeError):
        return default


@router.post(
    "/ingest",
    response_model=TelemetryIngestResponse,
    summary="Ingest multi-modal telemetry and vitals",
    description="Ingests physiological telemetry, environmental vitals, and optional diagnostic images via JSON or multipart/form-data.",
)
async def ingest_telemetry_endpoint(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> TelemetryIngestResponse:
    """Ingest astronaut vitals via JSON payload or multipart diagnostic image upload."""
    content_type = request.headers.get("content-type", "").lower()
    image_info: Optional[Tuple[str, ImageMetadata]] = None

    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception as json_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Malformed JSON request body: {json_err}",
            ) from json_err

        try:
            ingest_request = TelemetryIngestRequest.model_validate(body)
        except ValidationError as val_err:
            raise HTTPException(
                status_code=422,
                detail=val_err.errors(),
            ) from val_err


    elif "multipart/form-data" in content_type:
        form = await request.form()

        # Parse symptoms if provided as JSON string or comma list
        symptoms_raw = form.get("symptoms")
        symptoms: list[str] = []
        if symptoms_raw:
            if isinstance(symptoms_raw, str) and symptoms_raw.startswith("["):
                try:
                    symptoms = json.loads(symptoms_raw)
                except Exception:
                    symptoms = [s.strip() for s in symptoms_raw.split(",") if s.strip()]
            elif isinstance(symptoms_raw, str):
                symptoms = [s.strip() for s in symptoms_raw.split(",") if s.strip()]

        form_dict = {
            "astronaut_id": form.get("astronaut_id", "AST-01"),
            "heart_rate_bpm": _parse_form_field(form.get("heart_rate_bpm"), float, 75.0),
            "systolic_bp_mmhg": _parse_form_field(form.get("systolic_bp_mmhg"), float, 120.0),
            "diastolic_bp_mmhg": _parse_form_field(form.get("diastolic_bp_mmhg"), float, 80.0),
            "blood_sugar_mg_dl": _parse_form_field(form.get("blood_sugar_mg_dl"), float, 95.0),
            "core_temp_c": _parse_form_field(form.get("core_temp_c"), float, 37.0),
            "spo2_percent": _parse_form_field(form.get("spo2_percent"), float, 98.5),
            "sleep_hours": _parse_form_field(form.get("sleep_hours"), float, 7.5),
            "mood_score": _parse_form_field(form.get("mood_score"), float, 8.0),
            "stress_level": _parse_form_field(form.get("stress_level"), float, 2.0),
            "suit_pressure_kpa": _parse_form_field(form.get("suit_pressure_kpa"), float, None),
            "co2_partial_pressure_mmhg": _parse_form_field(
                form.get("co2_partial_pressure_mmhg"),
                float,
                None,
            ),
            "radiation_dose_msv": _parse_form_field(form.get("radiation_dose_msv"), float, None),
            "visual_acuity_logmar": _parse_form_field(
                form.get("visual_acuity_logmar"),
                float,
                None,
            ),
            "bone_mineral_density_t_score": _parse_form_field(
                form.get("bone_mineral_density_t_score"),
                float,
                None,
            ),
            "symptoms": symptoms,
            "target_anatomical_zone": form.get("target_anatomical_zone"),
        }

        try:
            ingest_request = TelemetryIngestRequest.model_validate(form_dict)
        except ValidationError as val_err:
            raise HTTPException(
                status_code=422,
                detail=val_err.errors(),
            ) from val_err


        # Check for uploaded diagnostic image file across common field names
        file_obj = (
            form.get("diagnostic_image")
            or form.get("image_file")
            or form.get("image")
        )
        if file_obj is not None and hasattr(file_obj, "filename") and file_obj.filename:
            read_fn = getattr(file_obj, "read", None)
            if callable(read_fn):
                read_res = read_fn()
                import inspect
                if inspect.isawaitable(read_res):
                    file_bytes = await read_res
                else:
                    file_bytes = read_res

                filename = getattr(file_obj, "filename", "diagnostic_image.png")
                ctype = getattr(file_obj, "content_type", "image/png")
                image_info = process_and_store_image(
                    file_bytes=file_bytes,
                    original_filename=filename,
                    content_type=ctype or "image/png",
                )

    else:
        # Fallback: attempt to parse body as JSON by default
        try:
            body = await request.json()
            ingest_request = TelemetryIngestRequest.model_validate(body)
        except ValidationError as val_err:
            raise HTTPException(
                status_code=422,
                detail=val_err.errors(),
            ) from val_err

        except Exception as parse_err:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported Content-Type '{content_type}'. Expected application/json or multipart/form-data. Details: {parse_err}",
            ) from parse_err

    return await ingest_telemetry_data(
        data=ingest_request,
        session=session,
        image_info=image_info,
    )
