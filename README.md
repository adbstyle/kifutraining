# kifutraining

Trainingsplaner für den Kinderfussball auf Basis einer Übungs-Datenbank, die aus
dem SFV-Manual Kinderfussball extrahiert wurde.

Das Repo ist ein **Monorepo mit zwei Teilprojekten**:

1. **Übungs-Datenbank** (Repo-Root, Python) – eine YAML pro Übung als kanonische
   Quelle. Wird gegen ein JSON-Schema validiert und zu einer lesbaren
   Markdown-Ansicht gebaut.
2. **Web-App** (`web/`, Next.js 15 + Supabase) – Trainingsplaner, der auf den
   Übungen aufsetzt.

## Struktur

| Pfad | Zweck |
|------|-------|
| `data/uebungen/` | eine YAML pro Übung (kanonische Quelle) |
| `data/themen/`, `data/vokabular.yaml` | Themen-Metadaten, Vokabular (Single Source) |
| `schema/uebung.schema.json` | JSON-Schema der Übungen |
| `scripts/` | `extract.py`, `parser.py`, `validate.py`, `build_docs.py` |
| `docs/` | generierte Markdown-Ansicht ([Index](docs/README.md)) + Specs |
| `images/` | Feld-Diagramme (PNG) |
| `sources/` | Original-PDFs/PPTX |
| `supabase/migrations/` | DB-Schema + RPCs |
| `web/` | Next.js-App (server-only Supabase-Clients in `web/lib/supabase/`) |

## Übungs-Datenbank (Root)

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/validate.py     # YAML gegen Schema prüfen
.venv/bin/python scripts/build_docs.py   # docs/uebungen/*.md neu bauen
.venv/bin/pytest                         # Parser-/Schema-/Vokabular-Tests
```

Immer `.venv/bin/python` / `.venv/bin/pytest` explizit aufrufen (kein aktiviertes
venv vorausgesetzt).

## Web-App (`web/`)

```bash
npm run db:start      # lokalen Supabase-Stack hochfahren (Migrationen + seed.sql)
npm run gen:vocab     # web/lib/vocab.ts aus data/vokabular.yaml generieren
npm run gen:types     # lib/database.types.ts aus lokaler DB generieren
npm run dev           # Next.js Dev-Server
npm run typecheck     # tsc --noEmit (CI-Gate)
npm run seed          # Manual-Übungen idempotent in DB laden
```

Die `supabase`-CLI läuft aus `web/` heraus mit `--workdir ..` – die
`supabase/config.toml` liegt im Repo-Root, nicht in `web/`.

## Wichtige Konventionen

- **Eine Vokabular-Quelle:** `data/vokabular.yaml` ist kanonisch. `web/lib/vocab.ts`
  ist **auto-generiert** (`npm run gen:vocab`) – nie von Hand editieren.
- **Supabase ist server-only:** keine `NEXT_PUBLIC_*`-Variablen; DB-Credentials
  verlassen nie den Server.
- **RLS + RPC:** Zugriffskontrolle via Row Level Security; mehrstufige Mutationen
  über `SECURITY DEFINER`-RPCs mit Owner-Check.
- **Styleguide-first UI:** vor neuen Komponenten an `web/app/styleguide` /
  `web/components/ui` orientieren.

## CI / Deploy

- **Vercel** deployt die App automatisch bei Push auf `main`.
- `deploy.yml` macht nur `supabase db push` (Migrationen → Prod), wenn sich
  `supabase/migrations/**` ändert.
- `seed-prod.yml` ist manuell (`workflow_dispatch`).
- `pr-checks.yml`: `gen:vocab` + `typecheck` und Migrationen gegen eine
  Wegwerf-DB.

Projektsprache ist **Deutsch** – Code-Kommentare, Doku und Commit-Messages auf
Deutsch halten.
