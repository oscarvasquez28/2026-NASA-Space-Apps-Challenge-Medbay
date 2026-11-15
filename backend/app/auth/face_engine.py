"""Local Python facial detection and embedding engine (OpenCV YuNet + SFace)."""

from __future__ import annotations

import base64
from dataclasses import dataclass
import io
import logging
import os
import threading
from typing import List, Optional, Tuple

import numpy as np
from PIL import Image

from app.core.config import get_settings

try:
    import cv2  # type: ignore
except ImportError:  # pragma: no cover - fallback when running outside Docker without cv2
    cv2 = None  # type: ignore

logger = logging.getLogger(__name__)

YUNET_FILENAME = "face_detection_yunet_2023mar.onnx"
SFACE_FILENAME = "face_recognition_sface_2021dec.onnx"
SFACE_MODEL_NAME = "sface_2021dec"
FALLBACK_MODEL_NAME = "local_descriptor_v1"

_ENGINE_LOCK = threading.Lock()
_CACHED_YUNET = None
_CACHED_SFACE = None
_CACHED_MODEL_DIR: Optional[str] = None


@dataclass
class FaceExtractionResult:
    """Result of running local face detection and embedding extraction."""

    face_detected: bool
    embedding: List[float]
    model_name: str
    detection_score: float = 0.0
    reason: str = ""


def decode_image_bytes(image_input: str | bytes) -> np.ndarray:
    """Decode a base64 data URL, raw base64 string, or image bytes into BGR numpy array."""
    if isinstance(image_input, str):
        raw_str = image_input.strip()
        if "," in raw_str and raw_str.lower().startswith("data:"):
            raw_str = raw_str.split(",", 1)[1]
        try:
            raw_bytes = base64.b64decode(raw_str, validate=False)
        except Exception as exc:
            raise ValueError("Invalid base64 image payload.") from exc
    else:
        raw_bytes = image_input

    if not raw_bytes:
        raise ValueError("Empty image payload.")

    if cv2 is not None:
        buf = np.frombuffer(raw_bytes, dtype=np.uint8)
        bgr = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        if bgr is not None:
            return bgr

    try:
        pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    except Exception as exc:
        raise ValueError("Unable to decode image bytes.") from exc
    rgb = np.asarray(pil_img, dtype=np.uint8)
    return rgb[:, :, ::-1].copy()


def _get_onnx_paths() -> Tuple[str, str]:
    settings = get_settings()
    model_dir = settings.face_model_dir
    return (
        os.path.join(model_dir, YUNET_FILENAME),
        os.path.join(model_dir, SFACE_FILENAME),
    )


def _onnx_models_available() -> bool:
    if cv2 is None:
        return False
    if not hasattr(cv2, "FaceDetectorYN") or not hasattr(cv2, "FaceRecognizerSF"):
        return False
    yunet_path, sface_path = _get_onnx_paths()
    return os.path.isfile(yunet_path) and os.path.isfile(sface_path)


def _get_cv_models():
    """Lazily load and cache YuNet + SFace OpenCV ONNX instances."""
    global _CACHED_YUNET, _CACHED_SFACE, _CACHED_MODEL_DIR
    settings = get_settings()
    yunet_path, sface_path = _get_onnx_paths()

    if _CACHED_MODEL_DIR != settings.face_model_dir or _CACHED_YUNET is None or _CACHED_SFACE is None:
        _CACHED_YUNET = cv2.FaceDetectorYN.create(
            yunet_path,
            "",
            (320, 320),
            score_threshold=0.70,
            nms_threshold=0.30,
            top_k=5000,
        )
        _CACHED_SFACE = cv2.FaceRecognizerSF.create(sface_path, "")
        _CACHED_MODEL_DIR = settings.face_model_dir
        logger.info("Loaded OpenCV YuNet + SFace ONNX models from %s", settings.face_model_dir)

    return _CACHED_YUNET, _CACHED_SFACE


def _l2_normalize(vec: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vec))
    if norm <= 1e-12:
        return vec
    return vec / norm


def _fallback_descriptor(bgr_img: np.ndarray) -> FaceExtractionResult:
    """Lightweight deterministic 128-d local descriptor when ONNX weights are unavailable."""
    h, w = bgr_img.shape[:2]
    gray = bgr_img.mean(axis=2)
    if float(np.std(gray)) < 4.0:
        return FaceExtractionResult(
            face_detected=False,
            embedding=[],
            model_name=FALLBACK_MODEL_NAME,
            reason="Blank or uniform image frame.",
        )

    # Focus on center portrait crop and resize to 8x8 grayscale + 4x4 chroma cues -> 128-d vector
    y0, y1 = int(h * 0.15), max(int(h * 0.85), int(h * 0.15) + 1)
    x0, x1 = int(w * 0.15), max(int(w * 0.85), int(w * 0.15) + 1)
    crop = bgr_img[y0:y1, x0:x1]

    pil_crop = Image.fromarray(crop[:, :, ::-1]).resize((8, 8), Image.Resampling.BILINEAR)
    arr = np.asarray(pil_crop, dtype=np.float32) / 255.0  # 8x8x3
    gray_8x8 = arr.mean(axis=2)  # 64 dims
    gx = np.diff(gray_8x8, axis=1, prepend=gray_8x8[:, :1])  # 64 dims
    vec = np.concatenate([gray_8x8.flatten() - float(gray_8x8.mean()), gx.flatten()])
    vec = _l2_normalize(vec.astype(np.float32))
    return FaceExtractionResult(
        face_detected=True,
        embedding=vec.tolist(),
        model_name=FALLBACK_MODEL_NAME,
        detection_score=0.80,
        reason="Local descriptor fallback active (ONNX models not present).",
    )


def extract_face_embedding(image_input: str | bytes) -> FaceExtractionResult:
    """Detect the primary face in a frame and return a normalized 128-d embedding."""
    bgr_img = decode_image_bytes(image_input)
    h, w = bgr_img.shape[:2]
    if h < 16 or w < 16 or float(np.std(bgr_img)) < 4.0:
        return FaceExtractionResult(
            face_detected=False,
            embedding=[],
            model_name=SFACE_MODEL_NAME if _onnx_models_available() else FALLBACK_MODEL_NAME,
            reason="Blank or undersized camera frame.",
        )

    if not _onnx_models_available():
        return _fallback_descriptor(bgr_img)

    with _ENGINE_LOCK:
        detector, recognizer = _get_cv_models()
        detector.setInputSize((w, h))
        _, faces = detector.detect(bgr_img)
        if faces is None or len(faces) == 0:
            return FaceExtractionResult(
                face_detected=False,
                embedding=[],
                model_name=SFACE_MODEL_NAME,
                reason="No face detected in frame.",
            )

        # Select the largest bounding box (closest operator to the camera)
        best_face = max(faces, key=lambda f: float(f[2]) * float(f[3]))
        det_score = float(best_face[-1]) if len(best_face) > 14 else 0.9
        aligned = recognizer.alignCrop(bgr_img, best_face)
        feature = recognizer.feature(aligned)

    vec = _l2_normalize(np.asarray(feature, dtype=np.float32).flatten())
    return FaceExtractionResult(
        face_detected=True,
        embedding=vec.tolist(),
        model_name=SFACE_MODEL_NAME,
        detection_score=det_score,
        reason="Face detected and embedded via OpenCV YuNet + SFace.",
    )


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity in [-1.0, 1.0] between two embedding vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    a = np.asarray(vec_a, dtype=np.float32)
    b = np.asarray(vec_b, dtype=np.float32)
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom <= 1e-12:
        return 0.0
    return float(np.dot(a, b) / denom)
