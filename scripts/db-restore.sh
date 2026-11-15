#!/usr/bin/env bash
# Restore the application database to an in-database snapshot point created by
# db-snapshot.sh. Inside ONE transaction: truncates every `public` table,
# copies the frozen rows back from `snapshot` (or `snapshot_<label>`), then
# resets serial sequences so future inserts do not collide with restored ids.
#
# Usage:
#   ./scripts/db-restore.sh                 # restores schema `snapshot`
#   ./scripts/db-restore.sh pre-demo        # restores schema `snapshot_pre_demo`
#   ./scripts/db-restore.sh --yes           # skip the confirmation prompt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env}"
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"

ASSUME_YES=0
LABEL=""
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=1 ;;
    *) LABEL="$arg" ;;
  esac
done
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
DB_URL="${DB_URL/ssl=require/sslmode=require}"

PSQL() { docker run --rm -i "$PG_IMAGE" psql "$DB_URL" -v ON_ERROR_STOP=1 "$@"; }

if [[ "$(PSQL -tAc "select count(*) from information_schema.schemata where schema_name='$SCHEMA'")" != "1" ]]; then
  echo "ERROR: snapshot schema '$SCHEMA' does not exist (run db-snapshot.sh first)" >&2
  exit 1
fi

TABLES="$(PSQL -tAc "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1")"
HOST_HINT="$(echo "$DB_URL" | sed -E 's|.*@([^/:]+).*|\1|')"
TAKEN_AT="$(PSQL -tAc "select coalesce(max(taken_at)::text,'unknown') from $SCHEMA._meta" 2>/dev/null || echo unknown)"

if [[ "$ASSUME_YES" -ne 1 ]]; then
  echo "About to OVERWRITE public.* on $HOST_HINT with snapshot '$SCHEMA' (taken at $TAKEN_AT)."
  read -r -p "Continue? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

echo "Restoring $SCHEMA → public on $HOST_HINT ..."
{
  for t in $TABLES; do
    echo "INSERT INTO public.$t SELECT * FROM $SCHEMA.$t;"
  done
  # Reset serial/identity sequences to max(restored id) so new inserts do not collide.
  cat <<'SQL'
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT c.table_name AS tbl, c.column_name AS col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND pg_get_serial_sequence(format('%I.%I', c.table_schema, c.table_name), c.column_name) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L)::regclass, COALESCE((SELECT MAX(%I) FROM public.%I), 1))',
      'public.' || rec.tbl, rec.col, rec.col, rec.tbl);
  END LOOP;
END $$;
SQL
} | {
  echo "TRUNCATE TABLE $(echo "$TABLES" | sed 's/^/public./' | tr '\n' ',' | sed 's/,$//') CASCADE;"
  cat
} | PSQL --single-transaction -f - > /dev/null

echo "Restore complete (snapshot taken at $TAKEN_AT)."
