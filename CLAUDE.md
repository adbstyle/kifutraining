# CLAUDE.md

Projektsprache ist **Deutsch** — Code-Kommentare, Doku, Commit-Messages und Inhalte auf Deutsch halten.

## Überblick

Monorepo mit **zwei Teilprojekten**:

1. **Übungs-Datenbank** (Repo-Root, Python) — YAML pro Übung als kanonische Quelle, aus dem SFV-Manual Kinderfussball extrahiert. Generiert eine lesbare Markdown-Ansicht.
2. **Web-App** (`web/`, Next.js 15 + Supabase) — Trainingsplaner auf Basis der Übungen.

## Commands

### Übungs-Datenbank (Root)
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/validate.py     # YAML gegen schema/uebung.schema.json prüfen
.venv/bin/python scripts/build_docs.py   # docs/uebungen/*.md neu bauen
.venv/bin/pytest                         # Parser-/Schema-/Vokabular-Tests
```
Immer `.venv/bin/python` / `.venv/bin/pytest` explizit aufrufen (kein aktiviertes venv vorausgesetzt).

### Web-App (`web/`)
```bash
npm run db:start      # lokalen Supabase-Stack hochfahren (Migrationen + seed.sql laufen mit)
npm run gen:vocab     # web/lib/vocab.ts aus data/vokabular.yaml generieren
npm run gen:types     # lib/database.types.ts aus lokaler DB generieren
npm run dev           # Next.js Dev-Server
npm run typecheck     # tsc --noEmit (CI-Gate)
npm run seed          # Manual-Übungen idempotent in DB laden (nutzt SERVICE_ROLE_KEY, umgeht RLS)
```
Die `supabase`-CLI läuft aus `web/` heraus mit `--workdir ..` — die `supabase/config.toml` liegt im Repo-Root, nicht in `web/`.

## Architektur & Gotchas

- **Eine Vokabular-Quelle:** `data/vokabular.yaml` ist kanonisch. `web/lib/vocab.ts` ist **auto-generiert** (`npm run gen:vocab`) — **nie von Hand editieren** (wird überschrieben). Schema-Enums hängen an derselben Quelle.
- **Supabase ist server-only:** **keine `NEXT_PUBLIC_*`-Variablen.** DB-Credentials verlassen nie den Server. Client wird über `web/lib/supabase/server.ts` (request-gebunden) bzw. `admin.ts` (Seed) erzeugt — keinen Browser-Client einführen.
- **RLS + RPC:** Zugriffskontrolle via Row Level Security; mehrstufige Mutationen laufen über `SECURITY DEFINER`-RPCs (`supabase/migrations/*_rpc_functions.sql`) mit Owner-Check als erster Anweisung.
- **Styleguide-first UI:** Vor neuen UI-Komponenten am Styleguide/Kit (`web/app/styleguide`, `web/components/ui`) orientieren; Neues begründen und im Styleguide ergänzen.
- **Bilder** kommen aus Supabase Storage (öffentliche URLs); erlaubte Hosts stehen in `web/next.config.ts`.

## CI / Deploy

- **Vercel** deployt die App automatisch bei Push auf `main` (Git-Integration).
- `.github/workflows/deploy.yml` macht **nur** `supabase db push` (Migrationen → Prod), und nur wenn `supabase/migrations/**` sich ändert.
- `seed-prod.yml` ist **manuell** (`workflow_dispatch`) — Manual-Daten werden nicht bei jedem Deploy geseedet.
- `pr-checks.yml`: `gen:vocab` + `typecheck`, und Migrationen gegen eine Wegwerf-DB (`supabase start`).

## Wichtige Pfade

| Pfad | Zweck |
|------|-------|
| `data/uebungen/*.yaml` | kanonische Übungen |
| `data/themen/*.yaml`, `data/vokabular.yaml` | Themen-Metadaten, Vokabular (Single Source) |
| `schema/uebung.schema.json` | JSON-Schema der Übungen |
| `scripts/` | `extract.py`, `parser.py`, `validate.py`, `build_docs.py` |
| `supabase/migrations/` | DB-Schema + RPCs |
| `web/lib/supabase/` | server-only Clients (`server.ts`, `admin.ts`, `middleware.ts`) |
| `docs/superpowers/specs/` | Architektur-/Requirements-Specs |
