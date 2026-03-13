#!/bin/bash
# Nightly SQLite backup
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/familyhub}"
DB_PATH="${DB_PATH:-$(dirname "$0")/../data/familyhub.db}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y-%m-%d)
BACKUP_FILE="$BACKUP_DIR/familyhub-$TIMESTAMP.db"

sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

if [ $? -eq 0 ]; then
  echo "Backup successful: $BACKUP_FILE"
else
  echo "Backup FAILED" >&2
  exit 1
fi

# Cleanup backups older than 14 days
find "$BACKUP_DIR" -name "familyhub-*.db" -mtime +14 -delete
echo "Cleanup complete"
