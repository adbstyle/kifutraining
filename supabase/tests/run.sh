#!/usr/bin/env bash
# psql-Tests gegen eine Datenbank: führt alle supabase/tests/*.sql in
# alphabetischer Folge aus und bricht beim ersten Fehler ab.
#
#   supabase/tests/run.sh [DB-URL]
#
# Standard ist die lokale Supabase-DB. In der CI laufen die Tests im Job
# «Migrationen + Seed (Wegwerf-DB)» direkt nach `supabase start`.
# Jede Testdatei ist für sich lauffähig und hinterlässt nichts.
set -euo pipefail

DB_URL="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

shopt -s nullglob
DATEIEN=("$DIR"/*.sql)
if [ ${#DATEIEN[@]} -eq 0 ]; then
  echo "Keine Testdateien in $DIR." >&2
  exit 1
fi

# Alphabetisch unabhängig von der Locale.
IFS=$'\n' SORTIERT=($(printf '%s\n' "${DATEIEN[@]}" | LC_ALL=C sort))
unset IFS

for DATEI in "${SORTIERT[@]}"; do
  NAME="$(basename "$DATEI")"
  echo "== $NAME"
  if ! psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$DATEI"; then
    echo "FEHLER in: $NAME" >&2
    exit 1
  fi
done
echo "Alle ${#SORTIERT[@]} psql-Tests grün."
