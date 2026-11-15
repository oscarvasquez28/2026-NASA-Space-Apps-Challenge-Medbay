# ==============================================================================
# Backend Container Image (Cloud Run & Local Docker Compose Compatible)
# ==============================================================================
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /app

# Create non-root runtime user
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Pre-bake OpenCV YuNet + SFace ONNX models for 100% offline face recognition
RUN mkdir -p /app/models/face && python -c "\
import urllib.request, os; \
models = { \
  'face_detection_yunet_2023mar.onnx': 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx', \
  'face_recognition_sface_2021dec.onnx': 'https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx', \
}; \
[urllib.request.urlretrieve(u, os.path.join('/app/models/face', f)) for f, u in models.items()]"

COPY pyproject.toml ./
COPY app ./app
COPY tests ./tests

# Ensure upload and model directories are accessible to non-root user
RUN mkdir -p /tmp/uploads /app/models/face && chown -R appuser:appgroup /app /tmp/uploads
USER appuser

EXPOSE 8080

# Use shell form so Cloud Run's dynamic $PORT is respected
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers ${UVICORN_WORKERS:-1}"]
