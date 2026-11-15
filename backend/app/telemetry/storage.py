"""Storage and validation handlers for multi-modal medical images."""

import io
import logging
import os
import uuid
from typing import Tuple

from fastapi import HTTPException
from PIL import Image

from app.core.config import get_settings
from app.telemetry.models import ImageMetadata

logger = logging.getLogger(__name__)


def process_and_store_image(
    file_bytes: bytes,
    original_filename: str,
    content_type: str = "image/png",
) -> Tuple[str, ImageMetadata]:
    """Validate image with Pillow, extract metadata, and persist to upload directory."""
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty.")

    try:
        image = Image.open(io.BytesIO(file_bytes))
        image.verify()
        # Re-open image after verify() since verify() alters the stream state
        image = Image.open(io.BytesIO(file_bytes))
        width, height = image.size
        img_format = image.format or "UNKNOWN"
    except Exception as exc:
        logger.warning("Pillow image verification failed: %s", exc)
        raise HTTPException(
            status_code=400,
            detail="Invalid or corrupted image format. Expected valid PNG, JPEG, or WEBP.",
        ) from exc

    aspect_ratio = round(width / max(height, 1), 2)
    size_bytes = len(file_bytes)

    settings = get_settings()
    target_dir = settings.upload_dir or "/tmp/uploads"
    os.makedirs(target_dir, exist_ok=True)

    sanitized_filename = os.path.basename(original_filename or "diagnostic_image.png")
    unique_filename = f"{uuid.uuid4().hex[:12]}_{sanitized_filename}"
    local_file_path = os.path.join(target_dir, unique_filename)

    with open(local_file_path, "wb") as f:
        f.write(file_bytes)

    # Optional GCP Cloud Storage sync
    if settings.gcs_bucket_name:
        try:
            from google.cloud import storage

            client = storage.Client()
            bucket = client.bucket(settings.gcs_bucket_name)
            blob = bucket.blob(f"telemetry_images/{unique_filename}")
            blob.upload_from_string(file_bytes, content_type=content_type)
            logger.info("Uploaded diagnostic image to GCS bucket %s", settings.gcs_bucket_name)
        except Exception as gcs_err:
            logger.warning(
                "GCS upload failed or credentials unavailable; relying on local storage (%s): %s",
                local_file_path,
                gcs_err,
            )

    metadata = ImageMetadata(
        filename=unique_filename,
        content_type=content_type,
        size_bytes=size_bytes,
        width=width,
        height=height,
        format=img_format,
        aspect_ratio=aspect_ratio,
    )

    return local_file_path, metadata
