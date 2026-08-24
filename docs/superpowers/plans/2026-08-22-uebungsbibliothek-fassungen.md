# Übungsbibliothek-Epic (#72) — Implementationsplan «Fassungen»

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trainings enthalten eigenständige, anpassbare Fassungen statt Verweise auf Bibliotheks-Übungen — umgesetzt gemäss den 9 refinten Stories (`docs/superpowers/specs/2026-08-16-uebungsbibliothek-stories.md`) und dem abgenommenen Spike (`docs/superpowers/specs/2026-08-22-uebungsbibliothek-fassung-spike.md`).

**Architecture:** Die Zuordnung `training_exercises` wird zur Fassung (trägt alle Übungsfelder + unveränderlichen Herkunfts-Stempel); der FK `exercise_id` entfällt am Ende. Bildkopien laufen byte-identisch per Storage-Copy mit dem nutzergebundenen Server-Client (experimentell verifiziert). Der Bestand wird vierschrittig überführt: Bild-Kopierskript → atomare Feld-Migration → maschineller Nachweis → Verweis-Abbau.

**Tech Stack:** Next.js 15 (Server Actions, server-only Supabase-Clients), Supabase Postgres + Storage (RLS), YAML/JSON-Schema + pytest (Übungsdatenbank), tsx-Skripte (Seed-Werkzeugklasse).

## Global Constraints

- Projektsprache Deutsch — Code-Kommentare, Doku, Commit-Messages (CLAUDE.md).
- **Forward-only:** keine Prod-Resets, keine destruktiven Migrationen; Verschärfungen nur nach nachweislicher Bereinigung (Epic-NFR 4) bzw. `NOT VALID` + `VALIDATE`.
- **Keine `NEXT_PUBLIC_*`-Variablen;** Supabase nur über `web/lib/supabase/server.ts` (request-gebunden) bzw. `admin.ts` (Skripte).
- **Keine serverseitige Bildverarbeitung** (CLAUDE.md + Epic-NFR 2) — Bildkopien ausschliesslich byte-identisch per Storage-Copy.
- `web/lib/vocab.ts` ist auto-generiert — nie von Hand editieren.
- Immer `.venv/bin/python` / `.venv/bin/pytest` explizit; supabase-CLI aus `web/` mit `--workdir ..`.
- Deploys nur über CI (PR → develop → main); `seed-prod.yml`/`seed-staging.yml` sind manuell.
- Styleguide-first: neue UI-Bausteine im Styleguide (`web/app/styleguide`) ergänzen.
- Commit pro abgeschlossenem Task; nach jeder Story End-to-End über den echten App-Pfad verifizieren.
- Nutzersichtbare Begriffe: Fassung heisst «Übung», Bibliothekseintrag heisst «Vorlage», Herkunft sagt «basiert auf …», Quellbezeichnung «KiFu-Manual».

## Verbindliche Entwurfs-Entscheide (aus Spike + Refinement abgeleitet)

1. **Beschreibung = bestehende Spalte `aufbau`.** Die Kategorie «Fussball spielen» nutzt `aufbau` (alle Render-Pfade fallen bereits darauf zurück); nur das UI-Label lautet dort «Beschreibung des Spiels». Kein neues Feld.
2. **Fassungs-Spalten auf `training_exercises`:** `name, kategorien, erscheinungsform, feldtyp, anzahl_kinder, material, methodischer_fahrplan, aufbau, varianten, bild_url, bild_quelle, diagramm` + `herkunft_name, herkunft_typ, herkunft_datum` (`trainingsteil`, `hauptteilkategorie`, `position`, `duration_min` existieren).
3. **Herkunft auf `exercises`:** `herkunft_name/typ/datum` (übernommene Vorlagen, Story 7) und `diagramm_herkunft_name/typ/datum` (Diagramm-Kopien, Story 6).
4. **Herkunftstyp-Ableitung:** Quelle `source='manual'` → `manual`; `owner_id` = handelnder User → `eigen`; sonst → `community`. Trägt die Quelle selbst schon eine Herkunft, werden deren drei Felder **unverändert weiterkopiert** (Kettenwurzel).
5. **Fassungs-Vollständigkeit ist App-Regel, kein CHECK** — überführte inhaltsleere Fassungen bleiben zulässig (Story 9 AK 5); geprüft wird beim Bearbeiten (Server Action) und bleibt beim Veröffentlichen die bestehende Trainings-Regel.
6. **Fassungs-Bildpfad:** `user/<trainings-owner>/<training_exercise_id>.<ext>` — kollisionsfrei zu Übungsbildern (`<exercise_id>.<ext>`).
7. **Fassungs-Routen:** `/training/[id]/uebung/[teId]/edit` (Formular) und `/training/[id]/uebung/[teId]/diagramm` (Diagramm-Editor am Training).
8. **Rollout in drei PRs:** PR 1 = Teil A (Story 2, eigenständig releasebar). PR 2 = Teil B ohne Verweis-Abbau (Stories 3–9, ein Release; Bild-Kopierskript läuft VOR dem Merge). PR 3 = Verweis-Abbau + Code-Bereinigung, erst nach grünem Nachweis in Prod (Story 9 AK 7).

---

# Teil A — Story 2: Fahrplan-Regel je Hauptteilkategorie (PR 1)

### Task A1: YAML-Schema + Manual-Bereinigung (Übungsdatenbank, Python-TDD)

**Files:**
- Modify: `schema/uebung.schema.json` (allOf-Block, Zeilen 61–82)
- Modify: `data/uebungen/fussball-spielen-auf-klein-und-grossfeld-kleinfeld-und-grossfeld.yaml`
- Test: `tests/test_schema.py`

**Interfaces:**
- Produces: Schema-Regel «`hauptteilkategorie: fussball-spielen` ⇒ `aufbau` Pflicht, `methodischer_fahrplan` verboten»; bereinigte Manual-YAML ohne Fahrplan. Teil B verlässt sich darauf, dass `.venv/bin/python scripts/validate.py` diese Regel für alle 75 Übungen grün prüft.

- [ ] **Step 1: Failing Tests schreiben** — in `tests/test_schema.py` (bestehenden `_hauptteil_doc()`-Builder wiederverwenden; er setzt bisher keinen kategorie-spezifischen Fall):

```python
def test_fussball_spielen_braucht_aufbau_statt_fahrplan(validator):
    doc = _hauptteil_doc()
    doc["hauptteilkategorie"] = "fussball-spielen"
    doc.pop("methodischer_fahrplan", None)
    doc["aufbau"] = "Die Kinder spielen frei."
    assert list(validator.iter_errors(doc)) == []

def test_fussball_spielen_lehnt_fahrplan_ab(validator):
    doc = _hauptteil_doc()
    doc["hauptteilkategorie"] = "fussball-spielen"
    doc["methodischer_fahrplan"] = {"offen_starten": "x"}
    doc["aufbau"] = "Die Kinder spielen frei."
    assert list(validator.iter_errors(doc)) != []

def test_fussball_spielen_ohne_aufbau_unvollstaendig(validator):
    doc = _hauptteil_doc()
    doc["hauptteilkategorie"] = "fussball-spielen"
    doc.pop("methodischer_fahrplan", None)
    assert list(validator.iter_errors(doc)) != []

def test_andere_hauptteilkategorien_brauchen_fahrplan(validator):
    doc = _hauptteil_doc()
    doc["hauptteilkategorie"] = "fussball-spielen-lernen"
    doc.pop("methodischer_fahrplan", None)
    assert list(validator.iter_errors(doc)) != []
```

(Falls die Datei keinen `validator`-Fixture-Namen nutzt, das dortige Muster übernehmen — die vier Fälle bleiben identisch.)

- [ ] **Step 2: Tests laufen lassen, Scheitern verifizieren** — Run: `.venv/bin/pytest tests/test_schema.py -q` — Expected: die neuen Tests FAIL (Schema kennt die Ausnahme noch nicht).

- [ ] **Step 3: Schema anpassen** — in `schema/uebung.schema.json` den ersten `allOf`-Zweig ersetzen durch:

```json
{
  "$comment": "Ablauf-Form je Einordnung (Epic #72 Story 2): «Fussball spielen» trägt eine Beschreibung im Feld aufbau statt eines Fahrplans.",
  "if": {
    "properties": { "trainingsteil": { "enum": ["einleitung", "hauptteil"] } },
    "not": { "properties": { "hauptteilkategorie": { "const": "fussball-spielen" } } }
  },
  "then": { "required": ["methodischer_fahrplan"] }
},
{
  "if": {
    "properties": { "hauptteilkategorie": { "const": "fussball-spielen" } },
    "required": ["hauptteilkategorie"]
  },
  "then": {
    "required": ["aufbau"],
    "properties": { "aufbau": { "type": "string", "minLength": 1 } },
    "not": { "required": ["methodischer_fahrplan"] }
  }
},
```

Der zweite bestehende Zweig (auffangen/ausklang → `aufbau`) und der Hauptteilkategorie-Biconditional bleiben unverändert. Zusätzlich in `properties.aufbau` `"minLength": 1` setzen (Vollständigkeit = nicht leer, PO-Entscheid).

- [ ] **Step 4: Manual-Übung bereinigen** — in `data/uebungen/fussball-spielen-auf-klein-und-grossfeld-kleinfeld-und-grossfeld.yaml` den Block `methodischer_fahrplan:` (Zeilen 16–23) vollständig ersetzen durch:

```yaml
aufbau: Die Kinder spielen auf dem Kleinfeld 1:1 bis 4:4, je nach Anzahl Kinder.
  Auf dem Grossfeld spielen sie auf die grossen Tore maximal 6:6 (inklusive Torspieler/in);
  die maximale Anzahl Kinder im Grossfeld richtet sich nach dem Wettspielformat der
  jeweiligen Kategorie.
```

(Fortlaufender, lesbarer Text — PO-Entscheid 2026-08-22; ersetzt den Parser-verschmolzenen Text mit «len»-Artefakt.)

- [ ] **Step 5: Grün verifizieren** — Run: `.venv/bin/pytest -q && .venv/bin/python scripts/validate.py && .venv/bin/python scripts/build_docs.py` — Expected: alle Tests PASS, Validierung grün (75/75), Doku regeneriert.

- [ ] **Step 6: Commit**

```bash
git add schema/uebung.schema.json data/uebungen/fussball-spielen-auf-klein-und-grossfeld-kleinfeld-und-grossfeld.yaml tests/test_schema.py docs/uebungen
git commit -m "feat(uebungen): Fahrplan-Regel je Hauptteilkategorie — «Fussball spielen» trägt Beschreibung (Story 2)"
```

### Task A2: DB-Migration — Backfill + Constraints je Hauptteilkategorie

**Files:**
- Create: `supabase/migrations/<timestamp>_fahrplan_regel_hauptteilkategorie.sql`

**Interfaces:**
- Consumes: bestehende Constraints `ablauf_je_trainingsteil`, `user_fahrplan_vollstaendig` (`20260601070000_init_schema.sql:47-66`).
- Produces: Constraints `ablauf_je_einordnung` und `fahrplan_vollstaendig` (gelten für ALLE Quellen); alle Bestandszeilen erfüllen sie. Teil B übernimmt exakt diese Regeln als App-Validierung für Fassungen.

- [ ] **Step 1: Migration schreiben** (`npx supabase migration new fahrplan_regel_hauptteilkategorie --workdir ..` aus `web/`, dann Inhalt):

```sql
-- Story 2 (Epic #72): Vollständigkeitsregel je Hauptteilkategorie.
-- «Fussball spielen» trägt eine Beschreibung (Spalte aufbau) statt des Fahrplans.
-- Reihenfolge (Epic-NFR 4): ERST Bestand bereinigen, DANN Regel verschärfen —
-- atomar in dieser einen Migration.

-- 1) Backfill: alle «Fussball spielen»-Zeilen (Manual + Trainer) ziehen ihren
--    Ablauftext um. PO-Entscheid: befüllte Stufen in Reihenfolge als getrennte
--    Absätze, ohne Textverlust, ohne redaktionelle Eingriffe.
update exercises
set aufbau = nullif(btrim(concat_ws(E'\n\n',
      nullif(btrim(methodischer_fahrplan->>'offen_starten'), ''),
      nullif(btrim((select string_agg(v, E'\n\n')
                    from jsonb_array_elements_text(
                      coalesce(methodischer_fahrplan->'ueben','[]'::jsonb)) as t(v))), ''),
      nullif(btrim(methodischer_fahrplan->>'wetteifern'), ''))), ''),
    methodischer_fahrplan = null
where hauptteilkategorie = 'fussball-spielen'
  and methodischer_fahrplan is not null;

-- 2) Ablauf-Form je Einordnung (ersetzt ablauf_je_trainingsteil).
alter table exercises drop constraint ablauf_je_trainingsteil;
alter table exercises add constraint ablauf_je_einordnung check (
  case
    when hauptteilkategorie = 'fussball-spielen'
      then coalesce(btrim(aufbau), '') <> '' and methodischer_fahrplan is null
    when trainingsteil in ('einleitung','hauptteil')
      then methodischer_fahrplan is not null
    else coalesce(btrim(aufbau), '') <> ''
  end
);

-- 3) Fahrplan-Vollständigkeit gilt neu für ALLE Quellen (der Bestand erfüllt
--    sie: 74 Manual-Übungen vollständig, die eine Ausnahme ist umgezogen).
alter table exercises drop constraint user_fahrplan_vollstaendig;
alter table exercises add constraint fahrplan_vollstaendig check (
  trainingsteil not in ('einleitung','hauptteil')
  or hauptteilkategorie = 'fussball-spielen'
  or (
    coalesce(methodischer_fahrplan->>'offen_starten','') <> ''
    and jsonb_typeof(methodischer_fahrplan->'ueben') = 'array'
    and jsonb_array_length(methodischer_fahrplan->'ueben') >= 1
    and coalesce(methodischer_fahrplan->>'wetteifern','') <> ''
  )
);
```

- [ ] **Step 2: Lokal verifizieren** — Run aus `web/`: `npm run db:reset && npm run seed && npm run gen:types` — Expected: Migrationen + Seed grün (der Seed schreibt die bereinigte YAML; der neue CHECK akzeptiert sie). Danach `npm run typecheck`.

- [ ] **Step 3: Nachweis-Query (Story-2-PC 3 lokal)** — Run: `psql "$(npx supabase status --workdir .. -o env | grep DB_URL | cut -d= -f2-)" -c "select count(*) from exercises where hauptteilkategorie='fussball-spielen' and (methodischer_fahrplan is not null or coalesce(btrim(aufbau),'')='');"` — Expected: `0`. (Der dauerhafte Nachweis ist das Seed-Gate in `pr-checks.yml`, das jetzt gegen die neuen Constraints läuft.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): Ablauf-Regel je Hauptteilkategorie — Backfill + Constraints für alle Quellen (Story 2)"
```

### Task A3: Web-App — Erfassung, Anzeige, Suche

**Files:**
- Modify: `web/lib/labels.ts`
- Modify: `web/lib/actions/exercises.ts` (`parseExercise`, Zeilen 69–97)
- Modify: `web/components/exercise/ExerciseForm.tsx` (Fahrplan-/Aufbau-Weiche + Kategoriewechsel-Prefill)
- Verify only: `web/app/uebung/[slug]/page.tsx`, `web/components/training/TrainingExerciseDetail.tsx` (Aufbau-Fallback existiert), Such-Trigger (`aufbau` ist bereits im `search_text`)

**Interfaces:**
- Produces: `brauchtFahrplan(teil, hkat)` in `web/lib/labels.ts` — die eine Weiche für Formular UND Validierung. Signatur: `(trainingsteil: string, hauptteilkategorie: string | null) => boolean`. Teil B nutzt sie für die Fassungs-Validierung wieder.

- [ ] **Step 1: Weiche einführen** — in `web/lib/labels.ts` ergänzen:

```ts
/** Braucht diese Einordnung den methodischen Fahrplan? «Fussball spielen»
 *  trägt stattdessen eine Beschreibung im Feld aufbau (Epic #72, Story 2). */
export function brauchtFahrplan(
  trainingsteil: string,
  hauptteilkategorie: string | null,
): boolean {
  return (
    FAHRPLAN_TEILE.has(trainingsteil) && hauptteilkategorie !== "fussball-spielen"
  );
}
```

- [ ] **Step 2: `parseExercise` umbauen** — in `web/lib/actions/exercises.ts`: `hauptteilkategorie` VOR der Ablauf-Validierung parsen (Block Zeilen 92–97 nach oben ziehen), dann die Weiche ersetzen:

```ts
const istFahrplan = brauchtFahrplan(trainingsteil, hauptteilkategorie);
let methodischer_fahrplan: Record<string, unknown> | null = null;
let aufbau: string | null = null;

if (istFahrplan) {
  // ... bestehender Fahrplan-Block unverändert ...
} else if (trainingsteil) {
  aufbau = clean(form.get("aufbau"));
  if (!aufbau)
    errors.aufbau =
      hauptteilkategorie === "fussball-spielen"
        ? "Bitte das Spiel beschreiben."
        : "Bitte den Aufbau beschreiben.";
}
```

`erscheinungsform` weiterhin an `FAHRPLAN_TEILE.has(trainingsteil)` binden (bestehende DB-Regel: erlaubt bei Einleitung/Hauptteil, auch «Fussball spielen»).

- [ ] **Step 3: Formular umbauen** — in `web/components/exercise/ExerciseForm.tsx`: die Anzeige-Weiche `istFahrplan` von `FAHRPLAN_TEILE.has(teil)` auf `brauchtFahrplan(teil, hkat)` umstellen (der Hauptteilkategorie-Select muss dafür kontrollierter State sein bzw. sein `onChange` die Weiche treiben). Label des Textfelds bei `hkat === "fussball-spielen"`: «Beschreibung des Spiels». **Kategoriewechsel-Prefill (Story 2 AK 3):** beim Umschalten der Weiche den bisherigen Text als Ausgangstext übernehmen:

```ts
/** Fahrplan-Stufen -> ein Text: befüllte Teile in Reihenfolge als Absätze. */
function fahrplanZuText(offen: string, ueben: string, wett: string): string {
  return [offen, ueben, wett].map((s) => s.trim()).filter(Boolean).join("\n\n");
}
```

Wechsel Fahrplan→Beschreibung: `aufbau`-Feld mit `fahrplanZuText(...)` aus den aktuellen Feldwerten vorbefüllen. Wechsel Beschreibung→Fahrplan: `offen_starten` mit dem bisherigen Text vorbefüllen, `ueben`/`wetteifern` leer (Nutzer redigiert, Speichern verlangt Vollständigkeit).

- [ ] **Step 4: Typecheck + Anzeige-Verifikation** — Run: `npm run typecheck`; dann `preview_start` (Dev-Server) und prüfen: Manual-Übung «Kleinfeld und Grossfeld» zeigt die Beschreibung (Aufbau-Fallback greift, kein «① Offen starten»-Label mehr); Katalogsuche nach «Wettspielformat» findet sie (der Such-Trigger indexiert `aufbau` bereits — keine Code-Änderung, nur verifizieren).

- [ ] **Step 5: E2E (echter App-Pfad, lokal als e2e@test.local)** — (a) Neue Übung Hauptteil/«Fussball spielen» anlegen: nur Beschreibungsfeld sichtbar, leer speichern wird abgelehnt, mit Text gespeichert. (b) Kategorie im Formular auf «Fussball spielen lernen» wechseln: Text steht als Ausgangstext in «Offen starten», Speichern verlangt alle drei Stufen. (c) Bestehende Trainer-Übung der Kategorie öffnen: zusammengeführte Absätze stehen im Beschreibungsfeld.

- [ ] **Step 6: Commit**

```bash
git add web/lib/labels.ts web/lib/actions/exercises.ts web/components/exercise/ExerciseForm.tsx web/lib/database.types.ts
git commit -m "feat(uebungen): Beschreibung statt Fahrplan bei «Fussball spielen» — Formular, Validierung, Prefill (Story 2)"
```

### Task A4: PR 1 + Ausrollen (Runbook)

- [ ] **Step 1:** Push + PR auf `develop` («feat(bibliothek): Story 2 — Fahrplan-Regel je Hauptteilkategorie»). `pr-checks.yml` ist das Gate (gen:vocab, typecheck, Migrationen + Seed gegen Wegwerf-DB).
- [ ] **Step 2:** Nach Merge: `deploy-staging.yml` pusht die Migration; danach **`seed-staging.yml` manuell auslösen** (bereinigter Manual-Text nach Staging) und auf staging.ki-fu.ch die Punkte aus A3/Step 5 stichprobenartig prüfen.
- [ ] **Step 3:** PR `develop` → `main`; nach Merge **`seed-prod.yml` manuell auslösen** (Manual-Bereinigung erreicht Prod erst dadurch — die Migration hat den Alt-Text nur strukturell umgezogen).

---

# Teil B — Stories 3–9: Fassungs-Modell (PR 2, ein Release)

Neuer Branch nach Merge von PR 1. Reihenfolge der Tasks = Abhängigkeitsreihenfolge; nach jedem Task committen.

### Task B1: Migration — Fassungs-Spalten, Herkunft, Trigger (Story 3, Datenmodell)

**Files:**
- Create: `supabase/migrations/<timestamp>_fassungen_datenmodell.sql`

**Interfaces:**
- Produces: Spalten gemäss Entwurfs-Entscheid 2/3; Trigger `herkunft_unveraenderlich` (beide Tabellen); `training_exercise_phase_guard` ohne Gleichheits-Zwang; validierter Constraint `training_ex_hkat_genau_bei_hauptteil`. Alle Folge-Tasks lesen/schreiben diese Spalten.

- [ ] **Step 1: Migration schreiben:**

```sql
-- Story 3 (Epic #72): Zuordnung = Fassung. training_exercises trägt die
-- Übungsinhalte selbst; Herkunfts-Stempel unveränderlich; Einordnung frei.

-- 1) Fassungs-Inhaltsfelder (nullable: Bestand wird in der Überführungs-
--    Migration befüllt; bis dahin liest die App weiter über den Join).
alter table training_exercises
  add column name text,
  add column kategorien text[] not null default '{}',
  add column erscheinungsform text[] not null default '{}',
  add column feldtyp text check (feldtyp in ('kleinfeld','grossfeld','freies_feld')),
  add column anzahl_kinder jsonb,
  add column material text[] not null default '{}',
  add column methodischer_fahrplan jsonb,
  add column aufbau text,
  add column varianten text[] not null default '{}',
  add column bild_url text,
  add column bild_quelle text check (bild_quelle in ('foto','diagramm')),
  add column diagramm jsonb,
  add column herkunft_name text,
  add column herkunft_typ text check (herkunft_typ in ('manual','community','eigen')),
  add column herkunft_datum timestamptz;

-- 2) Herkunft für übernommene Vorlagen + Diagramm-Kopien (Stories 6/7).
alter table exercises
  add column herkunft_name text,
  add column herkunft_typ text check (herkunft_typ in ('manual','community','eigen')),
  add column herkunft_datum timestamptz,
  add column diagramm_herkunft_name text,
  add column diagramm_herkunft_typ text check (diagramm_herkunft_typ in ('manual','community','eigen')),
  add column diagramm_herkunft_datum timestamptz;

-- 3) Unveränderlichkeit: nur echte Wertänderungen an gesetzten Herkunftsfeldern
--    abweisen (IS DISTINCT FROM; das erstmalige Setzen von NULL aus bleibt
--    erlaubt — Überführung und Diagramm-Kopie stempeln nachträglich).
create or replace function herkunft_unveraenderlich() returns trigger
language plpgsql as $$
begin
  if old.herkunft_datum is not null and (
       new.herkunft_name  is distinct from old.herkunft_name
    or new.herkunft_typ   is distinct from old.herkunft_typ
    or new.herkunft_datum is distinct from old.herkunft_datum
  ) then
    raise exception 'Herkunftsangabe ist unveränderlich';
  end if;
  return new;
end;
$$;
create trigger te_herkunft_unveraenderlich before update on training_exercises
  for each row execute function herkunft_unveraenderlich();
create trigger ex_herkunft_unveraenderlich before update on exercises
  for each row execute function herkunft_unveraenderlich();

-- Diagramm-Herkunft analog (eigene Funktion, weil andere Spaltennamen).
create or replace function diagramm_herkunft_unveraenderlich() returns trigger
language plpgsql as $$
begin
  if old.diagramm_herkunft_datum is not null and (
       new.diagramm_herkunft_name  is distinct from old.diagramm_herkunft_name
    or new.diagramm_herkunft_typ   is distinct from old.diagramm_herkunft_typ
    or new.diagramm_herkunft_datum is distinct from old.diagramm_herkunft_datum
  ) then
    raise exception 'Diagramm-Herkunft ist unveränderlich';
  end if;
  return new;
end;
$$;
create trigger ex_diagramm_herkunft_unveraenderlich before update on exercises
  for each row execute function diagramm_herkunft_unveraenderlich();

-- 4) Freie Einordnung (Story 3 AK 10): Gleichheits-Zwang und Kategorie-Snapshot
--    aus dem Guard entfernen; nur die Invariante «Kategorie genau bei Hauptteil»
--    bleibt (Zwangs-NULL ausserhalb des Hauptteils).
create or replace function training_exercise_phase_guard() returns trigger
language plpgsql as $$
begin
  if new.trainingsteil <> 'hauptteil' then
    new.hauptteilkategorie := null;
  end if;
  return new;
end;
$$;

-- 5) Technischen Schuldenposten schliessen (Story 3 AK 9): der Alt-Constraint
--    war seit Anlage NOT VALID; der Bestand erfüllt ihn (Trigger erzwang ihn).
alter table training_exercises validate constraint training_ex_hkat_genau_bei_hauptteil;
```

- [ ] **Step 2: Lokal verifizieren** — Run aus `web/`: `npm run db:reset && npm run seed && npm run gen:types && npm run typecheck` — Expected: grün; Seed erzeugt keine Fassungen (schreibt nur `exercises` — Story 3 AK 14 by design).
- [ ] **Step 3: Immutabilität von Hand prüfen** — per SQL: Fassungs-Zeile mit `herkunft_datum` setzen, dann `update ... set herkunft_name='x'` → Expected: `Herkunftsangabe ist unveränderlich`. Update mit identischen Werten → Expected: OK (IS DISTINCT FROM).
- [ ] **Step 4: Commit** — `git add supabase/migrations web/lib/database.types.ts && git commit -m "feat(db): Fassungs-Datenmodell — Inhalts- und Herkunfts-Spalten, Immutabilität, freie Einordnung (Story 3)"`

### Task B2: Erzeugungs-Mechanismus `uebernehmeUebung` (Story 3 AK 3 + Story 4 Server-Seite)

**Files:**
- Create: `web/lib/fassung.ts`
- Modify: `web/lib/actions/trainings.ts` (ersetzt `addTrainingExercise`-Innenleben)

**Interfaces:**
- Consumes: `kopiereDiagramm` (`web/lib/diagramm.ts`), `STORAGE_BUCKET`/`bildUrlToPath` (`web/lib/storage.ts`), `brauchtFahrplan` (Teil A).
- Produces: `stempleHerkunft(quelle, userId): {herkunft_name, herkunft_typ, herkunft_datum}` in `web/lib/fassung.ts`; Server Action `addTrainingExercise(trainingId, trainingsteil, exerciseId, hauptteilkategorie?)` behält ihre Signatur (Aufrufer im Picker bleiben unverändert), erzeugt aber eine vollständige Fassung.

- [ ] **Step 1: Herkunfts-Helfer** — `web/lib/fassung.ts`:

```ts
export type Herkunft = {
  herkunft_name: string;
  herkunft_typ: "manual" | "community" | "eigen";
  herkunft_datum: string;
};

/** Herkunft stempeln (Spike Gate 2): trägt die Quelle selbst eine Herkunft,
 *  wird sie unverändert weiterkopiert (Kettenwurzel); sonst neu ableiten. */
export function stempleHerkunft(
  quelle: {
    name: string;
    source: "manual" | "user";
    owner_id: string | null;
    herkunft_name?: string | null;
    herkunft_typ?: "manual" | "community" | "eigen" | null;
    herkunft_datum?: string | null;
  },
  userId: string,
): Herkunft {
  if (quelle.herkunft_datum && quelle.herkunft_name && quelle.herkunft_typ) {
    return {
      herkunft_name: quelle.herkunft_name,
      herkunft_typ: quelle.herkunft_typ,
      herkunft_datum: quelle.herkunft_datum,
    };
  }
  return {
    herkunft_name: quelle.name,
    herkunft_typ:
      quelle.source === "manual" ? "manual" : quelle.owner_id === userId ? "eigen" : "community",
    herkunft_datum: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: `addTrainingExercise` zur Fassungs-Erzeugung umbauen** — in `web/lib/actions/trainings.ts`: Übungs-Select auf alle Inhaltsfelder erweitern (`id, name, trainingsteil, hauptteilkategorie, kategorien, erscheinungsform, feldtyp, anzahl_kinder, material, methodischer_fahrplan, aufbau, varianten, bild_url, bild_quelle, diagramm, source, owner_id, herkunft_name, herkunft_typ, herkunft_datum`). Danach statt des bisherigen Inserts:

```ts
// Fassung erzeugen (Spike Gate 4): teId vorab, Bild VOR dem Insert byte-
// identisch kopieren (deterministischer Zielname — ein Fehlschlag des Inserts
// hinterlässt höchstens eine folgenlose, überschreibbare Datei).
const teId = crypto.randomUUID();
let bildUrl: string | null = null;
if (ex.bild_url) {
  const quellPfad = bildUrlToPath(ex.bild_url);
  const ext = quellPfad?.split(".").pop() ?? "png";
  const zielPfad = `user/${user.id}/${teId}.${ext}`;
  if (quellPfad) {
    const { error: copyErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .copy(quellPfad, zielPfad);
    if (copyErr) return { ok: false, error: "Bildkopie fehlgeschlagen: " + copyErr.message };
    bildUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(zielPfad).data.publicUrl;
  }
}

const diagramm = ex.diagramm ? kopiereDiagramm(parseDiagramm(ex.diagramm)!) : null;
const { error } = await supabase.from("training_exercises").insert({
  id: teId,
  training_id: trainingId,
  trainingsteil,
  hauptteilkategorie: hkat,
  position,
  exercise_id: exerciseId,            // bleibt bis PR 3 (Überführungs-Join)
  exercise_name_cache: ex.name,       // bleibt bis PR 3
  name: ex.name,
  kategorien: ex.kategorien,
  erscheinungsform: ex.erscheinungsform,
  feldtyp: ex.feldtyp,
  anzahl_kinder: ex.anzahl_kinder,
  material: ex.material,
  methodischer_fahrplan: ex.methodischer_fahrplan,
  aufbau: ex.aufbau,
  varianten: ex.varianten,
  bild_url: bildUrl,
  bild_quelle: ex.bild_quelle,
  diagramm,
  ...stempleHerkunft(ex, user.id),
});
```

Die harte Zurückweisung `ex.trainingsteil !== trainingsteil` bzw. Kategorie-Mismatch bleibt als Guard bestehen (der Picker bietet ohnehin nur Passendes an — PO-Entscheid Story 4). Bei Insert-Fehler NACH gelungener Bildkopie: `removeStorageObject`-Pendant aufrufen (Datei `zielPfad` löschen), damit Story-3-PC 2 gilt.

- [ ] **Step 3: Verifikation am lokalen Stack** (Wegwerf-Skript im Scratchpad, analog Spike-Experiment): als e2e@test.local eine Manual-Übung mit Bild + Diagramm übernehmen → Fassungs-Zeile trägt alle Felder + `herkunft_typ='manual'`; Storage enthält `user/<uid>/<teId>.png` byte-identisch; Original unverändert. Fremde öffentliche Übung → `community`; eigene → `eigen`.
- [ ] **Step 4: Commit** — `git commit -m "feat(fassung): Übernahme erzeugt vollständige Fassung mit Bild-/Diagrammkopie und Herkunfts-Stempel (Stories 3/4)"`

### Task B3: Überführungs-Migration (Story 9, Schritte 2–3 lokal vorbereitet)

**Files:**
- Create: `supabase/migrations/<timestamp>_fassungen_bestand_ueberfuehren.sql`
- Create: `web/scripts/fassungen-bilder-kopieren.ts`
- Create: `web/scripts/fassungen-nachweis.ts`

**Interfaces:**
- Consumes: Fassungs-Spalten (B1); bestehender Join `training_exercises.exercise_id → exercises`.
- Produces: befüllte Fassungs-Felder für den GESAMTEN Bestand; `npm`-taugliche Skripte `tsx scripts/fassungen-bilder-kopieren.ts` (idempotent, Service-Role) und `tsx scripts/fassungen-nachweis.ts` (Exit ≠ 0 bei Lücke). B4 stellt die Lese-Pfade erst um, wenn dieser Task lokal grün ist.

- [ ] **Step 1: Bild-Kopierskript** (`web/scripts/fassungen-bilder-kopieren.ts`, Werkzeugklasse wie `seed.ts` — Service-Role, `.env.local`-Fallback):

```ts
// Story 9 Schritt 1: Bilddateien aller bestehenden Zuordnungen idempotent auf
// das Fassungs-Schema kopieren (user/<owner>/<teId>.<ext>). Wiederanlauf
// überspringt vorhandene Ziele. Läuft VOR der Feld-Migration (Runbook B7).
const { data: rows } = await supabase
  .from("training_exercises")
  .select("id, trainings ( owner_id ), exercises ( bild_url )");
let kopiert = 0, uebersprungen = 0;
for (const r of rows ?? []) {
  const bildUrl = (r as any).exercises?.bild_url as string | null;
  const owner = (r as any).trainings?.owner_id as string | null;
  if (!bildUrl || !owner) continue;
  const quellPfad = bildUrlToPath(bildUrl)!;
  const ziel = `user/${owner}/${r.id}.${quellPfad.split(".").pop()}`;
  const { error } = await supabase.storage.from(BUCKET).copy(quellPfad, ziel);
  if (error && /already exists|Duplicate/i.test(error.message)) { uebersprungen++; continue; }
  if (error) throw new Error(`${quellPfad} -> ${ziel}: ${error.message}`);
  kopiert++;
}
console.log(`Bildkopien: ${kopiert} neu, ${uebersprungen} übersprungen.`);
```

(`bildUrlToPath` inline duplizieren oder aus `../lib/storage` importieren; anonymisierte Trainings mit `owner_id null` gibt es in Prod nicht — falls doch, Zeile ausgeben und überspringen: die Fassung bleibt dann ohne Bildkopie und fällt im Nachweis auf.)

- [ ] **Step 2: Feld-Migration** (atomar; deterministische Bild-URLs — die Objekte hat Schritt 1 erzeugt):

```sql
-- Story 9 Schritt 2: Bestand einmalig in Fassungen überführen (atomar).
update training_exercises te
set name = e.name,
    kategorien = e.kategorien,
    erscheinungsform = e.erscheinungsform,
    feldtyp = e.feldtyp,
    anzahl_kinder = e.anzahl_kinder,
    material = e.material,
    methodischer_fahrplan = e.methodischer_fahrplan,
    aufbau = e.aufbau,
    varianten = e.varianten,
    bild_url = case when e.bild_url is null then null else
      regexp_replace(e.bild_url, '/exercise-images/.*$',
        '/exercise-images/user/' || t.owner_id || '/' || te.id || '.' ||
        regexp_replace(e.bild_url, '^.*\.', '')) end,
    bild_quelle = e.bild_quelle,
    diagramm = e.diagramm,
    herkunft_name = e.name,
    herkunft_typ = case when e.source = 'manual' then 'manual'
                        when e.owner_id = t.owner_id then 'eigen'
                        else 'community' end,
    herkunft_datum = now()
from exercises e, trainings t
where e.id = te.exercise_id and t.id = te.training_id and te.herkunft_datum is null;

-- Zuordnungen ohne auflösbare Übung (Story 9 AK 4): Name aus dem Cache,
-- Quelltyp Community (nur Trainer-Übungen können verschwinden).
update training_exercises
set name = coalesce(exercise_name_cache, 'Unbenannte Übung'),
    herkunft_name = coalesce(exercise_name_cache, 'Unbenannte Übung'),
    herkunft_typ = 'community',
    herkunft_datum = now()
where exercise_id is null and herkunft_datum is null;
```

(Diagramm wird bewusst OHNE frische Element-IDs kopiert — die Quelle bleibt bestehen und die IDs sind nur editor-intern eindeutig je Diagramm; Entkopplung ist durch die eigene jsonb-Kopie gegeben.)

- [ ] **Step 3: Nachweis-Skript** (`web/scripts/fassungen-nachweis.ts`, Story 9 AK 6 — liest per Service-Role, Exit 1 bei Befund): prüft (a) jede Zuordnung hat `name` und `herkunft_datum`; (b) für jede Zuordnung mit auflösbarer Übung stimmen `name, kategorien, feldtyp, anzahl_kinder, material, methodischer_fahrplan, aufbau, varianten, bild_quelle, diagramm` mit der Quelle überein; (c) jede Fassung mit `bild_url` hat ihr Storage-Objekt (`storage.from(BUCKET).list` je Owner-Ordner oder `info(zielPfad)`); (d) Zähl-Summary ausgeben. Den Zweig «ohne auflösbare Übung» synthetisch prüfen: lokal eine Zuordnung per SQL auf `exercise_id = null` setzen, Migration erneut auf frischer DB spielen (`db:reset` + Fixture), Nachweis grün.

- [ ] **Step 4: Lokal durchspielen (Reihenfolge wie Prod!)** — Run aus `web/`: `npm run db:reset && npm run seed`, Testdaten anlegen (Training + Zuordnungen alten Stils per SQL-Fixture, inkl. 1 Bild-Übung), dann `tsx scripts/fassungen-bilder-kopieren.ts` → Migration einspielen (`npx supabase migration up --workdir ..`) → `tsx scripts/fassungen-nachweis.ts` — Expected: Nachweis grün; Wiederanlauf des Kopierskripts meldet nur Übersprungene.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): Bestand-Überführung — Kopierskript, atomare Feld-Migration, maschineller Nachweis (Story 9)"`

### Task B4: Lese-Pfade auf die Fassung umstellen (Stories 3/6-Basis)

**Files:**
- Modify: `web/lib/queries/trainings.ts` (`PE_SELECT`, `TrainingExerciseItem`, `mapTraining`)
- Modify: `web/app/training/[id]/page.tsx`, `web/components/training/TrainingExerciseDetail.tsx`, `web/app/training/[id]/druck/page.tsx`, `web/app/training/[id]/durchfuehren/page.tsx` bzw. `TrainingDurchfuehren.tsx`, `web/components/training/TrainingEditor.tsx`

**Interfaces:**
- Produces: `TrainingExerciseItem` trägt die Fassungs-Felder direkt (`name, kategorien, feldtyp, anzahlKinder, material, fahrplan, aufbau, bildUrl, bildQuelle, diagramm, herkunft: Herkunft | null`); `exercise`-Embed und `available` entfallen aus dem Typ (der Join bleibt bis PR 3 nur noch in `PE_SELECT` als Fallback für `name`).

- [ ] **Step 1:** `PE_SELECT` auf die Fassungs-Spalten umstellen (kein `exercises(...)`-Embed mehr für Inhalte; `exercise_name_cache` bleibt als Name-Fallback für den Übergang). `mapTraining` entsprechend; `stufenAbgedeckt`-Aufruf im Editor (`TrainingEditor.tsx:540`) liest `item.kategorien` statt `item.exercise.kategorien`.
- [ ] **Step 2:** Die vier Renderer auf die Fassungs-Felder umstellen. Dabei (Story 6 AK 10): den Link auf `/uebung/${slug}` in `web/app/training/[id]/page.tsx:133-134` ersatzlos entfernen; in `TrainingExerciseDetail.tsx` den `showSource`-Hinweis «Offizielle Übung aus dem Manual» samt Prop entfernen (PO-Entscheid: entfällt ersatzlos in Druck und Durchführen).
- [ ] **Step 3:** Der `available`/Platzhalter-Pfad («Übung nicht mehr verfügbar») entfällt in den Renderern — jede Fassung hat einen Namen; inhaltsleere Alt-Fassungen rendern schlicht ihre leeren Felder.
- [ ] **Step 4:** `npm run typecheck`; lokal E2E: Bestands-Training (aus B3-Fixture) zeigt in Detail/Druck/Durchführen/Editor exakt denselben Inhalt wie vorher (Epic-NFR 3), aber ohne Original-Link und ohne Manual-Badge.
- [ ] **Step 5: Commit** — `git commit -m "refactor(trainings): Anzeige und Editor lesen die Fassung statt des Übungs-Joins (Story 3/6)"`

### Task B5: Picker-Feinschliff (Story 4 UI)

**Files:**
- Modify: `web/components/training/TrainingEditor.tsx` (Picker), `web/lib/actions/trainings.ts` (`removeOneTrainingExercise` entfernen)

- [ ] **Step 1:** Warenkorb-«−» aus dem Picker entfernen (Story 4 AK 7: der Picker fügt nur hinzu); `removeOneTrainingExercise` löschen (Aufrufer entfernen). Entfernen geschieht ausschliesslich über die bestehende Editor-Aktion (`removeTrainingExercise`) — diese um das Löschen der Fassungs-Bilddatei ergänzen (`bildUrlToPath(fassung.bild_url)` → `removeStorageObject`, nur wenn Pfad `user/<owner>/<teId>` — nie ein Original löschen; Story 3 AK 13).
- [ ] **Step 2:** Trainings-Löschung (`deleteTraining`): vor dem Delete alle Fassungs-Bildpfade des Trainings sammeln und nach erfolgreichem Delete aus dem Storage entfernen (Kaskade löscht nur DB-Zeilen).
- [ ] **Step 3:** Fehler-Feedback: Der Picker zeigt die `error`-Meldung der Übernahme an (Story 4 AK 8) — bestehendes Fehler-Muster des Editors wiederverwenden.
- [ ] **Step 4:** E2E: Mehrfach-Übernahme derselben Vorlage erzeugt zwei unabhängige Fassungen ans Ende des Abschnitts; Entfernen löscht die Bildkopie (Storage prüfen), das Original-Bild bleibt.
- [ ] **Step 5: Commit** — `git commit -m "feat(training): Picker fügt nur hinzu; Entfernen räumt Fassungs-Bilder auf (Story 4)"`

### Task B6: Fassung bearbeiten (Story 5)

**Files:**
- Create: `web/app/training/[id]/uebung/[teId]/edit/page.tsx`, `web/app/training/[id]/uebung/[teId]/diagramm/page.tsx`
- Create: `web/components/training/FassungForm.tsx` (aus `ExerciseForm.tsx` abgeleitet; gemeinsame Teile extrahieren statt kopieren, wo ohne Verrenkung möglich)
- Create: `web/lib/actions/fassung.ts` (`updateFassung`, `saveFassungDiagramm`)

**Interfaces:**
- Consumes: `brauchtFahrplan`, `parseExercise`-Feldlogik (extrahieren zu `parseUebungsInhalt(form): ParseResult` in `web/lib/actions/exercises.ts`, von beiden Actions genutzt), `fahrplanZuText`-Prefill aus Teil A.
- Produces: `updateFassung(teId, prev, form)` — validiert wie eine Bibliotheks-Übung (NFR 1), schreibt nur Fassungs-Spalten (Herkunft nie — DB-Trigger sichert das zusätzlich ab).

- [ ] **Step 1:** `parseExercise` in `parseUebungsInhalt` (Feld-Parsing/Validierung) und dünne Wrapper trennen; `updateFassung` nutzt dieselbe Funktion — damit gelten identische Regeln (inkl. «Fussball spielen»-Beschreibung, Story 5 AK 9–13).
- [ ] **Step 2:** Einordnungswechsel in `updateFassung`: bei geändertem `trainingsteil`/`hauptteilkategorie` neue `position` = Ende des Ziel-Abschnitts (Logik aus `addTrainingExercise` wiederverwenden); `erscheinungsform`/`hauptteilkategorie` verwerfen, wo die neue Einordnung sie nicht kennt (Story 5 AK 8; der Guard-Trigger nullt die Kategorie ohnehin). Formular-Prefill beider Wechselrichtungen wie in Teil A (`fahrplanZuText`, Offen-starten-Übernahme).
- [ ] **Step 3:** Bild: Ersetzen über `uploadImage`-Pendant mit Pfad `user/<owner>/<teId>.<ext>`; explizites Entfernen (neu, Story 5 AK 3) als eigener Formular-Schalter → `bild_url = null` + Storage-Objekt löschen (nach erfolgreichem Save, Story 5 PC 2). Anzeigequelle Foto/Diagramm umschaltbar (AK 5, bestehendes `bild_quelle`-Muster).
- [ ] **Step 4:** Diagramm: `saveFassungDiagramm(teId, data)` = `saveDiagramm`-Logik gegen `training_exercises` (Zugriff über Trainings-Eigentum statt Übungs-Owner); Editor-Route am Training mit Rücksprung in den Trainings-Editor.
- [ ] **Step 5:** Auto-Privat-Hinweis: `updateFassung` liefert `becamePrivate` wie `removeTrainingExercise` (Story 5 PC 3); Editor zeigt die bestehende `AUTO_PRIVATE_MSG`.
- [ ] **Step 6:** E2E (Story-5-AKs entlang): Manual-Fassung vollständig editieren; Einordnungswechsel Hauptteil→Ausklang (Fahrplan→Aufbau-Prefill, Erscheinungsform weg, ans Ende des Ausklangs); leere Alt-Fassung erst nach vollständigem Befüllen speicherbar; Herkunftsfelder im Formular nicht vorhanden.
- [ ] **Step 7: Commit** — `git commit -m "feat(fassung): Fassung im Training vollständig bearbeiten — Inhalt, Einordnung, Bild, Diagramm (Story 5)"`

### Task B7: Herkunft anzeigen (Story 6)

**Files:**
- Create: `web/components/ui/HerkunftsAngabe.tsx` (+ Styleguide-Eintrag `web/app/styleguide`)
- Modify: `TrainingEditor.tsx`, `web/app/training/[id]/page.tsx`, `web/app/uebung/[slug]/page.tsx`

- [ ] **Step 1:** Komponente: `«basiert auf ‹name› (KiFu-Manual | Community-Vorlage | eigene Vorlage), ‹Datum dd.mm.yyyy›»` — reine Text-/Badge-Darstellung, kein Link (Story 6 AK 10); Props `{ name, typ, datum }`.
- [ ] **Step 2:** Einbau: Trainings-Editor + Trainings-Detailansicht an jeder Fassung (immer, auch Typ `eigen` — PO-Entscheid); Übungs-Detailseite zeigt `herkunft_*` (übernommene Vorlagen) und `diagramm_herkunft_*` (Diagramm-Kopien) als zwei eigenständige Angaben (AK 7–9). Druck/Durchführen bleiben frei davon (Out of Scope 1).
- [ ] **Step 3:** `uebernimmVorlage` (`web/lib/actions/diagramm.ts`) stempelt neu `diagramm_herkunft_*` über `stempleHerkunft` (Weitergabe-Regel: trägt die Quelle bereits eine Diagramm-Herkunft, diese weiterkopieren).
- [ ] **Step 4:** E2E: anonymer Besucher sieht die Herkunft im öffentlichen Training (AK 6); Diagramm-Vorlage übernehmen → Detailseite zeigt Diagramm-Herkunft.
- [ ] **Step 5: Commit** — `git commit -m "feat(herkunft): «basiert auf …» an Fassungen, Vorlagen und Diagramm-Kopien (Story 6)"`

### Task B8: In die Bibliothek übernehmen (Story 7)

**Files:**
- Modify: `web/lib/actions/fassung.ts` → neu `uebernehmeInBibliothek(teId)`; UI-Aktion in `TrainingEditor.tsx` UND Trainings-Detailansicht (fremde öffentliche Trainings — dort existiert kein Editor)

- [ ] **Step 1:** Action: Fassung lesen (RLS: öffentliches Training genügt); Vollständigkeitsprüfung mit `parseUebungsInhalt`-Regeln — unvollständige (inhaltsleere) Fassungen ablehnen (AK 6). Neue `exercises`-Zeile: `id` vorab, `slug = userSlug(name)` — bei Kollision `userSlug` erneut mit Suffix aufrufen bis frei (AK 7; `userSlug` prüfen: hängt bereits einen Zufallsteil an? Falls ja, genügt ein Aufruf). `source='user'`, `owner_id=user.id`, `visibility='private'` (AK 3), Bildkopie `user/<uid>/<exId>.<ext>` per Storage-Copy (Quelle = Fassungs-Bild, öffentlich lesbar), Diagramm via `kopiereDiagramm`, Herkunft der Fassung unverändert übertragen (PC 2). Insert-Fehler → kopierte Datei entfernen (PC 5).
- [ ] **Step 2:** Fehlende/unsichtbare Quelle → folgenloser Abbruch mit Meldung (PC 4, AK 8).
- [ ] **Step 3:** E2E: Fassung aus fremdem öffentlichem Training übernehmen → private eigene Vorlage mit Ur-Herkunft; dieselbe Fassung zweimal → zwei unabhängige Vorlagen (AK 5); Vorlage danach in ein Training übernehmen → neue Fassung trägt die Ur-Herkunft weiter (Kettenwurzel).
- [ ] **Step 4: Commit** — `git commit -m "feat(bibliothek): Fassung als private Vorlage übernehmen, Ur-Herkunft bleibt (Story 7)"`

### Task B9: Vereinfachtes Veröffentlichen (Story 8)

**Files:**
- Create: `supabase/migrations/<timestamp>_publish_training_v2.sql`
- Modify: `web/lib/actions/trainings.ts` (`publishTrainingAction`), Publish-UI (`TrainingVisibilityControl.tsx`)

- [ ] **Step 1: RPC v2** — `drop function publish_training(uuid, boolean);` und neu ohne Übungs-Logik:

```sql
create function publish_training(p_training_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_missing text[] := '{}';
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from trainings where id = p_training_id and owner_id = v_uid) then
    raise exception 'training not found or not owned by caller';
  end if;
  if not exists (select 1 from trainings where id = p_training_id
                 and coalesce(array_length(stufen,1),0) >= 1) then
    v_missing := array_append(v_missing, 'stufe');
  end if;
  if not exists (select 1 from training_exercises where training_id = p_training_id
                 and trainingsteil = 'einleitung') then
    v_missing := array_append(v_missing, 'einleitung');
  end if;
  if not exists (select 1 from training_exercises where training_id = p_training_id
                 and trainingsteil = 'hauptteil') then
    v_missing := array_append(v_missing, 'hauptteil');
  end if;
  if array_length(v_missing,1) >= 1 then
    return jsonb_build_object('status','incomplete','missing',to_jsonb(v_missing));
  end if;
  update trainings set visibility = 'public' where id = p_training_id;
  return jsonb_build_object('status','published');
end; $$;
revoke all on function publish_training(uuid) from public, anon;
grant execute on function publish_training(uuid) to authenticated;
```

- [ ] **Step 2: UI** — `needs_confirmation`-Zweig und `includePrivate`-Parameter entfernen; stattdessen VOR dem RPC-Aufruf der Tragweite-Dialog bei JEDEM Veröffentlichungsvorgang (PO-Entscheid): Text «Alle Inhalte dieses Trainings einschliesslich der Bilder werden öffentlich.» (provisorischer Wortlaut; Feinschliff = offene UX-Frage; Platzierung als bestehender Dialog-Baustein). AK 3 («Bestätigung nur für ein veröffentlichbares Training»): der Dialog erscheint nur, wenn die im Editor geladenen Daten die Vollständigkeitsregel erfüllen (Stufen gesetzt, Einleitung und Hauptteil belegt — clientseitig aus dem geladenen Training prüfbar); die RPC bleibt die serverseitige Trust-Boundary und liefert sonst `incomplete`. Fehlschlag nach Bestätigung → Meldung (AK 5). Übungs-Publish (`setVisibility`) bleibt bestätigungsfrei (AK 6).
- [ ] **Step 3:** E2E: Veröffentlichen mit Dialog; erneutes Veröffentlichen nach Rückzug fragt erneut; keine Übungs-Rückfrage mehr; Übung zurückziehen lässt Fassungen unberührt (PC 3, gegen Altverhalten geprüft).
- [ ] **Step 4: Commit** — `git commit -m "feat(publish): Tragweite-Bestätigung statt Übungs-Rückfrage (Story 8)"`

### Task B10: Gesamtverifikation + PR 2 + Rollout-Runbook

- [ ] **Step 1:** Voller lokaler Durchlauf: `npm run db:reset && npm run seed` → Bestands-Fixture → Kopierskript → `migration up` → Nachweis grün → alle E2E-Checks der Tasks B4–B9 einmal am Stück (echter App-Pfad, Alt- und Neuverhalten gegenprüfen).
- [ ] **Step 2:** PR 2 auf `develop` («feat(bibliothek): Fassungs-Modell — Stories 3–9 ohne Verweis-Abbau»).
- [ ] **Step 3: Staging-Probelauf (Reihenfolge = Prod-Generalprobe):** VOR dem Merge `tsx scripts/fassungen-bilder-kopieren.ts` mit Staging-Credentials ausführen → Merge (deploy-staging spielt die Migrationen) → `tsx scripts/fassungen-nachweis.ts` gegen Staging → App-Smoke-Test auf staging.ki-fu.ch.
- [ ] **Step 4: Prod:** Kopierskript mit Prod-Credentials → PR `develop` → `main` mergen (Migrationen laufen) → Nachweis gegen Prod → Smoke-Test auf ki-fu.ch. Hinweis: zwischen Vercel-Deploy und `db push` liegt ein kurzes Fenster — der `exercise_name_cache`-Fallback in `PE_SELECT` überbrückt es.

### Task B11: Verweis-Abbau + Bereinigung (PR 3, erst nach grünem Prod-Nachweis)

**Files:**
- Create: `supabase/migrations/<timestamp>_fassungen_verweis_abbau.sql`
- Modify: `web/lib/queries/trainings.ts`, `web/lib/actions/trainings.ts` (Cache-/exercise_id-Reste)

- [ ] **Step 1: Migration:**

```sql
-- Story 9 AK 7 (Spike Gate 7 Schritt 4): Verweis-Abbau NACH grünem Nachweis.
-- Kein Nutzdatenverlust — alle Inhalte liegen in den Fassungs-Spalten.
drop trigger training_exercise_phase on training_exercises;
drop function training_exercise_phase_guard();
alter table training_exercises
  drop column exercise_id,
  drop column exercise_name_cache,
  alter column name set not null;
-- Die Hauptteil-Invariante bleibt als validierter CHECK bestehen; die
-- Zwangs-NULL-Logik des Guards übernimmt die App (Einordnungswechsel, B6).
```

(Achtung: der Guard nullte bisher die Kategorie bei Nicht-Hauptteil — `updateFassung` aus B6 tut das bereits selbst; vor dem Drop per Suche verifizieren, dass kein Schreibpfad sich auf den Trigger verlässt.)

- [ ] **Step 2:** Code-Reste entfernen: `exercise_id`/`exercise_name_cache` aus `PE_SELECT`, Typen, `addTrainingExercise`-Insert; `gen:types`; `typecheck`; Hygiene-Grep: `grep -rn "exercise_name_cache\|exercise_id" web/ --include="*.ts*"` → nur noch Storage-/Historik-Kommentare.
- [ ] **Step 3:** Lokal `db:reset` + Seed + E2E-Kurzdurchlauf; PR 3 → develop → Staging prüfen → main.
- [ ] **Step 4: Commit-Botschaft** — `feat(db): Übungs-Verweis der Zuordnungen abgebaut — Fassungen sind die einzige Quelle (Story 9 Abschluss)`

---

## Story-Abdeckung (Selbst-Check)

| Story | Tasks |
|---|---|
| 1 (Spike) | erledigt (Entscheidungsdokument, PR #86) |
| 2 | A1–A4 |
| 3 | B1, B2, B4 |
| 4 | B2, B5 |
| 5 | B6 |
| 6 | B4 (Link/Badge weg), B7 |
| 7 | B8 |
| 8 | B9 |
| 9 | B3, B10 (Runbook), B11 (Verweis-Abbau) |

Offene UX-Fragen der Stories (Herkunfts-Darstellung, Dialog-Wortlaut, Feld-Benennung) blockieren nicht: die Tasks nennen funktionale Minimal-Darstellungen; Feinschliff folgt UX-Input.
