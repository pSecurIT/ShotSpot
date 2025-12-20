#!/usr/bin/env bash
# Generate a schema-only baseline after applying all current migrations on a clean DB.
# Usage: ./backend/scripts/baseline-generate.sh
# Requires: pg_dump available, and DATABASE_URL pointing to a fully migrated clean DB.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Please export it to a clean, fully migrated database."
  exit 1
fi

TARGET_DIR="$(cd "$(dirname "$0")/../src/migrations/baseline" && pwd)"
TARGET_FILE="$TARGET_DIR/v0.1.0.sql"

mkdir -p "$TARGET_DIR"

echo "Generating schema-only baseline at $TARGET_FILE from $DATABASE_URL ..."
# Exclude ownership and privileges for portability
pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > "$TARGET_FILE"

echo "Baseline generated: $TARGET_FILE"
echo "Remember to commit the file and run setup scripts to verify fresh-install behavior."
