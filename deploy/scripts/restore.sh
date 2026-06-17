#!/bin/sh
set -eu

: "${RESTORE_ROOT:?RESTORE_ROOT is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

timestamp=${1:-${RESTORE_TIMESTAMP:-}}
if [ -z "$timestamp" ]; then
  echo "usage: RESTORE_TIMESTAMP=<backup-timestamp> restore.sh" >&2
  exit 1
fi

backup_dir="$RESTORE_ROOT/$timestamp"
db_dump="$backup_dir/db/lumitime.dump"
uploads_archive="$backup_dir/uploads/uploads.tar.gz"

if [ ! -f "$db_dump" ]; then
  echo "database dump not found: $db_dump" >&2
  exit 1
fi

export PGPASSWORD="$POSTGRES_PASSWORD"

echo "[restore] restoring database from $db_dump"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --host=db \
  --port=5432 \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  "$db_dump"

if [ -f "$uploads_archive" ]; then
  echo "[restore] restoring uploads from $uploads_archive"
  mkdir -p /var/lib/lumitime/uploads
  find /var/lib/lumitime/uploads -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  tar -xzf "$uploads_archive" -C /var/lib/lumitime
fi

echo "[restore] completed: $backup_dir"
