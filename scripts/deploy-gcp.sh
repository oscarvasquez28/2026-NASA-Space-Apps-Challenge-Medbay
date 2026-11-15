#!/usr/bin/env bash
# Fast, low-cost hackathon deployment of backend and frontend to Google Cloud Run (macOS / Linux).
# Automatically loads variables from .env in the repository root (or --env-file) if present;
# explicit CLI flags and existing shell environment variables take precedence.
#
# Usage:
#   chmod +x scripts/deploy-gcp.sh
#   ./scripts/deploy-gcp.sh
#   ./scripts/deploy-gcp.sh --env-file .env.gcp --min-instances 1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"

ENV_FILE=""
CLI_PROJECT_ID=""
CLI_REGION=""
CLI_BACKEND_SERVICE=""
CLI_FRONTEND_SERVICE=""
CLI_TRIAGE_MODE=""
CLI_GEMINI_API_KEY=""
CLI_VERTEX_AI_MODEL=""
CLI_ELEVENLABS_API_KEY=""
CLI_ELEVENLABS_VOICE_ID=""
CLI_GCS_BUCKET_NAME=""
CLI_DATABASE_URL=""
CLI_ASTRONAUT_IDS=""
CLI_DATA_PROVIDER=""
CLI_BACKEND_MIN_INSTANCES=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --env-file <path>         Path to .env file (defaults to ./.env if present)
  --project <id>            GCP project ID (defaults to \$GCP_PROJECT_ID or active gcloud project)
  --region <region>         GCP region (default: us-central1)
  --triage-mode <mode>      deterministic | hybrid | ai_advisory (default: deterministic)
  --gemini-key <key>        Optional Gemini API key
  --gcs-bucket <bucket>     Optional GCS bucket for uploaded diagnostic images
  --database-url <url>      Database URL (default: SQLite fallback)
  --astronaut-ids <ids>     Comma-separated astronaut IDs (default: AST-01,AST-02,AST-03)
  --data-provider <mode>    rest | mock (default: rest)
  --min-instances <n>       Backend min instances: 0 = \$0 idle, 1 = keep SQLite warm (default: 0)
  -h, --help                Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --project) CLI_PROJECT_ID="$2"; shift 2 ;;
    --region) CLI_REGION="$2"; shift 2 ;;
    --triage-mode) CLI_TRIAGE_MODE="$2"; shift 2 ;;
    --gemini-key) CLI_GEMINI_API_KEY="$2"; shift 2 ;;
    --gcs-bucket) CLI_GCS_BUCKET_NAME="$2"; shift 2 ;;
    --database-url) CLI_DATABASE_URL="$2"; shift 2 ;;
    --astronaut-ids) CLI_ASTRONAUT_IDS="$2"; shift 2 ;;
    --data-provider) CLI_DATA_PROVIDER="$2"; shift 2 ;;
    --min-instances) CLI_BACKEND_MIN_INSTANCES="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Error: Google Cloud CLI (gcloud) is not installed." >&2
  echo "On macOS, install with: brew install --cask google-cloud-sdk" >&2
  exit 1
fi

load_dotenv() {
  local file_path="$1"
  local raw_line line key val
  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="${raw_line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    if [[ "$line" == export\ * ]]; then
      line="${line#export }"
      line="${line#"${line%%[![:space:]]*}"}"
    fi
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    if [[ ${#val} -ge 2 ]]; then
      if [[ ( "$val" == \"*\" ) || ( "$val" == \'*\' ) ]]; then
        val="${val:1:${#val}-2}"
      fi
    fi
    # Do not overwrite already-set shell environment variables; ignore empty values.
    if [[ -n "$val" && -z "${!key:-}" ]]; then
      export "$key=$val"
    fi
  done < "$file_path"
}

if [[ -n "$ENV_FILE" ]]; then
  if [[ "$ENV_FILE" != /* ]]; then
    ENV_FILE="$REPO_ROOT/$ENV_FILE"
  fi
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: Specified env file not found: $ENV_FILE" >&2
    exit 1
  fi
  echo "==> Loading env file: $ENV_FILE"
  load_dotenv "$ENV_FILE"
elif [[ -f "$REPO_ROOT/.env" ]]; then
  echo "==> Loading default env file: $REPO_ROOT/.env"
  load_dotenv "$REPO_ROOT/.env"
fi

PROJECT_ID="${CLI_PROJECT_ID:-${GCP_PROJECT_ID:-}}"
REGION="${CLI_REGION:-${GCP_REGION:-us-central1}}"
BACKEND_SERVICE="${CLI_BACKEND_SERVICE:-${CLOUD_RUN_BACKEND_SERVICE:-astronaut-triage-backend}}"
FRONTEND_SERVICE="${CLI_FRONTEND_SERVICE:-${CLOUD_RUN_FRONTEND_SERVICE:-astronaut-triage-frontend}}"
TRIAGE_MODE="${CLI_TRIAGE_MODE:-${TRIAGE_MODE:-deterministic}}"
GEMINI_API_KEY="${CLI_GEMINI_API_KEY:-${GEMINI_API_KEY:-}}"
VERTEX_AI_MODEL="${CLI_VERTEX_AI_MODEL:-${VERTEX_AI_MODEL:-}}"
ELEVENLABS_API_KEY="${CLI_ELEVENLABS_API_KEY:-${ELEVENLABS_API_KEY:-}}"
ELEVENLABS_VOICE_ID="${CLI_ELEVENLABS_VOICE_ID:-${ELEVENLABS_VOICE_ID:-}}"
GCS_BUCKET_NAME="${CLI_GCS_BUCKET_NAME:-${GCS_BUCKET_NAME:-}}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-}"
if [[ "$OLLAMA_BASE_URL" == "http://ollama:11434" ]]; then
  echo "==> Ignoring local Docker OLLAMA_BASE_URL (http://ollama:11434) for Cloud Run."
  OLLAMA_BASE_URL=""
fi
DATABASE_URL="${CLI_DATABASE_URL:-${DATABASE_URL:-sqlite+aiosqlite:///./astronaut_triage.db}}"
ASTRONAUT_IDS="${CLI_ASTRONAUT_IDS:-${ASTRONAUT_IDS:-AST-01,AST-02,AST-03}}"
DATA_PROVIDER="${CLI_DATA_PROVIDER:-${DATA_PROVIDER:-rest}}"
BACKEND_MIN_INSTANCES="${CLI_BACKEND_MIN_INSTANCES:-${BACKEND_MIN_INSTANCES:-0}}"

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n 1)"
if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  echo "Error: No active gcloud account found. Run 'gcloud auth login' first." >&2
  exit 1
fi

if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
fi
if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" ]]; then
  echo "Error: No GCP project set. Pass --project <id> or set GCP_PROJECT_ID in .env." >&2
  exit 1
fi

if [[ "$DATABASE_URL" == *"@db:"* ]]; then
  echo "Warning: DATABASE_URL points to local Docker host '@db:' ($DATABASE_URL), which is unreachable from Cloud Run. Backend will fall back to ephemeral SQLite unless you set DATABASE_URL to your Supabase/Postgres URL." >&2
elif [[ "$DATABASE_URL" == postgres://* || "$DATABASE_URL" == postgresql://* ]]; then
  DATABASE_URL="postgresql+asyncpg://${DATABASE_URL#*://}"
  DATABASE_URL="${DATABASE_URL//\?sslmode=/?ssl=}"
  DATABASE_URL="${DATABASE_URL//&sslmode=/&ssl=}"
fi

echo "==> Using account: $ACTIVE_ACCOUNT"
echo "==> Project: $PROJECT_ID | Region: $REGION | Triage: $TRIAGE_MODE"

gcloud config set project "$PROJECT_ID"

echo "==> Enabling Cloud Run, Cloud Build, and Artifact Registry APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

# Use '~' as delimiter because DATABASE_URL may contain '@' and ASTRONAUT_IDS contains ','.
BACKEND_ENV="^~^ENVIRONMENT=production~TRIAGE_MODE=${TRIAGE_MODE}~DATABASE_URL=${DATABASE_URL}~OLLAMA_BASE_URL=${OLLAMA_BASE_URL}"
[[ -n "$GEMINI_API_KEY" ]] && BACKEND_ENV="${BACKEND_ENV}~GEMINI_API_KEY=${GEMINI_API_KEY}"
[[ -n "$VERTEX_AI_MODEL" ]] && BACKEND_ENV="${BACKEND_ENV}~VERTEX_AI_MODEL=${VERTEX_AI_MODEL}"
[[ -n "$ELEVENLABS_API_KEY" ]] && BACKEND_ENV="${BACKEND_ENV}~ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}"
[[ -n "$ELEVENLABS_VOICE_ID" ]] && BACKEND_ENV="${BACKEND_ENV}~ELEVENLABS_VOICE_ID=${ELEVENLABS_VOICE_ID}"
[[ -n "$GCS_BUCKET_NAME" ]] && BACKEND_ENV="${BACKEND_ENV}~GCS_BUCKET_NAME=${GCS_BUCKET_NAME}"

echo "==> Deploying backend ($BACKEND_SERVICE) from $BACKEND_DIR..."
gcloud run deploy "$BACKEND_SERVICE" \
  --source "$BACKEND_DIR" \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --min-instances "$BACKEND_MIN_INSTANCES" \
  --max-instances 1 \
  --set-env-vars "$BACKEND_ENV"

BACKEND_URL="$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format 'value(status.url)')"
echo "==> Backend URL: $BACKEND_URL"

FRONTEND_ENV="^~^PUBLIC_API_URL=${BACKEND_URL}~DATA_PROVIDER=${DATA_PROVIDER}~ASTRONAUT_IDS=${ASTRONAUT_IDS}"

echo "==> Deploying frontend ($FRONTEND_SERVICE) from $FRONTEND_DIR..."
gcloud run deploy "$FRONTEND_SERVICE" \
  --source "$FRONTEND_DIR" \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --min-instances 0 \
  --set-env-vars "$FRONTEND_ENV"

FRONTEND_URL="$(gcloud run services describe "$FRONTEND_SERVICE" --region "$REGION" --format 'value(status.url)')"

echo "==> Updating backend CORS_ORIGINS to allow $FRONTEND_URL..."
gcloud run services update "$BACKEND_SERVICE" \
  --region "$REGION" \
  --update-env-vars "CORS_ORIGINS=${FRONTEND_URL}"

echo ""
echo "Deployment complete!"
echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  $BACKEND_URL"
echo "  Health:   $BACKEND_URL/health"
