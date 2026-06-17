#!/bin/sh
set -eu

: "${BACKUP_ROOT:?BACKUP_ROOT is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_HOST:=db}"
: "${POSTGRES_PORT:=5432}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${LUMITIME_SOURCE_DIR:=/source}"
: "${LUMITIME_UPLOAD_DIR:=/var/lib/lumitime/uploads}"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="$BACKUP_ROOT/$timestamp"
db_dir="$backup_dir/db"
uploads_dir="$backup_dir/uploads"
configs_dir="$backup_dir/configs"

mkdir -p "$db_dir" "$uploads_dir" "$configs_dir"

export PGPASSWORD="$POSTGRES_PASSWORD"

echo "[backup] exporting database"
pg_dump \
  --host="$POSTGRES_HOST" \
  --port="$POSTGRES_PORT" \
  --username="$POSTGRES_USER" \
  --format=custom \
  --file="$db_dir/lumitime.dump" \
  "$POSTGRES_DB"

echo "[backup] archiving uploads"
if [ -d "$LUMITIME_UPLOAD_DIR" ]; then
  tar -czf "$uploads_dir/uploads.tar.gz" -C "$(dirname "$LUMITIME_UPLOAD_DIR")" "$(basename "$LUMITIME_UPLOAD_DIR")"
else
  mkdir -p "$uploads_dir"
  printf '%s\n' "uploads directory missing: $LUMITIME_UPLOAD_DIR" > "$uploads_dir/README.txt"
fi

echo "[backup] archiving deployment config templates"
tar -czf "$configs_dir/deploy-configs.tar.gz" \
  --exclude='deploy/.env' \
  --exclude='deploy/backups' \
  -C "$LUMITIME_SOURCE_DIR" \
  deploy

echo "[backup] pruning backups older than ${BACKUP_RETENTION_DAYS} days"
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$BACKUP_RETENTION_DAYS" -exec rm -rf {} +

echo "[backup] completed: $backup_dir"
