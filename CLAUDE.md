# CLAUDE.md

Projektsprache ist **Deutsch** — Code-Kommentare, Doku, Commit-Messages und Inhalte auf Deutsch halten.

## Überblick

Monorepo mit **zwei Teilprojekten**:

1. **Übungs-Datenbank** (Repo-Root, Python) — YAML pro Übung als kanonische Quelle, extrahiert aus dem SFV-Manual Kinderfussball. Generiert eine lesbare Markdown-Ansicht. Trainer-Übungen in der DB können zusätzlich im Juniorenschema zuhause sein (Epic #71); die YAML-Datenbank selbst bleibt der Kinderfussball-Bestand.
2. **Web-App** (`web/`, Next.js 15 + Supabase) — Trainings (einzelne Einheiten, SFV: „Trainingslektion") aus den Übungen zusammenstellen.

**Zwei Trainingsschemata** (Epic #71): Ein Training folgt genau einem — Kinderfussball (Stufen G/F/E; Auffangen, Einleitung, Hauptteil, Ausklang) oder Juniorenfussball (D/C/B/A; Einstieg, Hauptteil, Abschluss mit sechs Unterblöcken). Das Schema folgt aus den Alterskategorien, Mischen ist ausgeschlossen. Fachliche Quelle ist `web/lib/junioren.ts` mit dem SQL-Pendant in der Migration `junioren_schema`; die Abbildung zwischen den Schemata steht im abgenommenen Entscheidungsdokument `docs/superpowers/specs/2026-08-15-junioren-abbildungsregel.md`. Beim Schema-Wechsel merkt sich jede Fassung ihre verlassene Einordnung (`training_exercises.einordnung_vorher`), damit der Rückweg verlustfrei bleibt — der Wechsel ist der Migrationspfad für bestehende Trainings.

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

- **Lokale authed-Flows / E2E:** Auth ist E-Mail/Passwort, **kein geseedeter Test-User**. Bestätigten User via Admin-API anlegen (`$SR` = `SUPABASE_SERVICE_ROLE_KEY` aus `web/.env.local`): `curl -X POST http://127.0.0.1:54321/auth/v1/admin/users -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" -d '{"email":"e2e@test.local","password":"Test1234!","email_confirm":true}'`
- **Eine Vokabular-Quelle:** `data/vokabular.yaml` ist kanonisch. `web/lib/vocab.ts` ist **auto-generiert** (`npm run gen:vocab`) — **nie von Hand editieren** (wird überschrieben). Schema-Enums hängen an derselben Quelle.
- **Supabase ist server-only:** **keine `NEXT_PUBLIC_*`-Variablen.** DB-Credentials verlassen nie den Server. Client wird über `web/lib/supabase/server.ts` (request-gebunden) bzw. `admin.ts` (Seed) erzeugt — keinen Browser-Client einführen.
- **RLS + RPC:** Zugriffskontrolle via Row Level Security; mehrstufige Mutationen laufen über `SECURITY DEFINER`-RPCs (`supabase/migrations/*_rpc_functions.sql`) mit Owner-Check als erster Anweisung.
- **Styleguide-first UI:** Vor neuen UI-Komponenten am Styleguide/Kit (`web/app/styleguide`, `web/components/ui`) orientieren; Neues begründen und im Styleguide ergänzen.
- **Bilder** kommen aus Supabase Storage (öffentliche URLs); erlaubte Hosts stehen in `web/next.config.ts`. Trainer-Uploads werden **client-seitig** verkleinert (`web/lib/image-compress.ts`: browser-image-compression + heic-to → WebP ≤2000px) — keine serverseitige Bildverarbeitung einführen. Bild-Constraints sind Single Source in `web/lib/image.ts` (Client + Server); die Server Action validiert die gespeicherte Datei als Trust-Boundary (`storedImageError`).
- **Migrationen vs. Prod-Daten:** CI prüft Migrationen gegen eine **leere** Wegwerf-DB, Prod hat Daten. Eine Migration, die eine Invariante auf einer bestehenden Tabelle verschärft (neuer `NOT NULL`/`CHECK`), muss `NOT VALID` (+ spätere `VALIDATE`-Migration) nutzen oder vorher backfillen — sonst bricht `supabase db push` an Altzeilen.
- **Lifecycle-Modus:** Es gibt **echte User** (seit 2026-08) → **forward-only**: keine Prod-Resets, keine destruktiven Migrationen; Invarianten-Verschärfungen auf bestehenden Tabellen via `NOT VALID` (+ spätere `VALIDATE`-Migration) bzw. Backfill.
- **Node-Version:** Single Source ist `.nvmrc` (Node 22); Workflows binden sie via `node-version-file`. `@supabase/supabase-js` braucht Node ≥22 (natives WebSocket), sonst scheitert `npm run seed`.

## CI / Deploy

- **Branching-Modell:** Feature-Branch → PR auf `develop` (= Staging) → PR `develop` → `main` (= Prod). Deploys laufen ausschliesslich über CI, nie manuell.
- **Produktdokumentation bei jedem Prod-Release nachführen:** Was auf Produktion landet, muss in `docs/produkt/` beschrieben sein — Auslöser ist der Merge nach `main`. Neue Fähigkeiten kommen dazu, entfallene raus, geändertes Verhalten wird berichtigt, ebenso der Abschnitt „Bekannte Grenzen". Eine auf Prod sichtbare Änderung, die dort nicht steht, gilt als unfertig. Die Stories unter `docs/superpowers/specs/` sind dagegen **Aufträge**: umgesetzt = als erledigt markieren, nie nachkorrigieren; wo Story und Produktdoku auseinandergehen, gilt die Produktdoku, und wo Produktdoku und Anwendung auseinandergehen, gilt die Anwendung.
- **Ein Worktree pro Session:** Mehrteilige Aufträge (z. B. Diagramm-Runden) **nicht** im Haupt-Checkout ausführen, sondern in einem eigenen `git worktree`. Grund: teilen zwei Sessions dasselbe Arbeitsverzeichnis, verschiebt ein `reset`/`checkout` der einen den Branch der anderen — am 2026-08-17 ist so ein fertiger Commit vom Branch gefallen und erst am Prod-Seed aufgefallen (18 statt 19 Diagramme). Basis ist `develop`, nicht `main` (`worktree.baseRef: "head"` in `.claude/settings.local.json`, Haupt-Checkout vorher auf `develop`). Aufräumen: `git worktree remove <pfad>`, verwaiste Einträge `git worktree prune`.
- **Vercel** deployt die App automatisch per Git-Integration: `main` → Production (ki-fu.ch), `develop` → Preview mit fester Domain **staging.ki-fu.ch** (hinter Vercel Deployment Protection, Login nötig). Vercel-Env: Production-Scope = Prod-Supabase, Preview-Scope = Staging-Supabase (Feature-Branch-Previews können Prod nie anfassen); `APP_ORIGIN` ist im Preview-Scope branch-gescoped auf `develop`.
- **Staging-Supabase** ist ein separates Free-Projekt (Secrets `SUPABASE_STAGING_*`). Free-Projekte pausieren nach ~7 Tagen Inaktivität → vor dem Testen ggf. im Dashboard wecken. Auth-Konfig (Site URL, Redirect-Allowlist, E-Mail-Templates) wird von `db push` **nicht** übertragen — Änderungen daran in beiden Dashboards nachziehen.
- `.github/workflows/deploy.yml` macht **nur** `supabase db push` (Migrationen → Prod) bei Push auf `main`; `deploy-staging.yml` ist das Pendant für `develop` → Staging (jeweils nur wenn `supabase/migrations/**` sich ändert).
- `sync-staging.yml` ist **manuell** (`workflow_dispatch`, Bestätigung `sync`): spiegelt Prod-Daten nach Staging (inkl. `auth.users`; `bild_url`-Hosts werden umgeschrieben und geprüft, Storage-Dateien via `npm run sync:storage` kopiert). Überschreibt die Staging-**DB** komplett und alle gleichnamigen Storage-Dateien; verwaiste Staging-Storage-Dateien bleiben liegen. Die DB-URL-Secrets müssen **Session-Pooler**-URLs sein (Port 5432). Neue public-Tabelle? → `PUBLIC_TABLES` im Workflow nachführen (Guard bricht sonst ab).
- `seed-prod.yml` ist **manuell** (`workflow_dispatch`) — Manual-Daten werden nicht bei jedem Deploy geseedet. **Reihenfolge:** bringen die Daten etwas Neues mit, das der Code erst kennen muss (z. B. ein neuer Symbol-Typ im Diagramm), erst den Vercel-Deploy abwarten, dann seeden — sonst rendert das alte Bundle die unbekannten Elemente als „?"-Platzhalter (`FALLBACK_SYMBOL`).
- `pr-checks.yml`: `gen:vocab` + `typecheck`; Migrationen gegen eine Wegwerf-DB (`supabase start`); zusätzlich `npm run seed` gegen diese DB — prüft den Seed-Runtime (sonst bricht `seed-prod` erst im Ernstfall) **und** dass alle YAML-Daten sämtliche Constraints erfüllen.

## Wichtige Pfade

| Pfad | Zweck |
|------|-------|
| `data/uebungen/*.yaml` | kanonische Übungen |
| `data/themen/*.yaml`, `data/vokabular.yaml` | Themen-Metadaten, Vokabular (Single Source) |
| `schema/uebung.schema.json` | JSON-Schema der Übungen |
| `scripts/` | `extract.py`, `parser.py`, `validate.py`, `build_docs.py` |
| `supabase/migrations/` | DB-Schema + RPCs |
| `web/lib/supabase/` | server-only Clients (`server.ts`, `admin.ts`, `middleware.ts`) |
| `docs/superpowers/specs/` | Architektur-/Requirements-Specs (Aufträge) |
| `docs/produkt/` | Produktdokumentation — was die Anwendung kann (Ist-Zustand) |
