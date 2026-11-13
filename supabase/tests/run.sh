#!/usr/bin/env bash
# psql-Tests gegen eine lokale Datenbank: führt alle supabase/tests/*.sql in
# alphabetischer Folge aus und bricht beim ersten Fehler ab.
#
#   supabase/tests/run.sh [DB-URL]
#
# Standard ist die lokale Supabase-DB. In der CI laufen die Tests im Job
# «Migrationen + Seed (Wegwerf-DB)» direkt nach `supabase start`.
# Nur lokale Ziele (Host 127.0.0.1 oder localhost): Die Tests legen Objekte
# an (rennen.sql sogar eine Extension) und sind nie für Staging oder Prod
# gedacht. Jede Datei ist für sich lauffähig und räumt im Normalfall hinter
# sich auf; was ein harter Abbruch zurücklassen kann, steht im Kopf der Datei.
set -euo pipefail

# Bytewise Reihenfolge des Globs, unabhängig von der Locale. psql bekommt die
# Zeichenkodierung ausdrücklich, weil die C-Locale sonst SQL_ASCII ergäbe.
export LC_ALL=C PGCLIENTENCODING=UTF8

DB_URL="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

abbruch() {
  echo "run.sh: $1" >&2
  exit 1
}

# Ziel prüfen, bevor irgendetwas sich verbindet. Nur URL-Form; ein host= in
# den Parametern ginge dem Host der URL vor und wird darum abgelehnt.
case "$DB_URL" in
  postgres://*|postgresql://*) ;;
  *) abbruch "Ziel muss eine postgresql://-URL sein." ;;
esac
case "$DB_URL" in
  *host=*|*hostaddr=*) abbruch "host=/hostaddr= in der URL ist nicht erlaubt." ;;
esac
REST="${DB_URL#*://}"
AUTORITAET="${REST%%[/?]*}"
HOST_PORT="${AUTORITAET##*@}"
HOST="${HOST_PORT%%:*}"
case "$HOST" in
  127.0.0.1|localhost) ;;
  *) abbruch "nur lokale Ziele (127.0.0.1 oder localhost) erlaubt, nicht «$HOST». Die Tests legen Objekte an und sind nie für Staging oder Prod gedacht." ;;
esac

command -v psql >/dev/null 2>&1 || abbruch "psql nicht gefunden (PostgreSQL-Client installieren oder in den PATH nehmen)."

shopt -s nullglob
DATEIEN=("$DIR"/*.sql)
[ ${#DATEIEN[@]} -gt 0 ] || abbruch "keine Testdateien in $DIR."

for DATEI in "${DATEIEN[@]}"; do
  NAME="$(basename "$DATEI")"
  echo "== $NAME"
  if ! psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$DATEI"; then
    echo "FEHLER in: $NAME" >&2
    exit 1
  fi
done
echo "Alle ${#DATEIEN[@]} psql-Tests grün."
