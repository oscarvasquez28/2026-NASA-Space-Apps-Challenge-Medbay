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

COPY pyproject.toml ./
COPY app ./app
COPY tests ./tests

# Ensure upload directory exists for multi-modal ingestion
RUN mkdir -p /tmp/uploads && chown -R appuser:appgroup /app /tmp/uploads
USER appuser

EXPOSE 8080

# Use shell form so Cloud Run's dynamic $PORT is respected
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers ${UVICORN_WORKERS:-1}"]
