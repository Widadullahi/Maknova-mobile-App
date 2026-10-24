#!/usr/bin/env bash
#
# backup_database.sh — daily mysqldump backup with retention.
#
# Usage:
#   ./scripts/backup_database.sh
#
# Reads the same MYSQL_* variables as the app (from the environment or a
# backend/.env file). With no off-site target configured, dumps stay in
# BACKUP_DIR on the local machine — point OFFSITE_RCLONE_REMOTE or
# OFFSITE_SCP_TARGET at something remote so a dead disk can't take the
# backups with it.
#
# Cron example (daily 02:30, log to /var/log):
#   30 2 * * * cd /path/to/backend && ./scripts/backup_database.sh >> /var/log/maknova-backup.log 2>&1
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# --- Load .env (backend/.env) if present, without clobbering real env vars ---
if [[ -f "$BACKEND_DIR/.env" ]]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
    key="$(echo "$key" | xargs)"
    if [[ -n "$key" && -z "${!key:-}" ]]; then
      export "$key=$value"
    fi
  done < <(grep -E '^[A-Z_]+=' "$BACKEND_DIR/.env" || true)
fi

DB_HOST="${MYSQL_HOST:-127.0.0.1}"
DB_PORT="${MYSQL_PORT:-3306}"
DB_USER="${MYSQL_USER:-real_estate}"
DB_PASSWORD="${MYSQL_PASSWORD:-}"
DB_NAME="${MYSQL_DATABASE:-real_estate}"
SSL_CA="${MYSQL_SSL_CA:-}"

BACKUP_DIR="${BACKUP_DIR:-$BACKEND_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
OFFSITE_RCLONE_REMOTE="${OFFSITE_RCLONE_REMOTE:-}"   # e.g. "s3backup:maknova-backups"
OFFSITE_SCP_TARGET="${OFFSITE_SCP_TARGET:-}"         # e.g. "user@backuphost:/srv/backups"

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"

MYSQLDUMP_ARGS=(
  --host="$DB_HOST"
  --port="$DB_PORT"
  --user="$DB_USER"
  --single-transaction          # consistent dump without locking InnoDB tables
  --routines
  --triggers
  --events
  --set-gtid-purged=OFF
  --no-tablespaces
  --result-file=/dev/stdout
)
if [[ -n "$SSL_CA" ]]; then
  MYSQLDUMP_ARGS+=(--ssl-ca="$SSL_CA" --ssl-mode=VERIFY_IDENTITY)
fi

echo "[$(date -Is)] Dumping $DB_NAME from $DB_HOST:$DB_PORT -> $DUMP_FILE"

if [[ -n "$DB_PASSWORD" ]]; then
  export MYSQL_PWD="$DB_PASSWORD"   # not passed on argv; keeps it out of `ps`
  mysqldump "${MYSQLDUMP_ARGS[@]}" "$DB_NAME" | gzip -9 > "$DUMP_FILE"
else
  mysqldump "${MYSQLDUMP_ARGS[@]}" "$DB_NAME" | gzip -9 > "$DUMP_FILE"
fi
unset MYSQL_PWD

# A gzip that's a few hundred bytes means the dump failed and stderr was eaten;
# fail loudly rather than keep a useless "successful" backup.
MIN_BYTES="${MIN_BYTES:-2048}"
ACTUAL_BYTES="$(stat -c%s "$DUMP_FILE")"
if (( ACTUAL_BYTES < MIN_BYTES )); then
  echo "[$(date -Is)] ERROR: dump is only ${ACTUAL_BYTES} bytes — likely failed. Aborting." >&2
  exit 1
fi

echo "[$(date -Is)] Dump OK: $DUMP_FILE ($ACTUAL_BYTES bytes)"

# --- Off-site copy (optional, at most one of these should be set) ---
if [[ -n "$OFFSITE_RCLONE_REMOTE" ]] && command -v rclone >/dev/null 2>&1; then
  echo "[$(date -Is)] Copying to rclone remote: $OFFSITE_RCLONE_REMOTE"
  rclone copy "$DUMP_FILE" "$OFFSITE_RCLONE_REMOTE" --log-datestamp || \
    echo "[$(date -Is)] WARNING: rclone copy failed" >&2
elif [[ -n "$OFFSITE_SCP_TARGET" ]]; then
  echo "[$(date -Is)] Copying via scp to: $OFFSITE_SCP_TARGET"
  scp -q "$DUMP_FILE" "$OFFSITE_SCP_TARGET" || \
    echo "[$(date -Is)] WARNING: scp copy failed" >&2
fi

# --- Retention: delete local dumps older than RETENTION_DAYS ---
echo "[$(date -Is)] Pruning local dumps older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime "+$RETENTION_DAYS" -delete

echo "[$(date -Is)] Backup complete."
