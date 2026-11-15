#!/usr/bin/env bash
# Snapshot the live application database INTO the database itself: copies every
# table in the `public` schema into a frozen `snapshot` (or `snapshot_<label>`)
# schema on the same DATABASE_URL (Supabase or local Postgres). A later
# db-restore.sh truncates `public` and copies the rows back.
#
# Usage:
#   ./scripts/db-snapshot.sh             # refreshes schema `snapshot`
#   ./scripts/db-snapshot.sh pre-demo    # creates schema `snapshot_pre_demo`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env}"
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"

LABEL="${1:-}"
SCHEMA="snapshot${LABEL:+_${LABEL//[^a-zA-Z0-9_]/_}}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: env file not found: $ENV_FILE" >&2
  exit 1
fi

DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DATABASE_URL not set in $ENV_FILE" >&2
  exit 1
fi
# SQLAlchemy-style 'ssl=require' is not a valid libpq parameter.
DB_URL="${DB_URL/ssl=require/sslmode=require}"

PSQL() { docker run --rm -i "$PG_IMAGE" psql "$DB_URL" -v ON_ERROR_STOP=1 "$@"; }

TABLES="$(PSQL -tAc "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1")"
if [[ -z "$TABLES" ]]; then
  echo "ERROR: no tables found in public schema" >&2
  exit 1
fi

echo "Snapshotting public.* → schema $SCHEMA ..."
{
  echo "DROP SCHEMA IF EXISTS $SCHEMA CASCADE;"
  echo "CREATE SCHEMA $SCHEMA;"
  for t in $TABLES; do
    echo "CREATE TABLE $SCHEMA.$t AS TABLE public.$t;"
  done
  echo "CREATE TABLE $SCHEMA._meta (label text primary key, taken_at timestamptz not null default now(), tables int not null);"
  echo "INSERT INTO $SCHEMA._meta (label, tables) VALUES ('$SCHEMA', $(echo "$TABLES" | wc -l | tr -d ' '));"
} | PSQL --single-transaction -f - > /dev/null

for t in $TABLES; do
  printf '  %s: %s rows\n' "$t" "$(PSQL -tAc "select count(*) from $SCHEMA.$t")"
done
echo "Done: schema $SCHEMA holds the restore point."
