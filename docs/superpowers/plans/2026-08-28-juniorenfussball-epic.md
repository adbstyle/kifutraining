# Juniorenfussball-Trainingsschema — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die App zusätzlich zum Kinderfussball (G/F/E) für den Juniorenfussball (D–A) öffnen: neue Alterskategorien, Schema-Bestimmung mit Mischverbot und Wechsel-Übertragung, dreiteiliges Junioren-Schema mit Unterblöcken, Junioren-Heimat für Übungen, Zeit-Orientierung, schema-eigene Veröffentlichungsbedingungen, Durchführung/Druck, Übungstyp, Trainingsziel, geöffnete Texte und Junioren-Erscheinungsformen — Stories 2–12 aus `docs/superpowers/specs/2026-08-14-juniorenfussball-stories.md`.

**Architektur:** Die Heimat einer Übung bleibt die bestehende Spalte `exercises.trainingsteil`, deren CHECK additiv um die drei Junioren-Heimaten erweitert wird — genau eine Heimat ist damit strukturell garantiert, kein NULL-Zustand, keine zweite Spalte. Die Einordnung im Training bleibt `training_exercises.trainingsteil`, erweitert um die sechs Junioren-Block-Slugs und den schema-neutralen Zustand `nacharbeit`; die Teil→Unterblock-Hierarchie des Juniorenschemas ist reines Darstellungswissen in `web/lib/junioren.ts`. Das Schema eines Trainings ist eine reine Funktion seiner `stufen` (TS und SQL identisch definiert); Mischverbot, Schema-Konsistenz der Zuordnungen und die schema-eigenen Veröffentlichungsbedingungen werden in der Datenbank durchgesetzt (Trigger/RPC, Muster der bestehenden Gates).

**Tech Stack:** Next.js 15 (App Router, Server Actions), Supabase/Postgres (RLS + SECURITY-DEFINER-RPCs), TypeScript, Tailwind; Python (Schema-/Vokabular-Tests via pytest).

## Global Constraints

- Projektsprache Deutsch: Code-Kommentare, Doku, Commit-Messages, UI-Texte (CLAUDE.md).
- **Release als GANZES Epic** (PO 2026-08-16): alle Tasks auf EINEM Feature-Branch `feature/junioren-epic` ab `develop`; PR auf `develop` erst nach Task 18. Zwischenzustände erreichen nie Nutzer.
- **Forward-only** (echte Nutzer seit 2026-08): keine destruktiven Migrationen; neue Invarianten auf bestehenden Tabellen als `NOT VALID` + spätere `VALIDATE`-Migration oder mit vorherigem Backfill; CHECK-Erweiterungen (schwächere Regel) via `drop constraint` + `add constraint` in EINER Transaktion.
- Bestehende Kinderfussball-Daten bleiben unverändert lesbar, bearbeitbar, veröffentlichbar (Epic-EK 16, NFR 1/2). Kein Backfill von Übungstyp/Erscheinungsformen (PO).
- Eine Vokabularquelle: `data/vokabular.yaml`; `web/lib/vocab.ts` NIE von Hand editieren (`npm run gen:vocab`); Parität automatisiert nachgewiesen (`tests/test_vokabular.py`).
- Supabase server-only: keine `NEXT_PUBLIC_*`-Variablen, kein Browser-Client.
- Jede Migration mit DDL auf Bestandstabellen beginnt mit der Lock-Schranke `set lock_timeout = '5s';` als ERSTER Anweisung (Memory «Migrationen: Deploy-Messbefunde»; Muster: `20260826172000`).
- Nach jeder Migration: `npm run db:reset && npm run gen:types` (aus `web/`), danach `npm run seed` gegen die lokale DB (pr-checks macht dasselbe — der Seed MUSS jede neue Constraint-Lage überleben).
- Slug-Konventionen dieses Epics: Junioren-Blöcke `jun-aufwaermen`, `jun-spielform-trainingsziel`, `jun-explosivitaet`, `jun-spielformen`, `jun-spiel`, `jun-ausklang`; Übungstyp `basisspielform`, `spielform`, `isolierte-form`; Nacharbeits-Zustand `nacharbeit` (bewusst KEIN Vokabularwert — er ist kein Trainingsteil, sondern ein technischer Übergangszustand).
- Zeitbandbreiten (Abbildungsregel §5, Manual Abb. 19 + J+S-Lernbaustein): Einstieg 20–30, Aufwärmen 10–12, Spielform zum Trainingsziel 6–8, Explosivität 8–10, Hauptteil 45–65, Spielformen 30–45, Spiel 15–20, Ausklang/Abschluss 5–10, Gesamt 90 Minuten. Grenzwerte zählen als innerhalb.
- Prod-Schritte (Merge nach `main`, `seed-prod`) NUR mit expliziter PO-Freigabe im Moment (Memory-Regel).
- E2E lokal: bestätigter User `e2e@test.local` / `Test1234!` (via Admin-API anlegen, siehe CLAUDE.md), MCP-Browser hält die Session.

### Bewusste Plan-Entscheide (wo Stories Spielraum lassen)

| Frage (offene UX-Frage der Story) | Entscheid dieses Plans | Abnahme |
|---|---|---|
| Farbe/Kurzlabel D, C, B, A (Story 2) | Kurzlabel = Buchstabe (wie G/F/E), Labels «D-Junior:innen» … «A-Junior:innen»; vier neue Token `kat-d`…`kat-a` in absteigender Helligkeit derselben Palette wie `kat-g/f/e`, im Styleguide dokumentiert | PO im E2E-Durchgang (Task 18) |
| Filter-Skalierung 3→7 (Story 2) | Ein gemeinsamer flacher Block G→A in fachlicher Reihenfolge (kein Schema-Gruppierungs-Header) — konsistent mit dem flachen Erscheinungsform-Entscheid des PO | PO im E2E-Durchgang |
| Schema-Erkennbarkeit (Story 4 AC2) | Badge «Juniorenfussball» bzw. «Kinderfussball» im Editor-Kopf neben den Stufen-Chips | PO im E2E-Durchgang |
| Bestätigungsdialog + Nacharbeit (Story 3) | Bestehender `Dialog` aus dem UI-Kit; listet Fassungen ohne Entsprechung namentlich; Nacharbeits-Bereich als rot umrandete Sektion unter den Trainingsteilen | PO im E2E-Durchgang |
| Zeit-Abgleich-Darstellung (Story 6) | Neben jeder Summe «Richtwert X–Y min» plus Zustand: innerhalb (neutral), darunter «−N min», darüber «+N min»; nur im Editor (Story 8 OoS 1 hält Durchführung/Druck frei; Übersichtskarte unverändert) | PO im E2E-Durchgang |
| 17 Erscheinungsformen auffindbar (Story 12) | Flache Liste in Manual-Reihenfolge (6 KiFu, dann 11 Junioren); bestehendes `MultiSelect` mit Placeholder — keine Gruppierung (PO-Entscheid) | PO im E2E-Durchgang |
| Formulierungen Story 11 | Konkrete Textvorschläge in Task 16; **PO-Abnahme ist dort ein blockierender Checkpoint** | PO vor Merge |
| Rückübertragung Junioren→KiFu (Story 3 überträgt «anhand der Abbildungsregel», definiert die Blockrichtung aber nur teilweise) | `jun-aufwaermen`→einleitung, `jun-spielform-trainingsziel`→einleitung (Heimat-Rückabbildung §4), `jun-spiel`→hauptteil+fussball-spielen, `jun-ausklang`→ausklang (Umkehrung Z5/Z6), `jun-spielformen`→hauptteil+fussball-spielen-lernen (Z3 invers; Z4 «vielseitigkeit-erleben» ist nicht rekonstruierbar — ein Wechsel KiFu→Junioren→KiFu normalisiert sie dauerhaft; Alternative wäre das Konservieren der Alt-Kategorie in einer Nebenspalte), `jun-explosivitaet`→`nacharbeit` (ohne KiFu-Entsprechung), `nacharbeit` bleibt `nacharbeit` | **PO-Entscheid VOR Task 6 einholen** — erweitert die abgenommene Abbildungsregel (§4 kennt nur die Heimat-Rückabbildung) und wirkt beim Round-Trip irreversibel |
| Story 7 PC 2 / Story 3 PC 5 («selbsttätig auf privat») vs. Ist-Verhalten (Umschalten-Epic BLOCKIERT verletzende Änderungen) | Blockieren bleibt für beide Schemata die Regel (kein KiFu-Verhaltensbruch, Story 7 OoS 1); Auto-Privat gibt es genau beim Schema-Wechsel im RPC (PC 5). PC 2 wird damit bewusst NICHT wörtlich erfüllt | **PO-Entscheid in Task 12 (Checkpoint)** |

---

## Vorgehen und Task-Übersicht

Ein Task = eine Story-Scheibe mit eigenem Test-Zyklus und eigenem Commit. Reihenfolge = Story-Reihenfolge des Epics (2 → 3 → 4/5a → 5b → 6 → 7 → 8 → 9 → 10 → 11 → 12 → Abschluss). Tests: `pytest` für Vokabular/Schema, `npm run typecheck` als Gate, SQL-Asserts via `psql` gegen die lokale DB, `npm run seed` als Constraints-Regressionstest, Browser-E2E pro Story-Scheibe.

| Task | Inhalt | Story |
|---|---|---|
| 1 | Setup: Branch, lokale DB, Baseline | — |
| 2 | Vokabular-Erweiterung + Generator + Schema + Paritätstests | 2, 9, 12 (Datenbasis) |
| 3 | Migration: Alterskategorien G–A | 2 |
| 4 | UI: Kategorien D–A überall (Chips, Filter, Farben, Sortierung) | 2 |
| 5 | `web/lib/junioren.ts`: Schema-Funktion, Abbildungsregel, Struktur, Bandbreiten | 3–8 (Fundament) |
| 6 | Migration: Mischverbot, Schema-Funktion SQL, Junioren-Blöcke, Schema-Gate, Bedingungsfunktion, Wechsel-RPC | 3, 4, 7 (DB) |
| 7 | VALIDATE-Migration Mischverbot | 3 |
| 8 | UI: Schema-Wechsel mit Bestätigung + Nacharbeits-Bereich | 3 |
| 9 | UI: Junioren-Editor (3 Teile, 6 Unterblöcke, Picker, Vorschlag, Einordnung ändern) | 4, 5a |
| 10 | Migration + Übungs-Editor: Junioren-Heimat | 5b |
| 11 | Zeit-Abgleich im Editor | 6 |
| 12 | Veröffentlichen je Schema (publish v3 + UI) | 7 |
| 13 | Durchführung + Druck + Detailansicht für Junioren-Struktur | 8 |
| 14 | Übungstyp (Migration + Erfassen + Filter + Anzeige) | 9 |
| 15 | Trainingsziel (Migration + alle Ansichten) | 10 |
| 16 | Texte öffnen (mit PO-Abnahme-Checkpoint) | 11 |
| 17 | Junioren-Erscheinungsformen (Migration + Erfassen + Filter) | 12 |
| 18 | E2E-Gesamtdurchgang, Produktdoku, Spec-Nachführung, PR | Abschluss |

---

### Task 1: Setup und Baseline

**Files:**
- Kein Code; Arbeitsumgebung.

- [ ] **Step 1: Worktree/Branch anlegen**

```bash
git fetch origin
git worktree add ../kifu-junioren -b feature/junioren-epic origin/develop
cd ../kifu-junioren/web && npm install
```

- [ ] **Step 2: Lokale DB + Baseline prüfen**

```bash
cd ../kifu-junioren/web
npm run db:start
npm run gen:vocab && npm run typecheck
npm run seed
cd .. && .venv/bin/pytest || (python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/pytest)
```

Erwartet: typecheck grün, Seed idempotent durch, pytest grün. Diese vier Kommandos sind der Regressions-Standard JEDES folgenden Tasks.

---

### Task 2: Vokabular-Erweiterung (eine Quelle für alles Neue)

**Files:**
- Modify: `data/vokabular.yaml`
- Modify: `web/scripts/gen-vocab.mjs` (Hardcode `kategorien` entfernen)
- Modify: `schema/uebung.schema.json` (kategorien-Enum G–A, Titel neutral)
- Modify: `tests/test_vokabular.py` (Paritäts-Asserts für alle neuen Blöcke)
- Generated: `web/lib/vocab.ts` (via `npm run gen:vocab`)

**Interfaces:**
- Produces: `vocab.ts`-Exporte im Generator-Muster (`<key>`, `<PascalKey>Slug`, `<key>Slugs`): `kategorien` (G–A), `junioren_trainingsteil`, `junioren_block` (+ `JuniorenBlockSlug`, `junioren_blockSlugs`), `junioren_heimat` (+ `JuniorenHeimatSlug`, `junioren_heimatSlugs`), `uebungstyp` (+ `UebungstypSlug`, `uebungstypSlugs`), `erscheinungsform_junioren` (+ `ErscheinungsformJuniorenSlug`, `erscheinungsform_juniorenSlugs`). Die snake_case-Slug-Konstanten beim Import aliasen (`junioren_heimatSlugs as juniorenHeimatSlugs`).

- [ ] **Step 1: Fehlschlagenden Paritätstest schreiben**

In `tests/test_vokabular.py` ergänzen:

```python
def test_vokabular_kategorien_und_junioren_bloecke():
    vocab = yaml.safe_load(Path("data/vokabular.yaml").read_text(encoding="utf-8"))
    schema = json.loads(Path("schema/uebung.schema.json").read_text(encoding="utf-8"))
    props = schema["properties"]

    # Alterskategorien: eine Quelle, fachliche Reihenfolge G→A (Story 2 AC 6/7)
    assert list(vocab["kategorien"]) == ["G", "F", "E", "D", "C", "B", "A"]
    assert list(vocab["kategorien"]) == props["kategorien"]["items"]["enum"]

    # Junioren-Strukturen vorhanden und vollständig
    assert list(vocab["junioren_trainingsteil"]) == ["einstieg", "hauptteil", "abschluss"]
    assert list(vocab["junioren_block"]) == [
        "jun-aufwaermen", "jun-spielform-trainingsziel", "jun-explosivitaet",
        "jun-spielformen", "jun-spiel", "jun-ausklang",
    ]
    assert list(vocab["junioren_heimat"]) == [
        "jun-aufwaermen", "jun-spielform-trainingsziel", "jun-explosivitaet",
    ]
    # Heimaten sind eine Teilmenge der Blöcke (identische Slugs → trivialer Vorschlag)
    assert set(vocab["junioren_heimat"]) <= set(vocab["junioren_block"])

    assert list(vocab["uebungstyp"]) == ["basisspielform", "spielform", "isolierte-form"]
    assert len(vocab["erscheinungsform_junioren"]) == 11
    # Keine Slug-Kollision zwischen den beiden Erscheinungsform-Vokabularen
    assert not set(vocab["erscheinungsform_junioren"]) & set(vocab["erscheinungsform"])
```

- [ ] **Step 2: Test läuft rot**

Run: `.venv/bin/pytest tests/test_vokabular.py -v` — Erwartet: FAIL (`KeyError: 'kategorien'`).

- [ ] **Step 3: `data/vokabular.yaml` erweitern**

Ans Dateiende anfügen (bestehende Blöcke unverändert lassen):

```yaml
kategorien:
  G: "G"
  F: "F"
  E: "E"
  D: "D"
  C: "C"
  B: "B"
  A: "A"
junioren_trainingsteil:
  einstieg: "Einstieg"
  hauptteil: "Hauptteil"
  abschluss: "Abschluss"
junioren_block:
  jun-aufwaermen: "Aufwärmen"
  jun-spielform-trainingsziel: "Spielform zum Trainingsziel"
  jun-explosivitaet: "Explosivität"
  jun-spielformen: "Spielformen und unterstützende Übungen"
  jun-spiel: "Spiel"
  jun-ausklang: "Ausklang"
junioren_heimat:
  jun-aufwaermen: "Aufwärmen"
  jun-spielform-trainingsziel: "Spielform zum Trainingsziel"
  jun-explosivitaet: "Explosivität"
uebungstyp:
  basisspielform: "Basisspielform"
  spielform: "Spielform"
  isolierte-form: "Isolierte Form"
erscheinungsform_junioren:
  spiel-variantenreich-aufbauen: "Das Spiel variantenreich und situationsangepasst aufbauen"
  torchancen-vorbereiten-abschliessen: "Torchancen variantenreich vorbereiten und erfolgreich abschliessen"
  offensive-zweikaempfe-bestreiten: "Offensive Zweikämpfe mutig und erfolgreich bestreiten"
  ballorientiert-kompakt-verteidigen: "Ballorientiert, kompakt und situationsangepasst verteidigen"
  defensive-zweikaempfe-bestreiten: "Defensive Zweikämpfe mutig und erfolgreich bestreiten"
  schnell-umschalten: "Schnell umschalten"
  explosiv-dynamisch-agieren: "Explosiv und dynamisch agieren"
  koerper-stabil-halten: "Den Körper stabil halten"
  intensive-spielaktionen-ausfuehren: "Viele intensive Spielaktionen bis ans Spielende ausführen"
  positiv-miteinander-umgehen: "Positiv miteinander umgehen"
  mutig-selbstbewusst-handeln: "Mutig und selbstbewusst zum Nutzen des ganzen Teams handeln"
```

Die 11 Junioren-Werte sind der Wortlaut von Manual-Tabelle 4 (S. 21), festgehalten in der Faktenlage zu Story 12.

- [ ] **Step 4: Generator vom Hardcode befreien**

In `web/scripts/gen-vocab.mjs` den Block am Dateiende ERSATZLOS streichen (die YAML liefert `kategorien` jetzt selbst — Story 2 AC 7 löst genau diesen Widerspruch zur Ein-Quellen-Regel):

```js
// LÖSCHEN:
out += `export const kategorien = { G: "G", F: "F", E: "E" } as const;\n`;
out += `export type KategorieSlug = keyof typeof kategorien;\n`;
out += `export const kategorienSlugs = Object.keys(kategorien) as KategorieSlug[];\n`;
```

Achtung Naming: Der Generator pascal-cased `kategorien` → Typ heisst neu `KategorienSlug` statt `KategorieSlug`. Damit kein App-weites Rename nötig ist, im Generator eine Alias-Zeile ergänzen (direkt nach der Schleife):

```js
// Rückwärtskompatibler Typ-Alias: der bisherige Hardcode exportierte `KategorieSlug`.
out += `export type KategorieSlug = KategorienSlug;\n`;
```

- [ ] **Step 5: JSON-Schema öffnen**

In `schema/uebung.schema.json`:
- `"title": "Kinderfussball Übung"` → `"title": "Übung"` (Abbildungsregel §9.4: alter Titel deckt Junioren-Übungen nicht mehr).
- `properties.kategorien.items.enum`: `["G", "F", "E"]` → `["G", "F", "E", "D", "C", "B", "A"]` (Story 2 AC 1; Manual-YAMLs tragen weiterhin nur G/F/E — das Schema erlaubt, verlangt nichts).

`properties.trainingsteil` bleibt unverändert KiFu-only: die YAML-Übungsdatenbank ist der Manual-Kinderfussball-Bestand; Junioren-Heimaten existieren nur für Trainer-Übungen in der DB (Story 5b OoS 1).

- [ ] **Step 6: Generieren + alle Tests grün**

```bash
cd web && npm run gen:vocab && npm run typecheck
cd .. && .venv/bin/pytest && .venv/bin/python scripts/validate.py
```

Erwartet: pytest PASS (auch der bestehende `test_vokabular_matches_schema_enums`), validate PASS, typecheck PASS (falls `KategorieSlug`-Importe brechen: Alias aus Step 4 prüfen).

- [ ] **Step 7: Commit**

```bash
git add data/vokabular.yaml web/scripts/gen-vocab.mjs web/lib/vocab.ts schema/uebung.schema.json tests/test_vokabular.py
git commit -m "feat(vokabular): Alterskategorien G–A, Junioren-Strukturen, Übungstyp und Junioren-Erscheinungsformen in die eine Quelle aufnehmen"
```

---

### Task 3: Migration — Alterskategorien G bis A

**Files:**
- Create: `supabase/migrations/<timestamp>_alterskategorien_d_bis_a.sql` (Timestamp via `date +%Y%m%d%H%M%S`)
- Generated: `web/lib/database.types.ts` (via `npm run gen:types`)

**Interfaces:**
- Produces: DB akzeptiert `exercises.kategorien` und `trainings.stufen` mit Werten aus {G,F,E,D,C,B,A}.

- [ ] **Step 1: Fehlschlagenden DB-Test formulieren**

```bash
cd web && npm run db:reset && npm run seed
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "insert into trainings (name, owner_id, stufen) values ('t', (select id from auth.users limit 1), '{D}');"
```

Erwartet: FAIL mit `violates check constraint "training_valid_stufen"`. (Braucht einen User — den E2E-User gemäss CLAUDE.md anlegen, falls die lokale DB frisch ist.)

- [ ] **Step 2: Migration schreiben**

```sql
-- ============================================================================
-- Story 2 (Epic #71): Alterskategorien D bis A
-- ============================================================================
-- Erweitert die erlaubten Alterskategorien von {G,F,E} auf {G,F,E,D,C,B,A}.
-- Reine ERWEITERUNG des Wertebereichs (Epic-NFR 2): jede bestehende Zeile
-- erfüllt die neue Regel trivial — Drop + Add in einer Transaktion ist damit
-- forward-only-sicher; das kurze ADD validiert die kleinen Tabellen inline.
-- Das Mischverbot (Trainings mischen nie beide Schemata) kommt bewusst NICHT
-- hier, sondern mit der Schema-Story — Übungen dürfen mischen (Story 2 Anm.).

set lock_timeout = '5s'; -- Lock-Schranke an den Dateianfang (Memory-Regel)

alter table exercises drop constraint valid_kategorien;
alter table exercises add constraint valid_kategorien
  check (kategorien <@ array['G','F','E','D','C','B','A']);

alter table trainings drop constraint training_valid_stufen;
alter table trainings add constraint training_valid_stufen
  check (stufen <@ array['G','F','E','D','C','B','A']);
```

- [ ] **Step 3: Test grün + Typen regenerieren**

```bash
cd web && npm run db:reset && npm run seed
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 <<'SQL'
insert into trainings (name, owner_id, stufen)
  values ('probe-d', (select id from auth.users limit 1), '{D}');
delete from trainings where name = 'probe-d';
SQL
npm run gen:types && npm run typecheck
```

Erwartet: Insert PASS, typecheck PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_alterskategorien_d_bis_a.sql web/lib/database.types.ts
git commit -m "feat(db): Alterskategorien D bis A an Übungen und Trainings zulassen"
```

---

### Task 4: UI — Kategorien D–A überall gleichwertig

**Files:**
- Modify: `web/lib/labels.ts` (`kategorieStufe` + D–A)
- Modify: `web/lib/training.ts` (`sortStufen`: Reihenfolge aus `kategorienSlugs` statt Hardcode)
- Modify: `web/components/training/StufenField.tsx` (`katColor` + D–A)
- Modify: `web/app/globals.css` bzw. Tailwind-Theme (vier neue Farb-Token `kat-d`…`kat-a`; an der Stelle, an der `kat-g/f/e` definiert sind — vorher mit `grep -rn "kat-g" web/` lokalisieren, auch alle weiteren Verwendungsstellen von `kat-g|kat-f|kat-e` (z. B. Katalog-Chips) um D–A ergänzen)
- Modify: `web/app/styleguide/page.tsx` (neue Kategorie-Farben dokumentieren — Styleguide-first-Regel)
- Prüfen (Filter speisen sich aus `kategorienSlugs`, sollten automatisch mitwachsen): `web/components/catalog/CatalogFilterBar.tsx`, `web/components/training/TrainingFilterBar.tsx`, `web/components/exercise/ExerciseForm.tsx`, `web/components/training/ExercisePickerDialog.tsx`

**Interfaces:**
- Consumes: `kategorienSlugs` (jetzt 7 Werte) aus Task 2.
- Produces: `kategorieStufe` mit 7 Einträgen; `sortStufen` sortiert G→A.

- [ ] **Step 1: labels.ts erweitern**

```ts
export const kategorieStufe: Record<keyof typeof kategorien, string> = {
  G: "G-Junior:innen",
  F: "F-Junior:innen",
  E: "E-Junior:innen",
  D: "D-Junior:innen",
  C: "C-Junior:innen",
  B: "B-Junior:innen",
  A: "A-Junior:innen",
};
```

- [ ] **Step 2: sortStufen enthärten**

In `web/lib/training.ts`:

```ts
/** Stabile Reihenfolge der Stufen-Anzeige — fachliche Reihenfolge aus dem
 *  Vokabular (G, F, E, D, C, B, A; Story 2 AC 6). */
export function sortStufen(stufen: readonly string[]): KategorieSlug[] {
  return kategorienSlugs.filter((s) => stufen.includes(s));
}
```

(`kategorienSlugs` zum Import ergänzen.)

- [ ] **Step 3: Farben + StufenField**

Neue Token analog `kat-g/f/e` definieren (z. B. als CSS-Variablen/`@theme`-Einträge, exakt dem Bestandsmuster folgend) und in `StufenField.tsx`:

```ts
const katColor: Record<KategorieSlug, string> = {
  G: "bg-kat-g text-rasen-950 border-transparent",
  F: "bg-kat-f text-rasen-950 border-transparent",
  E: "bg-kat-e text-rasen-950 border-transparent",
  D: "bg-kat-d text-rasen-950 border-transparent",
  C: "bg-kat-c text-rasen-950 border-transparent",
  B: "bg-kat-b text-rasen-950 border-transparent",
  A: "bg-kat-a text-rasen-950 border-transparent",
};
```

Danach ALLE Verwendungsstellen finden und ergänzen: `grep -rn "kat-g\|katColor\|kategorieStufe" web/ --include="*.tsx" --include="*.ts" -l` — jede Datei mit eigener G/F/E-Fallunterscheidung braucht die vier neuen Fälle. Styleguide-Seite um die vier Farben ergänzen.

- [ ] **Step 4: Typecheck + E2E**

```bash
cd web && npm run typecheck && npm run dev
```

Browser (angemeldet als e2e@test.local): (1) Übung anlegen mit Kategorien E+D → speichert (Übungen DÜRFEN mischen, Story 2 Anm.). (2) Katalog-Filter zeigt 7 Kategorien in Reihenfolge G→A, Filter D findet die Übung (ODER-Logik bei D+E prüfen). (3) Trainings-Übersicht nach D filterbar. (4) Chips zeigen D-Farbe.

- [ ] **Step 5: Commit**

```bash
git add -A web/
git commit -m "feat(ui): Alterskategorien D bis A in Chips, Filtern und Farben führen"
```

---

### Task 5: `web/lib/junioren.ts` — das fachliche Fundament

**Files:**
- Create: `web/lib/junioren.ts`

**Interfaces:**
- Consumes: `junioren_block`, `junioren_trainingsteil`, `JuniorenBlockSlug`, `JuniorenHeimatSlug`, `juniorenHeimatSlugs`, `TrainingsteilSlug`, `KategorieSlug` aus `@/lib/vocab`.
- Produces (von Tasks 6, 8, 9, 11, 12, 13 verwendet — Signaturen exakt so):

```ts
export type Schema = "kifu" | "junioren";
export const KIFU_STUFEN: readonly KategorieSlug[]; // ["G","F","E"]
export const JUNIOREN_STUFEN: readonly KategorieSlug[]; // ["D","C","B","A"]
export function schemaAusStufen(stufen: readonly string[]): Schema;
export function stufenMischen(stufen: readonly string[]): boolean; // true = unzulässige Mischung
export const NACHARBEIT = "nacharbeit";
export type Einordnung = TrainingsteilSlug | JuniorenBlockSlug | typeof NACHARBEIT;
export const JUNIOREN_TEILE: { slug: "einstieg" | "hauptteil" | "abschluss"; label: string;
  bloecke: { slug: JuniorenBlockSlug; label: string }[] }[];
export const JUNIOREN_BLOCK_SLUGS: JuniorenBlockSlug[]; // flache Reihenfolge wie JUNIOREN_TEILE
export function abbildungKifuZuJunioren(trainingsteil: string, hauptteilkategorie: string | null): JuniorenBlockSlug | typeof NACHARBEIT;
export function abbildungJuniorenZuKifu(block: string): { trainingsteil: TrainingsteilSlug; hauptteilkategorie: string | null } | typeof NACHARBEIT;
export function vorschlagEinordnung(heimat: string, hauptteilkategorie: string | null, schema: Schema): Einordnung;
export const BANDBREITEN: Record<string, { min: number; max: number }>; // je Junioren-Teil und -Block
export const GESAMTDAUER_JUNIOREN = 90;
export const JUNIOREN_PFLICHT_BLOECKE: JuniorenBlockSlug[]; // Publish-Pflicht (ohne jun-spiel)
export const LEER_HINWEIS_BLOECKE: JuniorenBlockSlug[]; // Hinweis bei leer: jun-spiel, jun-spielform-trainingsziel, jun-explosivitaet
```

- [ ] **Step 1: Datei mit Implementierung schreiben**

```ts
import {
  junioren_block as blockLabels,
  junioren_trainingsteil as jTeilLabels,
  junioren_heimatSlugs as juniorenHeimatSlugs,
  type JuniorenBlockSlug,
  type KategorieSlug,
  type TrainingsteilSlug,
} from "@/lib/vocab";

/**
 * Fachliches Fundament des Juniorenschemas (Epic #71): Schema-Bestimmung,
 * Abbildungsregel (Entscheidungsdokument 2026-08-15, abgenommen), Struktur
 * und Zeitbandbreiten. Eine Quelle für Editor, Actions, Ansichten — das
 * SQL-Pendant lebt in der Migration `junioren_schema` und MUSS inhaltlich
 * identisch bleiben (Kommentar-Querverweis dort).
 */

export type Schema = "kifu" | "junioren";

export const KIFU_STUFEN: readonly KategorieSlug[] = ["G", "F", "E"];
export const JUNIOREN_STUFEN: readonly KategorieSlug[] = ["D", "C", "B", "A"];

/** Schema aus den Stufen: mindestens eine Junioren-Kategorie ⇒ Junioren;
 *  sonst (auch ohne Stufen) Kinderfussball (Story 3 AC 1/2). */
export function schemaAusStufen(stufen: readonly string[]): Schema {
  return stufen.some((s) => (JUNIOREN_STUFEN as readonly string[]).includes(s))
    ? "junioren"
    : "kifu";
}

/** Unzulässige Mischung beider Schemata in einem Training (Story 3 AC 4). */
export function stufenMischen(stufen: readonly string[]): boolean {
  const kifu = stufen.some((s) => (KIFU_STUFEN as readonly string[]).includes(s));
  const jun = stufen.some((s) => (JUNIOREN_STUFEN as readonly string[]).includes(s));
  return kifu && jun;
}

/** Zuordnungs-Zustand «ohne Entsprechung im neuen Schema» (Story 3 PC 3).
 *  Bewusst kein Vokabularwert: kein Trainingsteil, sondern ein technischer
 *  Übergangszustand; er blockiert die Veröffentlichung, nie das Speichern. */
export const NACHARBEIT = "nacharbeit" as const;

export type Einordnung = TrainingsteilSlug | JuniorenBlockSlug | typeof NACHARBEIT;

/** Die drei Junioren-Trainingsteile mit ihren Unterblöcken in fester
 *  Reihenfolge (Manual Abb. 19 + J+S-Phasen; Story 4 AC 1, 5a AC 1/2). */
export const JUNIOREN_TEILE: {
  slug: "einstieg" | "hauptteil" | "abschluss";
  label: string;
  bloecke: { slug: JuniorenBlockSlug; label: string }[];
}[] = [
  {
    slug: "einstieg",
    label: jTeilLabels.einstieg,
    bloecke: [
      { slug: "jun-aufwaermen", label: blockLabels["jun-aufwaermen"] },
      { slug: "jun-spielform-trainingsziel", label: blockLabels["jun-spielform-trainingsziel"] },
      { slug: "jun-explosivitaet", label: blockLabels["jun-explosivitaet"] },
    ],
  },
  {
    slug: "hauptteil",
    label: jTeilLabels.hauptteil,
    bloecke: [
      { slug: "jun-spielformen", label: blockLabels["jun-spielformen"] },
      { slug: "jun-spiel", label: blockLabels["jun-spiel"] },
    ],
  },
  {
    slug: "abschluss",
    label: jTeilLabels.abschluss,
    bloecke: [{ slug: "jun-ausklang", label: blockLabels["jun-ausklang"] }],
  },
];

export const JUNIOREN_BLOCK_SLUGS: JuniorenBlockSlug[] = JUNIOREN_TEILE.flatMap((t) =>
  t.bloecke.map((b) => b.slug),
);

/** Abbildungsregel KiFu → Junioren (Entscheidungsdokument §2, Z1–Z7). */
export function abbildungKifuZuJunioren(
  trainingsteil: string,
  hauptteilkategorie: string | null,
): JuniorenBlockSlug | typeof NACHARBEIT {
  if (trainingsteil === "einleitung") return "jun-aufwaermen"; // Z2
  if (trainingsteil === "hauptteil") {
    if (hauptteilkategorie === "fussball-spielen") return "jun-spiel"; // Z5
    if (
      hauptteilkategorie === "fussball-spielen-lernen" ||
      hauptteilkategorie === "vielseitigkeit-erleben"
    )
      return "jun-spielformen"; // Z3, Z4
  }
  if (trainingsteil === "ausklang") return "jun-ausklang"; // Z6
  return NACHARBEIT; // Z1 (auffangen) und Z7 (jede andere Kombination)
}

/** Rückrichtung Junioren → KiFu für den Schema-Wechsel (Plan-Entscheid,
 *  hergeleitet aus der Heimat-Rückabbildung §4 und den Zeilen Z3/Z5/Z6 invers;
 *  `jun-spielformen` normalisiert auf «Fussball spielen lernen» — die
 *  Einordnung der Fassung bleibt frei änderbar). */
export function abbildungJuniorenZuKifu(
  block: string,
): { trainingsteil: TrainingsteilSlug; hauptteilkategorie: string | null } | typeof NACHARBEIT {
  switch (block) {
    case "jun-aufwaermen":
    case "jun-spielform-trainingsziel":
      return { trainingsteil: "einleitung", hauptteilkategorie: null };
    case "jun-spielformen":
      return { trainingsteil: "hauptteil", hauptteilkategorie: "fussball-spielen-lernen" };
    case "jun-spiel":
      return { trainingsteil: "hauptteil", hauptteilkategorie: "fussball-spielen" };
    case "jun-ausklang":
      return { trainingsteil: "ausklang", hauptteilkategorie: null };
    default:
      return NACHARBEIT; // jun-explosivitaet, nacharbeit, Unbekanntes
  }
}

/** Einordnungs-Vorschlag beim Zuordnen einer Übung (Story 4 AC 4, 5a AC 6;
 *  verwendet im «Einordnung ändern»-Formular der Fassung, Task 9 Step 4):
 *  Junioren-Heimat schlägt ihren Block vor; KiFu-Heimat läuft über die
 *  Abbildungsregel. Im KiFu-Schema greift die Rückabbildung der Heimat
 *  (Aufwärmen/Spielform → Einleitung; Explosivität ohne Entsprechung). */
export function vorschlagEinordnung(
  heimat: string,
  hauptteilkategorie: string | null,
  schema: Schema,
): Einordnung {
  const istJuniorenHeimat = (juniorenHeimatSlugs as readonly string[]).includes(heimat);
  if (schema === "junioren") {
    return istJuniorenHeimat
      ? (heimat as JuniorenBlockSlug)
      : abbildungKifuZuJunioren(heimat, hauptteilkategorie);
  }
  if (!istJuniorenHeimat) return heimat as TrainingsteilSlug;
  const rueck = abbildungJuniorenZuKifu(heimat);
  return rueck === NACHARBEIT ? NACHARBEIT : rueck.trainingsteil;
}

/** Zeitbandbreiten in Minuten (Entscheidungsdokument §5; Orientierung,
 *  nie Speicher- oder Veröffentlichungsbedingung — Story 6 AC 6). */
export const BANDBREITEN: Record<string, { min: number; max: number }> = {
  einstieg: { min: 20, max: 30 },
  "jun-aufwaermen": { min: 10, max: 12 },
  "jun-spielform-trainingsziel": { min: 6, max: 8 },
  "jun-explosivitaet": { min: 8, max: 10 },
  hauptteil: { min: 45, max: 65 },
  "jun-spielformen": { min: 30, max: 45 },
  "jun-spiel": { min: 15, max: 20 },
  abschluss: { min: 5, max: 10 },
  "jun-ausklang": { min: 5, max: 10 },
};

export const GESAMTDAUER_JUNIOREN = 90;

/** Publish-Pflichtblöcke Junioren (Story 7 AC 1; `jun-spiel` als freies
 *  Spiel bewusst ausgenommen — AC 2). */
export const JUNIOREN_PFLICHT_BLOECKE: JuniorenBlockSlug[] = [
  "jun-aufwaermen",
  "jun-spielform-trainingsziel",
  "jun-explosivitaet",
  "jun-spielformen",
  "jun-ausklang",
];

/** Leer-Hinweis im Editor (Story 5a AC 8; analog KiFu-Hinweis beim freien Spiel). */
export const LEER_HINWEIS_BLOECKE: JuniorenBlockSlug[] = [
  "jun-spiel",
  "jun-spielform-trainingsziel",
  "jun-explosivitaet",
];
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npm run typecheck` — Erwartet: PASS.

- [ ] **Step 3: Stichproben-Verifikation der Abbildungsregel gegen den Bestand**

```bash
cd web && npx tsx -e "
import { abbildungKifuZuJunioren } from './lib/junioren';
const faelle: [string, string|null, string][] = [
  ['auffangen', null, 'nacharbeit'],
  ['einleitung', null, 'jun-aufwaermen'],
  ['hauptteil', 'fussball-spielen-lernen', 'jun-spielformen'],
  ['hauptteil', 'vielseitigkeit-erleben', 'jun-spielformen'],
  ['hauptteil', 'fussball-spielen', 'jun-spiel'],
  ['ausklang', null, 'jun-ausklang'],
  ['hauptteil', null, 'nacharbeit'],
];
for (const [t, h, want] of faelle) {
  const got = abbildungKifuZuJunioren(t, h);
  if (got !== want) throw new Error(\`\${t}/\${h}: \${got} statt \${want}\`);
}
console.log('Abbildungsregel: 7/7 Fälle korrekt (Z1–Z7)');
"
```

Erwartet: `7/7 Fälle korrekt`.

- [ ] **Step 4: Commit**

```bash
git add web/lib/junioren.ts
git commit -m "feat(junioren): Schema-Bestimmung, Abbildungsregel und Zeitbandbreiten als eine fachliche Quelle"
```

---

### Task 6: Migration — Schema-Regel, Junioren-Blöcke, Wechsel-RPC, Bedingungsfunktion

Die zentrale DB-Migration des Epics. Sie bündelt, was fachlich untrennbar ist (Mischverbot ohne Schema-Gate wäre umgehbar, Wechsel-RPC ohne Blöcke ziellos): Mischverbot, SQL-Schema-Funktion, erweiterter Einordnungs-Wertebereich, Schema-Konsistenz-Gate, schema-bewusste Bedingungsfunktion und der Stufen-/Wechsel-RPC.

**Files:**
- Create: `supabase/migrations/<timestamp>_junioren_schema.sql`
- Generated: `web/lib/database.types.ts`

**Interfaces:**
- Consumes: Kategorien-Migration (Task 3).
- Produces (von Tasks 8, 9, 12 verwendet):
  - `training_schema(p_stufen text[]) returns text` — `'kifu' | 'junioren'`, IMMUTABLE.
  - `training_exercises.trainingsteil` akzeptiert zusätzlich die 6 Junioren-Blöcke + `nacharbeit`.
  - `training_fehlende_bedingungen(p_training_id uuid) returns text[]` — leeres Array = veröffentlichbar; Werte: `stufe|einleitung|freies_spiel` (KiFu) bzw. `jun-aufwaermen|jun-spielform-trainingsziel|jun-explosivitaet|jun-spielformen|jun-ausklang` (Junioren), schema-übergreifend `nacharbeit`.
  - `set_training_stufen(p_training_id uuid, p_stufen text[]) returns jsonb` — `{status:'ok'}` oder Exception; überträgt bei Schema-Wechsel alle Fassungen.

- [ ] **Step 1: Fehlschlagende DB-Tests formulieren**

```bash
cd web && npm run db:reset && npm run seed
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "insert into trainings (name, owner_id, stufen) values ('misch', (select id from auth.users limit 1), '{E,D}');"
```

Erwartet vor der Migration: Insert GELINGT (Mischverbot existiert noch nicht) — das ist der rote Test.

- [ ] **Step 2: Migration schreiben**

```sql
-- ============================================================================
-- Stories 3, 4, 5a, 7 (Epic #71): Junioren-Schema in der Datenbank
-- ============================================================================
-- Enthält: (1) Schema-Funktion, (2) Mischverbot NOT VALID, (3) erweiterten
-- Einordnungs-Wertebereich, (4) Schema-Konsistenz-Gate, (5) schema-bewusste
-- Bedingungsfunktion für die Veröffentlichung, (6) Stufen-/Wechsel-RPC.
-- Forward-only: alle CHECK-Erweiterungen sind schwächer als ihre Vorgänger;
-- die einzige NEUE Invariante (Mischverbot) kommt als NOT VALID und wird in
-- der Folge-Migration validiert (Bestand: stufen <@ {G,F,E} erfüllt sie).

set lock_timeout = '5s'; -- Lock-Schranke an den Dateianfang (Memory-Regel)

-- ----------------------------------------------------------------------------
-- 1) Schema aus den Stufen (SQL-Pendant zu web/lib/junioren.ts::schemaAusStufen
--    — beide Definitionen MÜSSEN inhaltlich identisch bleiben)
-- ----------------------------------------------------------------------------
create or replace function training_schema(p_stufen text[])
returns text
language sql
immutable
as $$
  select case
    when p_stufen && array['D','C','B','A'] then 'junioren'
    else 'kifu'
  end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Mischverbot (Story 3 AC 4): nie Kategorien beider Schemata an einem
--    Training. NOT VALID: neue Invariante auf bestehender Tabelle (CLAUDE.md);
--    der Bestand erfüllt sie (alle Zeilen <@ {G,F,E}), validiert wird in der
--    Folge-Migration. Übungen dürfen weiterhin mischen (Story 2 Anmerkung).
-- ----------------------------------------------------------------------------
alter table trainings add constraint training_stufen_ein_schema check (
  stufen <@ array['G','F','E'] or stufen <@ array['D','C','B','A']
) not valid;

-- ----------------------------------------------------------------------------
-- 3) Einordnungs-Wertebereich der Zuordnung (Story 4 AC 3, 5a AC 4):
--    die sechs befüllbaren Junioren-Blöcke plus `nacharbeit`. `nacharbeit`
--    ist schema-neutral: der Zustand «ohne Entsprechung» kann in beiden
--    Richtungen eines Wechsels entstehen und blockiert nur die
--    Veröffentlichung, nie das Speichern (Story 3 PC 3).
-- ----------------------------------------------------------------------------
alter table training_exercises drop constraint training_exercises_trainingsteil_check;
alter table training_exercises add constraint training_exercises_trainingsteil_check
  check (trainingsteil in (
    'auffangen','einleitung','hauptteil','ausklang',
    'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
    'jun-spielformen','jun-spiel','jun-ausklang',
    'nacharbeit'
  ));

-- Positions-Eindeutigkeit: seit 20260610130000 gelten zwei PARTIELLE
-- Unique-Indizes — plan_ex_pos_nonhauptteil auf (training_id, trainingsteil,
-- position) where trainingsteil <> 'hauptteil' (deckt alle Junioren-Blöcke
-- und `nacharbeit` automatisch mit ab) und plan_ex_pos_hauptteil auf
-- (training_id, hauptteilkategorie, position) where trainingsteil = 'hauptteil'.
-- Der frühere phase_guard-Trigger ist seit 20260824120550 gedroppt: die App
-- setzt die Hauptteilkategorie ausserhalb von 'hauptteil' EXPLIZIT auf NULL
-- (Task 9), der Biconditional-CHECK training_ex_hkat_genau_bei_hauptteil
-- bleibt die Trust-Boundary.

-- ----------------------------------------------------------------------------
-- 4) Schema-Konsistenz (Erfolgskriterium 1): die Einordnung jeder Zuordnung
--    passt zum Schema ihres Trainings. Constraint-Trigger statt CHECK, weil
--    die Regel zwei Tabellen verbindet. Greift bei INSERT und bei jeder
--    Einordnungs-Änderung; die Stufen-Seite sichert der RPC (Abschnitt 6),
--    der bei jedem Schema-Wechsel ALLE Zuordnungen überträgt.
-- ----------------------------------------------------------------------------
create function training_exercise_schema_gate() returns trigger
language plpgsql as $$
declare
  v_schema text;
begin
  select training_schema(stufen) into v_schema
    from trainings where id = new.training_id;
  if new.trainingsteil = 'nacharbeit' then
    return new; -- schema-neutral
  end if;
  if v_schema = 'junioren'
     and new.trainingsteil not in (
       'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
       'jun-spielformen','jun-spiel','jun-ausklang')
  then
    raise exception 'SCHEMA_KONFLIKT: Einordnung % passt nicht zum Juniorenschema', new.trainingsteil;
  end if;
  if v_schema = 'kifu'
     and new.trainingsteil not in ('auffangen','einleitung','hauptteil','ausklang')
  then
    raise exception 'SCHEMA_KONFLIKT: Einordnung % passt nicht zum Kinderfussball-Schema', new.trainingsteil;
  end if;
  return new;
end;
$$;

create trigger te_schema_gate before insert or update of trainingsteil
  on training_exercises
  for each row execute function training_exercise_schema_gate();

-- ----------------------------------------------------------------------------
-- 5) Veröffentlichungs-Bedingungen je Schema (Story 7 AC 1/2/4).
--    Eine Funktion als einzige Quelle: die oeffentlich-Gates (Task 12) und
--    die Vorab-Meldung der App nennen dieselbe Regel.
--    KiFu-Zweig = Bestand (stufe, einleitung, freies_spiel, ueberfuehrung).
--    Junioren-Zweig: fünf Pflichtblöcke belegt (jun-spiel als freies Spiel
--    ausgenommen), keine offene Nacharbeit; eine separate Stufen-Bedingung
--    braucht er nicht (Junioren-Schema setzt eine Junioren-Stufe voraus).
--    «Belegt» = mindestens eine Zuordnung; Nacharbeit zählt nirgends mit.
-- ----------------------------------------------------------------------------
create or replace function training_fehlende_bedingungen(p_training_id uuid)
returns text[]
language plpgsql
stable
as $$
declare
  v_stufen text[];
  v_schema text;
  v_missing text[] := '{}';
  v_block text;
begin
  select stufen, training_schema(stufen) into v_stufen, v_schema
    from trainings where id = p_training_id;

  if v_schema = 'kifu' then
    if coalesce(array_length(v_stufen, 1), 0) = 0 then
      v_missing := array_append(v_missing, 'stufe');
    end if;
    if not exists (select 1 from training_exercises
                   where training_id = p_training_id and trainingsteil = 'einleitung') then
      v_missing := array_append(v_missing, 'einleitung');
    end if;
    if not exists (select 1 from training_exercises
                   where training_id = p_training_id and trainingsteil = 'hauptteil'
                     and hauptteilkategorie = 'fussball-spielen') then
      v_missing := array_append(v_missing, 'freies_spiel');
    end if;
  else
    foreach v_block in array array[
      'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
      'jun-spielformen','jun-ausklang']
    loop
      if not exists (select 1 from training_exercises
                     where training_id = p_training_id and trainingsteil = v_block) then
        v_missing := array_append(v_missing, v_block);
      end if;
    end loop;
  end if;

  -- Schema-übergreifend: offene Nacharbeit blockiert (Story 7 AC 1).
  -- Der frühere Übergangs-Check «alle Zuordnungen überführt» entfällt:
  -- training_exercises.name ist seit 20260824120550 NOT NULL.
  if exists (select 1 from training_exercises
             where training_id = p_training_id and trainingsteil = 'nacharbeit') then
    v_missing := array_append(v_missing, 'nacharbeit');
  end if;

  return v_missing;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) Stufen setzen mit Schema-Wechsel-Übertragung (Story 3 PC 1–5).
--    SECURITY DEFINER mit Owner-Check als erster Anweisung (Projektregel).
--    Die App bestätigt den Wechsel VORHER im Dialog (AC 5–7); die RPC ist die
--    Trust-Boundary und überträgt atomar. Übertragungsmatrix = Abbildungsregel
--    (Entscheidungsdokument §2/§4; Rückrichtung als dokumentierter
--    Plan-Entscheid) — SQL-Pendant zu web/lib/junioren.ts.
-- ----------------------------------------------------------------------------
create or replace function set_training_stufen(
  p_training_id uuid,
  p_stufen text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_alt text[];
  v_visibility text;
  v_schema_alt text;
  v_schema_neu text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  -- Team-Trainings haben owner_id NULL (tr_ein_eigentuemer); jedes Mitglied
  -- darf sie bearbeiten — derselbe Kreis wie die tr_update-Policy.
  select stufen, visibility into v_alt, v_visibility
    from trainings
    where id = p_training_id
      and (owner_id = v_uid or (team_id is not null and ist_team_mitglied(team_id)));
  if not found then
    raise exception 'training not found or not editable by caller';
  end if;

  if not (p_stufen <@ array['G','F','E'] or p_stufen <@ array['D','C','B','A']) then
    raise exception 'SCHEMA_KONFLIKT: Alterskategorien beider Schemata lassen sich nicht mischen';
  end if;

  v_schema_alt := training_schema(v_alt);
  v_schema_neu := training_schema(p_stufen);

  if v_schema_alt = v_schema_neu then
    update trainings set stufen = p_stufen where id = p_training_id;
    return jsonb_build_object('status', 'ok', 'wechsel', false);
  end if;

  -- Schema-Wechsel: Stufen setzen und ALLE Zuordnungen übertragen — atomar.
  -- Positionen werden je Zielblock lückenlos neu vergeben (Positions-
  -- Eindeutigkeit); die Reihenfolge folgt der bisherigen Gliederung.
  -- Der te_schema_gate-Trigger prüft je Zeile gegen das NEUE Schema, darum
  -- zuerst die Stufen.
  update trainings set stufen = p_stufen where id = p_training_id;

  with ziel as (
    select te.id,
      case when v_schema_neu = 'junioren' then
        case
          when te.trainingsteil = 'einleitung' then 'jun-aufwaermen'
          when te.trainingsteil = 'hauptteil'
               and te.hauptteilkategorie in ('fussball-spielen-lernen','vielseitigkeit-erleben')
            then 'jun-spielformen'
          when te.trainingsteil = 'hauptteil'
               and te.hauptteilkategorie = 'fussball-spielen' then 'jun-spiel'
          when te.trainingsteil = 'ausklang' then 'jun-ausklang'
          else 'nacharbeit' -- auffangen (Z1), nacharbeit, Übriges (Z7)
        end
      else
        case
          when te.trainingsteil in ('jun-aufwaermen','jun-spielform-trainingsziel')
            then 'einleitung'
          when te.trainingsteil in ('jun-spielformen','jun-spiel') then 'hauptteil'
          when te.trainingsteil = 'jun-ausklang' then 'ausklang'
          else 'nacharbeit' -- jun-explosivitaet ohne KiFu-Entsprechung, nacharbeit
        end
      end as neu_teil,
      case when v_schema_neu = 'kifu' and te.trainingsteil = 'jun-spielformen'
             then 'fussball-spielen-lernen'
           when v_schema_neu = 'kifu' and te.trainingsteil = 'jun-spiel'
             then 'fussball-spielen'
           else null
      end as neu_hkat,
      row_number() over (
        -- Partition = ZIEL-Positionsraum: je Teil UND Hauptteilkategorie,
        -- weil plan_ex_pos_hauptteil auf (training_id, hauptteilkategorie,
        -- position) eindeutig ist — jun-spielformen und jun-spiel landen
        -- beim Rückwechsel beide in 'hauptteil' mit verschiedener Kategorie.
        partition by
          case when v_schema_neu = 'kifu' and te.trainingsteil = 'jun-spielformen'
                 then 'fussball-spielen-lernen'
               when v_schema_neu = 'kifu' and te.trainingsteil = 'jun-spiel'
                 then 'fussball-spielen'
               else '' end,
          case when v_schema_neu = 'junioren' then
            case
              when te.trainingsteil = 'einleitung' then 'jun-aufwaermen'
              when te.trainingsteil = 'hauptteil'
                   and te.hauptteilkategorie in ('fussball-spielen-lernen','vielseitigkeit-erleben')
                then 'jun-spielformen'
              when te.trainingsteil = 'hauptteil'
                   and te.hauptteilkategorie = 'fussball-spielen' then 'jun-spiel'
              when te.trainingsteil = 'ausklang' then 'jun-ausklang'
              else 'nacharbeit'
            end
          else
            case
              when te.trainingsteil in ('jun-aufwaermen','jun-spielform-trainingsziel')
                then 'einleitung'
              when te.trainingsteil in ('jun-spielformen','jun-spiel') then 'hauptteil'
              when te.trainingsteil = 'jun-ausklang' then 'ausklang'
              else 'nacharbeit'
            end
          end
        order by array_position(array[
            'auffangen','einleitung','hauptteil','ausklang',
            'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
            'jun-spielformen','jun-spiel','jun-ausklang','nacharbeit'
          ], te.trainingsteil),
          te.position
      ) as neu_pos
    from training_exercises te
    where te.training_id = p_training_id
  )
  update training_exercises te
  set trainingsteil = z.neu_teil,
      hauptteilkategorie = z.neu_hkat,
      -- Kollisionfreie Zwischenwerte: negative Positionen, dann sauber
      position = -z.neu_pos
  from ziel z
  where te.id = z.id;

  update training_exercises
  set position = -position
  where training_id = p_training_id and position < 0;

  -- Ein öffentliches Training, das die Bedingungen des neuen Schemas nicht
  -- mehr erfüllt, wird zurückgezogen; die App informiert (Story 3 PC 5).
  if v_visibility = 'public'
     and coalesce(array_length(training_fehlende_bedingungen(p_training_id), 1), 0) > 0
  then
    update trainings set visibility = 'private' where id = p_training_id;
    return jsonb_build_object('status', 'ok', 'wechsel', true, 'zurueckgezogen', true);
  end if;

  return jsonb_build_object('status', 'ok', 'wechsel', true, 'zurueckgezogen', false);
end;
$$;

revoke all on function set_training_stufen(uuid, text[]) from public;
grant execute on function set_training_stufen(uuid, text[]) to authenticated;
```

Hinweis zur Positions-Neuvergabe: das Zwei-Schritt-Update über negative Werte umgeht die Unique-Kollision während der Umsortierung (dasselbe Muster wie `move_plan_exercise` mit `position = -1`). Der `te_schema_gate`-Trigger feuert bei `update of trainingsteil` — die zweite (nur-Position-)Anweisung berührt ihn nicht.

Wechselwirkung mit den bestehenden `oeffentlich`-Gates (`20260826172000`): beide sind `constraint trigger … deferrable initially deferred` und WERFEN beim Commit, wenn ein öffentliches Training die Bedingungen verletzt. Darum MUSS der RPC ein betroffenes öffentliches Training noch VOR dem Transaktionsende selbst auf privat setzen (genau das tut der Block oben) — sonst bricht der Wechsel beim Commit mit `TRAINING_UNVOLLSTAENDIG` ab, statt Story 3 PC 5 zu erfüllen. Die Gates selbst bleiben unangetastet (Umbau erst in Task 12).

- [ ] **Step 3: DB-Tests grün**

```bash
cd web && npm run db:reset && npm run seed && npm run gen:types && npm run typecheck
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 <<'SQL'
-- Mischverbot greift
do $$ begin
  begin
    insert into trainings (name, owner_id, stufen)
      values ('misch', (select id from auth.users limit 1), '{E,D}');
    raise exception 'Mischverbot hat NICHT gegriffen';
  exception when check_violation then null;
  end;
end $$;

-- Schema-Funktion
select case when training_schema('{}') = 'kifu'
            and training_schema('{G,F}') = 'kifu'
            and training_schema('{D}') = 'junioren'
       then 'ok' else 'FEHLER' end as schema_fn;

-- Wechsel-Übertragung: KiFu-Training mit 4 Einordnungen bauen und wechseln
insert into trainings (id, name, owner_id, stufen)
  values ('0f0e0d0c-0b0a-4908-8706-050403020100'::uuid, 'wechseltest',
          (select id from auth.users limit 1), '{E}');
insert into training_exercises (training_id, trainingsteil, hauptteilkategorie, position, name)
values
  ('0f0e0d0c-0b0a-4908-8706-050403020100', 'auffangen',  null, 1, 'a'),
  ('0f0e0d0c-0b0a-4908-8706-050403020100', 'einleitung', null, 1, 'b'),
  ('0f0e0d0c-0b0a-4908-8706-050403020100', 'hauptteil',  'fussball-spielen-lernen', 1, 'c'),
  ('0f0e0d0c-0b0a-4908-8706-050403020100', 'ausklang',   null, 1, 'd');
SQL
```

Achtung: die feste UUID oben ist illustrativ — im echten Test `gen_random_uuid()` in eine psql-Variable legen (`select gen_random_uuid() as tid \gset`). Der RPC-Test selbst braucht `auth.uid()` und läuft darum als direkter UPDATE-Pfad-Test der internen Logik ODER per PostgREST-Call mit dem Access-Token des E2E-Users; einfachster Weg: den Wechsel in Task 8 über die App-UI end-to-end testen und hier nur die Bausteine (Constraint, Trigger, Funktion, Gate) SQL-seitig prüfen:

```sql
-- Schema-Gate: Junioren-Block in KiFu-Training scheitert
do $$ begin
  begin
    insert into training_exercises (training_id, trainingsteil, position, name)
      values ((select id from trainings where name='wechseltest'), 'jun-spiel', 9, 'x');
    raise exception 'Schema-Gate hat NICHT gegriffen';
  exception when raise_exception then null;
  end;
end $$;

-- Bedingungsfunktion KiFu: Es fehlt das freie Spiel
select training_fehlende_bedingungen((select id from trainings where name='wechseltest'));
-- erwartet: {freies_spiel}
```

- [ ] **Step 4: Seed-Regressionstest**

Run: `cd web && npm run seed` (zweiter Lauf, idempotent) — Erwartet: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_junioren_schema.sql web/lib/database.types.ts
git commit -m "feat(db): Junioren-Schema — Mischverbot, Block-Einordnung, Schema-Gate, Bedingungsfunktion und Wechsel-RPC"
```

---

### Task 7: VALIDATE-Migration Mischverbot

**Files:**
- Create: `supabase/migrations/<timestamp>_junioren_schema_validate.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- ============================================================================
-- Story 3 (Epic #71): Mischverbot validieren
-- ============================================================================
-- Das Mischverbot kam als NOT VALID (neue Invariante auf bestehender Tabelle,
-- CLAUDE.md-Regel). Der Bestand erfüllt es per Konstruktion: vor diesem Epic
-- liess training_valid_stufen nur {G,F,E} zu. VALIDATE nimmt nur SHARE UPDATE
-- EXCLUSIVE — kein Schreib-Lock auf trainings.
alter table trainings validate constraint training_stufen_ein_schema;
```

- [ ] **Step 2: Prüfen und committen**

```bash
cd web && npm run db:reset && npm run seed
git add supabase/migrations/*_junioren_schema_validate.sql
git commit -m "feat(db): Mischverbot der Alterskategorien validieren"
```

---

### Task 8: UI — Schema-Wechsel mit Bestätigung und Nacharbeits-Bereich

**Files:**
- Modify: `web/lib/actions/trainings.ts` (`setTrainingStufen` auf die RPC `set_training_stufen` umstellen — `validStufen` ist bereits vokabularbasiert (`kategorienSlugs`), wächst also mit; `createTraining`: `stufenMischen`-Guard mit Klartext-Fehler ergänzen)
- Modify: `web/components/training/TrainingEditor.tsx` (Stufen-Änderung: Wechsel-Erkennung, Bestätigungsdialog, Nacharbeits-Bereich, Schema-Badge)
- Modify: `web/components/training/StufenField.tsx` (neue optionale Prop `disabledKeys?: KategorieSlug[]` + `title`-Tooltip — die Sperr-Logik braucht sie; heute gibt es nur `value`/`onChange`/`className`)
- Modify: `web/components/training/TrainingCreateForm.tsx` (dieselbe Sperr-Logik beim Anlegen — sonst quittiert die DB G+D mit einem rohen `training_stufen_ein_schema`-Fehler)
- Modify: `web/lib/queries/trainings.ts` (Typ `TrainingExerciseItem.trainingsteil` von `TrainingsteilSlug` auf `Einordnung` aus `@/lib/junioren` weiten; `teilRank` um Junioren-Blöcke + nacharbeit ergänzen)

**Interfaces:**
- Consumes: `schemaAusStufen`, `stufenMischen`, `abbildungKifuZuJunioren`, `abbildungJuniorenZuKifu`, `NACHARBEIT` (Task 5); RPC `set_training_stufen` (Task 6).
- Produces: `setTrainingStufen(trainingId, stufen)` Server Action mit Resultat `{ ok: true; zurueckgezogen: boolean } | { ok: false; error: string }`.

- [ ] **Step 1: Server Action umstellen**

In `web/lib/actions/trainings.ts` den Körper von `setTrainingStufen` ersetzen: statt direktem `update trainings set stufen` neu

```ts
const supabase = await createClient();
const { data, error } = await supabase.rpc("set_training_stufen", {
  p_training_id: trainingId,
  p_stufen: stufen,
});
if (error) return { ok: false as const, error: fehlerMeldung(error.message) };
revalidatePath(`/training/${trainingId}/edit`);
// mismatched (Übungen ausserhalb der neuen Stufen) wie bisher NACH dem
// Speichern berechnen — der bestehende Dialog im Editor liest r.mismatched
// (TrainingEditor.tsx:121) und bleibt für Änderungen INNERHALB eines Schemas
// unverändert (Story 3 OoS 2).
const mismatched = await berechneMismatched(supabase, trainingId, stufen); // bestehende Logik aus dem alten Funktionskörper (Zeilen ~381–396) extrahieren
return {
  ok: true as const,
  mismatched,
  zurueckgezogen: Boolean((data as { zurueckgezogen?: boolean })?.zurueckgezogen),
};
```

Die bestehende mismatched-Ermittlung aus dem alten Funktionskörper als Helfer `berechneMismatched` erhalten — der Editor-Aufrufer erwartet sie weiterhin.

- [ ] **Step 2: Wechsel-Erkennung + Bestätigungsdialog im Editor**

In `TrainingEditor.tsx`, beim Stufen-Ändern (dort, wo `setTrainingStufen` aufgerufen wird):

```ts
const schemaAlt = schemaAusStufen(training.stufen);
const schemaNeu = schemaAusStufen(naechsteStufen);
const istWechsel = schemaAlt !== schemaNeu;
const hatFassungen = training.exercises.length > 0;
```

- `stufenMischen(naechsteStufen)` ⇒ Auswahl gar nicht erst zulassen: `StufenField` bekommt `disabledKeys` (neue Prop, siehe Files) — im Editor UND im Anlegen-Formular werden die Chips des jeweils anderen Schemas deaktiviert, sobald eine Kategorie gewählt ist, mit Tooltip «Kinder- und Juniorenfussball lassen sich in einem Training nicht mischen» (AC 4; die DB bleibt Trust-Boundary, `createTraining` prüft zusätzlich `stufenMischen`).
- `istWechsel && !hatFassungen` ⇒ direkt speichern, kein Dialog (AC 7).
- `istWechsel && hatFassungen` ⇒ `Dialog` (UI-Kit) öffnen: Titel «Trainingsschema wechseln?», Text nennt Ziel-Schema; Liste der Fassungen, deren Vorschau-Abbildung `NACHARBEIT` ergibt (Vorschau lokal via `abbildungKifuZuJunioren` bzw. `abbildungJuniorenZuKifu` über `training.exercises`), mit Hinweis «Diese Übungen haben im neuen Schema keine Entsprechung und landen in der Nacharbeit» (AC 5/6). Bestätigen ⇒ Action; Abbrechen ⇒ nichts (PC 2).
- Resultat `zurueckgezogen === true` ⇒ Snackbar «Das Training wurde auf privat gesetzt, weil es die Bedingungen seines neuen Schemas nicht mehr erfüllt.» (PC 5).

- [ ] **Step 3: Nacharbeits-Bereich rendern**

Im Editor unterhalb der Trainingsteil-Sektionen (beide Schemata — Nacharbeit ist schema-neutral):

```tsx
{nacharbeit.length > 0 && (
  <section aria-label="Nacharbeit"
    className="rounded-lg border-[1.5px] border-error p-4">
    <h2 className="type-title-medium text-error">Nacharbeit</h2>
    <p className="type-body-small">
      Diese Übungen haben im aktuellen Schema keine Entsprechung. Ordne sie einem
      Block zu oder entferne sie — solange sie hier liegen, lässt sich das
      Training nicht veröffentlichen.
    </p>
    {/* dieselbe Zeilen-Darstellung wie in den Teil-Sektionen, mit den
        bestehenden Aktionen «Einordnung ändern» und «Entfernen» */}
  </section>
)}
```

mit `const nacharbeit = training.exercises.filter((e) => e.trainingsteil === NACHARBEIT);`. Die Auflösung (AC-Verhalten PC 4) braucht keinen neuen Mechanismus: Einordnung ändern oder Entfernen benutzt die bestehenden Fassungs-Aktionen; kein manuelles Abhaken (OoS 3).

- [ ] **Step 4: Schema-Badge**

Im Editor-Kopf neben den Stufen: `<Badge>{schemaAusStufen(training.stufen) === "junioren" ? "Juniorenfussball" : "Kinderfussball"}</Badge>` (Story 4 AC 2 / NFR 4 — sofort mitliefern, dann ist die Erkennbarkeit ab dem ersten Junioren-Rendering da).

- [ ] **Step 5: E2E**

Browser: (1) KiFu-Training mit Auffangen+Einleitung+Hauptteil+Ausklang-Übungen bauen. (2) Stufe auf D wechseln ⇒ Dialog listet genau die Auffangen-Übung als «ohne Entsprechung»; bestätigen ⇒ Editor zeigt Junioren-Struktur (Task 9 liefert die volle Gliederung; bis dahin genügt: keine Fehlleitung, Nacharbeits-Bereich zeigt die Auffangen-Fassung). (3) Abbrechen-Pfad: Training unverändert. (4) Leeres Training wechselt ohne Dialog. (5) G+D zusammen nicht wählbar.

- [ ] **Step 6: Commit**

```bash
git add -A web/
git commit -m "feat(trainings): Schema-Wechsel mit Bestätigung, Nacharbeits-Bereich und Schema-Badge"
```

---

### Task 9: UI — Junioren-Editor: drei Teile, sechs Unterblöcke, Picker, Vorschlag

**Files:**
- Modify: `web/lib/training.ts` (schema-generische Gruppierung)
- Modify: `web/components/training/TrainingEditor.tsx` (Junioren-Rendering)
- Modify: `web/components/training/ExercisePickerDialog.tsx` (Angebot je Block)
- Modify: `web/lib/actions/trainings.ts` (`addTrainingExercise`, `pickExercises`: Ziel-Einordnung = Junioren-Block zulassen)
- Modify: `web/lib/queries/exercises.ts` (Picker-Query: Übungen je Junioren-Block über die Abbildungsregel anbieten)
- Modify: `web/components/training/TrainingExerciseDetail.tsx` + `web/app/training/[id]/uebung/…` (Fassungs-Detail: «Einordnung ändern» bietet im Junioren-Schema die sechs Blöcke an)

**Interfaces:**
- Consumes: `JUNIOREN_TEILE`, `JUNIOREN_BLOCK_SLUGS`, `vorschlagEinordnung`, `NACHARBEIT`, Typ `Einordnung` (Task 5); erweiterter DB-Wertebereich (Task 6).
- Produces: `groupJunioren(items)` in `web/lib/training.ts`:

```ts
export function groupJunioren<T extends { trainingsteil: string; durationMin: number | null }>(
  items: T[],
): {
  slug: "einstieg" | "hauptteil" | "abschluss";
  label: string;
  sum: number;
  bloecke: { slug: JuniorenBlockSlug; label: string; items: T[]; sum: number }[];
}[];
```

- [ ] **Step 1: Gruppierung implementieren**

In `web/lib/training.ts` (Import `JUNIOREN_TEILE` aus `@/lib/junioren`):

```ts
/** Junioren-Zuordnungen nach Teil→Unterblock gruppieren (feste Reihenfolge,
 *  Story 4 AC 1 / 5a AC 1–3). Items kommen positionssortiert; die Teil-Summe
 *  ist die Summe seiner Blöcke. Nacharbeit gehört NICHT hierher — sie wird
 *  vorab herausgefiltert und gesondert gerendert (Story 4 AC 9). */
export function groupJunioren<
  T extends { trainingsteil: string; durationMin: number | null },
>(items: T[]) {
  return JUNIOREN_TEILE.map((teil) => {
    const bloecke = teil.bloecke.map(({ slug, label }) => {
      const blockItems = items.filter((i) => i.trainingsteil === slug);
      const sum = blockItems.reduce((a, i) => a + (i.durationMin ?? 0), 0);
      return { slug, label, items: blockItems, sum };
    });
    return {
      slug: teil.slug,
      label: teil.label,
      sum: bloecke.reduce((a, b) => a + b.sum, 0),
      bloecke,
    };
  });
}
```

Zusätzlich `leseBloecke` NICHT anfassen (KiFu-Pfad); Junioren-Leseansichten bekommen in Task 13 eine eigene Ableitung aus `groupJunioren`.

- [ ] **Step 2: Editor verzweigen**

In `TrainingEditor.tsx`: `const schema = schemaAusStufen(training.stufen);`. Der bestehende `TRAININGSTEILE.map(...)`-Block (Zeile ~260) wird zum KiFu-Zweig; daneben ein Junioren-Zweig über `groupJunioren(training.exercises.filter((e) => e.trainingsteil !== NACHARBEIT))`:

- Jeder Teil eine Sektion mit Label + Teil-Dauersumme (Story 4 AC 8); darunter je Unterblock eine Box mit Label, Block-Summe, Zuordnungszeilen (identische Zeilen-Komponente wie KiFu: Reihenfolge ändern, Dauer, Entfernen, Detail-Link) und «Übung hinzufügen»-Button, der den Picker mit `block`-Kontext öffnet (5a AC 3/4).
- Reihenfolge ändern: bestehende Action `moveTrainingExercise` funktioniert unverändert (Positions-Nachbarschaft je `trainingsteil`-Wert = je Block; 5a AC 5).
- Leere Blöcke `LEER_HINWEIS_BLOECKE` zeigen den Hinweis-Stil des bestehenden KiFu-Hinweises («Noch keine Übung im freien Spiel»): «Noch keine Übung im Block …» (5a AC 8; blockiert nichts, AC 9).
- Alle drei Teile tragen Dauer — `teilTraegtDauer` gilt nur für KiFu-`auffangen`; im Junioren-Zweig keine Sonderfälle (Faktenlage Story 4).
- Keine Anzahl-Hinweise im Junioren-Zweig (PO dauerhaft; `ANZAHL_HINWEIS` bleibt KiFu-only).

- [ ] **Step 3: Picker je Block**

`ExercisePickerDialog` erhält statt `teil`/`hkat` einen generischen Kontext `einordnung: Einordnung`. Angebots-Query in `web/lib/queries/exercises.ts` (neue Funktion neben der bestehenden Picker-Query):

```ts
/** Welche Heimat-Kombinationen bietet der Picker für eine Ziel-Einordnung an?
 *  Umkehrung der Abbildungsregel (Entscheidungsdokument §2/§4). */
export function heimatFilterFuerEinordnung(einordnung: string): {
  trainingsteile: string[];
  hauptteilkategorien: string[] | null; // null = keine Einschränkung
} {
  switch (einordnung) {
    // KiFu-Blöcke: wie bisher gleicher Trainingsteil; Einleitung bietet
    // zusätzlich die rückabgebildeten Junioren-Heimaten an (Story 5b PC 2)
    case "einleitung":
      return { trainingsteile: ["einleitung", "jun-aufwaermen", "jun-spielform-trainingsziel"], hauptteilkategorien: null };
    case "auffangen":
    case "hauptteil":
    case "ausklang":
      return { trainingsteile: [einordnung], hauptteilkategorien: null };
    // Junioren-Blöcke gemäss Abbildungsregel
    case "jun-aufwaermen":
      return { trainingsteile: ["einleitung", "jun-aufwaermen"], hauptteilkategorien: null };
    case "jun-spielform-trainingsziel":
      return { trainingsteile: ["jun-spielform-trainingsziel"], hauptteilkategorien: null };
    case "jun-explosivitaet":
      return { trainingsteile: ["jun-explosivitaet"], hauptteilkategorien: null };
    case "jun-spielformen":
      return { trainingsteile: ["hauptteil"], hauptteilkategorien: ["fussball-spielen-lernen", "vielseitigkeit-erleben"] };
    case "jun-spiel":
      return { trainingsteile: ["hauptteil"], hauptteilkategorien: ["fussball-spielen"] };
    case "jun-ausklang":
      return { trainingsteile: ["ausklang"], hauptteilkategorien: null };
    default:
      return { trainingsteile: [], hauptteilkategorien: null };
  }
}
```

Die Picker-Query wendet `in("trainingsteil", trainingsteile)` und optional `in("hauptteilkategorie", hauptteilkategorien)` an. Herkunfts-Transparenz (offene UX-Frage Story 4/5a): jede Picker-Zeile und jede Editor-Zeile zeigt einen kleinen Herkunfts-Chip mit dem Heimat-Label der Vorlage (z. B. «Einleitung», «Vielseitigkeit erleben», «Aufwärmen») — bei Fassungen aus dem gespeicherten `trainingsteil`/`hauptteilkategorie` der Fassung NICHT ableitbar, darum zeigt die Editor-Zeile stattdessen die Einordnungs-Abweichung: Chip nur, wenn `vorschlagEinordnung(...)`-Neuberechnung nicht möglich ist, entfällt — Entscheid: Picker-Zeilen zeigen den Heimat-Chip (Vorlage bekannt), Editor-Zeilen zeigen keinen (Fassung ist eigenständig; Abweichung blockiert nichts und wird nicht gesondert angezeigt — Epic-Entscheid, revidiert PO 2026-08-22).

- [ ] **Step 4: Zuordnen mit Vorschlag + Einordnung ändern**

- **Guard-Umbau (zwingend, sonst läuft der Picker ins Leere):** `addTrainingExercise` weist heute jede Übung ab, deren `trainingsteil` nicht EXAKT dem Ziel entspricht (`actions/trainings.ts:165` «Übung passt nicht zum Trainingsteil»), und `pickExercises` (`:551 ff.`) validiert gegen `TRAININGSTEIL_SLUGS`. Beide prüfen neu gegen `heimatFilterFuerEinordnung(einordnung)`: die Heimat der Vorlage muss in `trainingsteile` liegen (bei gesetzter `hauptteilkategorien`-Liste auch die Kategorie) — exakt dieselbe Regel wie das Picker-Angebot. Gültige Ziele: `TRAININGSTEIL_SLUGS ∪ JUNIOREN_BLOCK_SLUGS` (`nacharbeit` ist KEIN Zuordnungs-Ziel beim Hinzufügen). Beim Insert mit Junioren-Block setzt die Action `hauptteilkategorie: null` EXPLIZIT (der frühere phase_guard ist gedroppt; der Biconditional-CHECK würde sonst werfen). Der Picker wird aus einem Block heraus geöffnet ⇒ der Kontext IST der Vorschlag (Story 4 AC 4 / 5a AC 6: die Abbildungsregel bestimmt, wo eine Übung angeboten wird).
- «Einordnung ändern» (Fassungs-Detail/-Bearbeitung): im Junioren-Schema bietet das Einordnungs-Feld die sechs Block-Labels an statt der vier KiFu-Teile; Wert landet unverändert in `training_exercises.trainingsteil` (5a AC 7 — frei, blockiert nichts). Dafür wird `parseUebungsInhalt` parametrisiert — dieselbe Funktion validiert heute Bibliotheks-Übung UND Fassung, deren Wertebereiche jetzt auseinanderlaufen:

```ts
export function parseUebungsInhalt(
  form: FormData,
  opts: { einordnungen: readonly string[] }, // Bibliothek: 4 KiFu-Teile + 3 Junioren-Heimaten; Fassung: je Schema des Trainings (4 KiFu-Teile bzw. 6 Junioren-Blöcke)
): ParseResult
```

`ExerciseForm` erhält die erlaubten Einordnungen als Prop vom jeweiligen Aufrufer (Bibliotheks-Seite vs. Fassungs-Seite). Die Fassungs-Formular-Validierung (`web/lib/fassung.ts`, Funktion `fassungUnvollstaendig` — Namen am Bestand verifizieren) entscheidet heute über `brauchtFahrplan(einordnung, hkat)`; sie bekommt eine schema-bewusste Erweiterung: für die Junioren-Blöcke `jun-aufwaermen`/`jun-spielform-trainingsziel` gilt die Fahrplan-Regel (nur Offen starten Pflicht), für `jun-explosivitaet`/`jun-spiel`/`jun-ausklang` die Aufbau-Regel, für `jun-spielformen` die volle Fahrplan-Regel — die KiFu-Zweige bleiben WÖRTLICH unverändert (EK 16: keine Aufweichung der Einleitungs-/Hauptteil-Pflichten). Das Formular schlägt beim Öffnen die Einordnung über `vorschlagEinordnung(heimat, hkat, schema)` vor (Story 4 AC 4 / 5a AC 6 auch beim Umhängen). WICHTIG: Beim Speichern einer Fassung mit Junioren-Einordnung setzt die Action `hauptteilkategorie` EXPLIZIT auf `null` — der frühere phase_guard-Trigger, der das übernahm, ist seit `20260824120550` gedroppt; der Biconditional-CHECK würde sonst werfen.

- [ ] **Step 5: «In Bibliothek übernehmen» rückabbilden**

`uebernehmeInBibliothek` (`web/lib/actions/fassung.ts:218 ff.`) schreibt heute die EINORDNUNG der Fassung roh in `exercises.trainingsteil` — mit Junioren-Blöcken verletzte das den Heimat-CHECK (Task 10). Beim Übernehmen wird die Einordnung auf eine gültige Heimat abgebildet:

```ts
/** Einordnung im Training → Heimat der neuen Bibliotheks-Übung. */
function heimatAusEinordnung(einordnung: string, hkat: string | null):
  { trainingsteil: string; hauptteilkategorie: string | null } | null {
  if (TRAININGSTEIL_SLUGS.includes(einordnung as never))
    return { trainingsteil: einordnung, hauptteilkategorie: hkat };
  if ((juniorenHeimatSlugs as readonly string[]).includes(einordnung))
    return { trainingsteil: einordnung, hauptteilkategorie: null }; // Heimat-fähige Blöcke 1:1
  const rueck = abbildungJuniorenZuKifu(einordnung); // jun-spielformen/-spiel/-ausklang
  return rueck === NACHARBEIT ? null : rueck;
}
```

`null` (Einordnung `nacharbeit`) ⇒ Übernehmen mit Klartext ablehnen: «Ordne die Übung zuerst einem Block zu.» Achtung Inhalts-Kompatibilität: eine aus `jun-spielformen` übernommene Fassung trägt einen Fahrplan und landet als Hauptteil/Fussball-spielen-lernen-Übung — konsistent mit `ablauf_je_einordnung`; eine aus `jun-spiel` übernommene bräuchte als freies Spiel einen `aufbau` — hat die Fassung nur einen Fahrplan, greift `ueberfuehreAblauf` (bestehender Text-Umzug), analog zum heutigen Einordnungs-Wechsel.

- [ ] **Step 6: Typen weiten**

`web/lib/queries/trainings.ts`: `trainingsteil: TrainingsteilSlug` → `trainingsteil: Einordnung`; `teilRank` um `JUNIOREN_BLOCK_SLUGS` und `NACHARBEIT` (ans Ende) erweitern, damit die Sortierung stabil bleibt. Typecheck treibt die restlichen Anpassungen (Verwendungsstellen, die `TrainingsteilSlug` erwarten).

- [ ] **Step 7: E2E**

Browser: (1) D-Training anlegen ⇒ Editor zeigt Einstieg (3 Blöcke), Hauptteil (2), Abschluss (1), alle sichtbar auch leer (5a AC 3). (2) Aus «Spielformen und unterstützende Übungen» den Picker öffnen ⇒ 54 Manual-Übungen angeboten; aus «Spiel» ⇒ 1; aus «Aufwärmen» ⇒ 12 (Bestand gemäss Abbildungsregel §3). «Spielform zum Trainingsziel»/«Explosivität» ⇒ leer (erst nach Task 10 befüllbar). (3) Zuordnen, Dauer erfassen, Summen je Block und Teil korrekt. (4) Reihenfolge im Block ändern, neu laden ⇒ stabil (PC 1). (5) Einordnung einer Fassung von Spielformen nach Spiel ändern ⇒ klappt, nichts blockiert.

- [ ] **Step 8: Commit**

```bash
git add -A web/
git commit -m "feat(trainings): Junioren-Editor mit drei Trainingsteilen, sechs Unterblöcken und Block-Picker"
```

---

### Task 10: Migration + Übungs-Editor — Junioren-Heimat (Story 5b)

**Files:**
- Create: `supabase/migrations/<timestamp>_junioren_heimat.sql`
- Modify: `web/lib/uebung-form.ts` (Heimat-Parsing/Validierung)
- Modify: `web/lib/labels.ts` (`brauchtFahrplan` + Junioren-Heimaten)
- Modify: `web/components/exercise/ExerciseForm.tsx` (Heimat-Wahl)
- Modify: `web/lib/queries/exercises.ts` (Katalog: Heimat-Label anzeigen/filtern)
- Generated: `web/lib/database.types.ts`

**Interfaces:**
- Consumes: Vokabular `junioren_heimat` (Task 2).
- Produces: `exercises.trainingsteil` akzeptiert die drei Junioren-Heimaten; `brauchtFahrplan("jun-aufwaermen", null) === true`.

- [ ] **Step 1: Migration schreiben**

```sql
-- ============================================================================
-- Story 5b (Epic #71): Junioren-Heimat für Übungen
-- ============================================================================
-- Die Heimat einer Übung bleibt die Spalte `trainingsteil` — erweitert um die
-- drei Einstiegs-Unterblöcke (Entscheidungsdokument §4: genau eine gepflegte
-- Heimat, nie beide Welten gleichzeitig; die Skalarität der Spalte garantiert
-- das strukturell, AC 2). Alle Erweiterungen sind schwächere Regeln als ihre
-- Vorgänger — Drop + Add in einer Transaktion, forward-only-sicher.

set lock_timeout = '5s'; -- Lock-Schranke an den Dateianfang (Memory-Regel)

alter table exercises drop constraint exercises_trainingsteil_check;
alter table exercises add constraint exercises_trainingsteil_check
  check (trainingsteil in (
    'auffangen','einleitung','hauptteil','ausklang',
    'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet'
  ));

-- Hauptteilkategorie bleibt «genau bei hauptteil» — Junioren-Heimaten tragen
-- keine; der bestehende Constraint hauptteilkategorie_genau_bei_hauptteil
-- deckt das unverändert ab (Bedingung `trainingsteil = 'hauptteil'`).

-- Ablauf-Form je Heimat (AC 3–5): Aufwärmen und Spielform zum Trainingsziel
-- tragen den methodischen Fahrplan, Explosivität einen Aufbau-Text.
alter table exercises drop constraint ablauf_je_einordnung;
alter table exercises add constraint ablauf_je_einordnung check (
  case
    when hauptteilkategorie = 'fussball-spielen'
      then coalesce(btrim(aufbau), '') <> '' and methodischer_fahrplan is null
    when trainingsteil in ('einleitung', 'hauptteil',
                           'jun-aufwaermen', 'jun-spielform-trainingsziel')
      then methodischer_fahrplan is not null
    else coalesce(btrim(aufbau), '') <> ''
  end
);

-- Fahrplan-Vollständigkeit: Für KiFu-Heimaten bleiben alle drei Stufen
-- Pflicht; für die Junioren-Heimaten ist NUR «Offen starten» Pflicht
-- (PO 2026-08-16 — Körperstabilitäts-Drills haben keinen Wettkampf-Abschluss).
alter table exercises drop constraint fahrplan_vollstaendig;
alter table exercises add constraint fahrplan_vollstaendig check (
  case
    when trainingsteil in ('jun-aufwaermen', 'jun-spielform-trainingsziel')
      then coalesce(methodischer_fahrplan->>'offen_starten', '') <> ''
    when trainingsteil in ('einleitung', 'hauptteil')
         and hauptteilkategorie is distinct from 'fussball-spielen'
      then coalesce(methodischer_fahrplan->>'offen_starten', '') <> ''
        and jsonb_typeof(methodischer_fahrplan->'ueben') = 'array'
        and jsonb_array_length(methodischer_fahrplan->'ueben') >= 1
        and coalesce(methodischer_fahrplan->>'wetteifern', '') <> ''
    else true
  end
);

-- Erscheinungsform-Berechtigung (Story 12-Vorgriff, hier nur die Heimaten;
-- die Junioren-WERTE kommen mit der Erscheinungsformen-Migration):
-- neu auch an den drei Junioren-Heimaten erlaubt (PO 2026-08-17, inkl.
-- Explosivität — «Explosiv und dynamisch agieren» ist ihr 1:1 zugeordnet).
alter table exercises drop constraint erscheinungsform_nur_haupt_einleitung;
alter table exercises add constraint erscheinungsform_nur_haupt_einleitung check (
  erscheinungsform = '{}'
  or trainingsteil in ('einleitung', 'hauptteil',
                       'jun-aufwaermen', 'jun-spielform-trainingsziel',
                       'jun-explosivitaet')
);
```

WICHTIG vor dem Schreiben: die EXAKTEN Bestands-Definitionen von `exercises_trainingsteil_check` und `erscheinungsform_nur_haupt_einleitung` aus der lokalen DB ziehen (`psql -c "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'exercises'::regclass"`) und die neuen Fassungen daran ausrichten — die obigen Blöcke geben die Ziel-Semantik vor, die Alt-Anteile müssen wörtlich übernommen werden (z. B. prüft der bestehende Erscheinungsform-Constraint möglicherweise zusätzlich die erlaubten WERTE; dann die Werte-Liste um die 11 Junioren-Slugs NICHT hier, sondern erst in Task 17 erweitern, die Teil-Liste aber hier).

- [ ] **Step 2: DB-Test**

```bash
cd web && npm run db:reset && npm run seed && npm run gen:types
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 <<'SQL'
-- Junioren-Heimat mit nur Offen-starten: gültig
insert into exercises (slug, name, trainingsteil, kategorien, source, owner_id,
                       visibility, methodischer_fahrplan)
values ('t-aufw', 'Testaufwärmen', 'jun-aufwaermen', '{D}', 'user',
        (select id from auth.users limit 1), 'private',
        '{"offen_starten": "Lauf-ABC mit Ball", "ueben": [], "wetteifern": ""}');
-- Explosivität ohne Aufbau: scheitert
do $$ begin
  begin
    insert into exercises (slug, name, trainingsteil, kategorien, source, owner_id, visibility)
    values ('t-expl', 'Testsprint', 'jun-explosivitaet', '{D}', 'user',
            (select id from auth.users limit 1), 'private');
    raise exception 'ablauf_je_einordnung hat NICHT gegriffen';
  exception when check_violation then null;
  end;
end $$;
delete from exercises where slug in ('t-aufw','t-expl');
SQL
```

(Spaltenliste des Inserts vorab an der realen Tabellendefinition prüfen — `source`/`owner_id`/`visibility`-Namen aus `gen:types` übernehmen. `ueben: []` muss der Constraint zulassen: für Junioren-Heimaten wird nur `offen_starten` geprüft.)

- [ ] **Step 3: App-Logik**

`web/lib/labels.ts`:

```ts
// Heimaten mit methodischem Fahrplan: KiFu Einleitung/Hauptteil sowie die
// Junioren-Heimaten Aufwärmen und Spielform zum Trainingsziel (Story 5b AC 3).
export const FAHRPLAN_TEILE = new Set<string>([
  "einleitung", "hauptteil", "jun-aufwaermen", "jun-spielform-trainingsziel",
]);
```

(`brauchtFahrplan` funktioniert damit unverändert; Explosivität fällt in den Aufbau-Zweig.)

`web/lib/uebung-form.ts` — `parseUebungsInhalt`:
- Gültige Heimaten: `[...trainingsteilSlugs, ...juniorenHeimatSlugs]`.
- `istHauptteil` bleibt `trainingsteil === "hauptteil"` (Junioren-Heimaten tragen keine Hauptteilkategorie).
- Fahrplan-Pflicht aufsplitten: bei `jun-aufwaermen`/`jun-spielform-trainingsziel` ist NUR `offen_starten` Pflicht, `ueben`/`wetteifern` optional (AC 3/4):

```ts
const istJuniorenFahrplan =
  trainingsteil === "jun-aufwaermen" || trainingsteil === "jun-spielform-trainingsziel";
if (istFahrplan) {
  const offen = clean(form.get("offen_starten"));
  const ueben = lines(form.get("ueben"));
  const wett = clean(form.get("wetteifern"));
  if (!offen) errors.offen_starten = "Bitte beschreiben, wie die Übung offen startet.";
  if (!istJuniorenFahrplan && ueben.length === 0)
    errors.ueben = "Bitte mindestens einen Übungsschritt angeben.";
  if (!istJuniorenFahrplan && !wett)
    errors.wetteifern = "Bitte den Wett-eifern-Teil beschreiben.";
  methodischer_fahrplan = { offen_starten: offen, ueben, wetteifern: wett };
}
```

- Erscheinungsform-Berechtigung: `FAHRPLAN_TEILE.has(trainingsteil) || trainingsteil === "jun-explosivitaet"` (Explosivität: Aufbau-Text UND Erscheinungsform erlaubt — Nachtrag 2026-08-17).

- [ ] **Step 4: ExerciseForm — Heimat-Wahl**

Das bestehende Trainingsteil-Feld (heute ein `SegmentedControl` mit 4 Optionen, `ExerciseForm.tsx:196-201`) wird zur Heimat-Wahl mit zwei beschrifteten Gruppen «Kinderfussball» / «Juniorenfussball — Einstieg» (UX-Entscheid: eine Wahl, verständlich für Trainer, die nur eine Welt kennen). Das UI-Kit-`Select` ist eine M3-Listbox mit flacher `options: SelectOption[]`-Prop — KEIN natives `<select>`, kein `optgroup`, keine Children. Styleguide-first: `SelectOption` um ein optionales `group?: string` erweitern (die Listbox rendert Gruppen-Header als nicht-wählbare Zeilen), im Styleguide dokumentieren, dann:

```tsx
const heimatOptions: SelectOption[] = [
  ...TRAININGSTEILE.map(({ slug, label }) => ({ value: slug, label, group: "Kinderfussball" })),
  ...juniorenHeimatSlugs.map((slug) => ({
    value: slug, label: junioren_heimat[slug], group: "Juniorenfussball — Einstieg",
  })),
];
<Select name="trainingsteil" label="Heimat" options={heimatOptions} defaultValue={...} />
```

(7 Werte sprengen das `SegmentedControl`; der Wechsel des Feld-Typs ist Teil dieses Tasks und wird im Styleguide begründet.)

Feld-Umschaltung: Junioren-Heimaten zeigen KEINE Hauptteilkategorie; `jun-explosivitaet` zeigt das Aufbau-Feld («Aufbau»), die anderen beiden den Fahrplan mit Pflicht-Markierung nur an «Offen starten». Heimat-Wechsel einer bestehenden Übung (AC 7): das Formular zeigt die Pflichtfelder der neuen Heimat; `ueberfuehreAblauf` (labels.ts) übernimmt den Text zwischen Fahrplan und Aufbau wie beim bestehenden KiFu-Wechsel; die Action entfernt beim Speichern unzulässige Angaben (PC 4 — das leistet ALLEIN `parseUebungsInhalt`, das je Heimat vollständige Werte in `row` schreibt: `hauptteilkategorie: null` ausserhalb des Hauptteils, `erscheinungsform: []` wo keine erlaubt ist, Fahrplan ODER Aufbau je Heimat — einen DB-Guard dafür gibt es seit dem Verweis-Abbau nicht mehr).

- [ ] **Step 5: Katalog + Picker-Angebot prüfen**

- Übungs-Detail/Katalog-Karte zeigt das Heimat-Label (`junioren_heimat[slug] ?? trainingsteil[slug]`).
- Katalog-Filter «Trainingsteil»: um die drei Junioren-Heimaten erweitern (Options-Gruppen wie im Formular).
- Picker: Task-9-Mapping greift jetzt — «Explosivität»-Block bietet die neue Übung an; KiFu-Einleitung bietet `jun-aufwaermen`/`jun-spielform-trainingsziel`-Übungen an (PC 2), Explosivitäts-Übungen erscheinen in keinem KiFu-Block (PC 3).

- [ ] **Step 6: E2E**

Browser: (1) Übung mit Heimat «Explosivität» + Aufbau anlegen ⇒ gespeichert. (2) Übung mit Heimat «Aufwärmen», nur Offen starten ⇒ gespeichert. (3) D-Training: Explosivitäts-Block bietet (1) an, Aufwärmen-Block bietet (2) UND die 12 Einleitungs-Übungen an. (4) KiFu-Training: Einleitung bietet (2) an, (1) nirgends. (5) Heimat von (2) auf «Hauptteil» wechseln ⇒ Pflichtfelder (Kategorie, volle Fahrplan-Stufen) werden verlangt.

- [ ] **Step 7: Commit**

```bash
git add -A web/ supabase/
git commit -m "feat(uebungen): Junioren-Heimat für die drei Einstiegs-Unterblöcke erfassen"
```

---

### Task 11: Zeit-Abgleich im Junioren-Editor (Story 6)

**Files:**
- Create: `web/components/training/ZeitAbgleich.tsx`
- Modify: `web/components/training/TrainingEditor.tsx` (Einbau je Teil, je Block, gesamt)

**Interfaces:**
- Consumes: `BANDBREITEN`, `GESAMTDAUER_JUNIOREN` (Task 5); Summen aus `groupJunioren` (Task 9).

- [ ] **Step 1: Komponente schreiben**

```tsx
import { BANDBREITEN } from "@/lib/junioren";

/** Soll-Ist-Abgleich einer Dauer-Summe gegen die Bandbreite des Schemas
 *  (Story 6). Ohne erfasste Dauer nur der Richtwert, ohne Bewertung (AC 3);
 *  Grenzwerte zählen als innerhalb. Rein informativ — beeinflusst weder
 *  Speichern noch Veröffentlichen (AC 6). */
export function ZeitAbgleich({ slug, sum }: { slug: string; sum: number }) {
  const band = BANDBREITEN[slug];
  if (!band) return null;
  const richtwert = `Richtwert ${band.min}–${band.max} min`;
  if (sum === 0) return <span className="type-body-small text-on-surface-variant">{richtwert}</span>;
  const delta = sum < band.min ? sum - band.min : sum > band.max ? sum - band.max : 0;
  return (
    <span className="type-body-small text-on-surface-variant">
      {richtwert}
      {delta !== 0 && (
        <span className={delta < 0 ? "text-on-surface-variant" : "text-error"}>
          {" "}({delta > 0 ? `+${delta}` : delta} min)
        </span>
      )}
    </span>
  );
}
```

Gesamtdauer analog inline im Editor-Kopf: `Gesamt {sum} min · vorgesehen {GESAMTDAUER_JUNIOREN} min (±Abweichung)` — nur im Junioren-Schema (AC 4/5).

- [ ] **Step 2: Einbau + Verhalten**

Neben jeder Teil-Überschrift und jeder Block-Überschrift des Junioren-Zweigs `<ZeitAbgleich slug={...} sum={...} />`. Da der Editor Summen bereits live aus dem State ableitet, aktualisiert sich der Abgleich mit jeder Dauer-Änderung (PC 1); Zuordnungen ohne Dauer zählen nicht (bestehende Summenlogik, PC 2). KiFu-Zweig: nichts (OoS 1).

- [ ] **Step 3: E2E + Commit**

Browser: Aufwärmen-Block mit 5 min ⇒ «Richtwert 10–12 min (−5 min)»; 10 min ⇒ ohne Abweichungszusatz (Grenzwert innerhalb); 15 min ⇒ «(+3 min)»; leerer Block nur Richtwert; Gesamtzeile gegen 90 min; KiFu-Training zeigt nichts davon.

```bash
git add web/components/training/ZeitAbgleich.tsx web/components/training/TrainingEditor.tsx
git commit -m "feat(trainings): Zeitbandbreiten-Abgleich als Orientierung im Junioren-Editor"
```

---

### Task 12: Veröffentlichen je Schema (Story 7)

**Files:**
- Create: `supabase/migrations/<timestamp>_publish_junioren.sql`
- Modify: `web/lib/training-bedingungen.ts` (Bedingungen + Klartexte erweitern)
- Modify: `web/lib/actions/trainings.ts` (`fehlendeBedingungen` — schema-bewusst; Team-/Fremd-Sonderfälle unverändert)
- Modify: `web/components/training/TrainingEditor.tsx` (clientseitige Live-Vorprüfung aus dem lokalen State, `:167 ff.`)
- Modify: `web/components/training/SichtbarkeitControl.tsx` (Meldungen; nur prüfen, Logik lebt in Action und Editor)

**Interfaces:**
- Consumes: `training_fehlende_bedingungen` (Task 6), `JUNIOREN_PFLICHT_BLOECKE` (Task 5).
- Produces: `training_pruefe_oeffentlich` v2 (delegiert an `training_fehlende_bedingungen`); Gates prüfen damit je Schema.

- [ ] **Step 1: Migration schreiben**

Die bestehende Architektur bleibt stehen: `publish_training` EXISTIERT NICHT MEHR (ersatzlos gedroppt in `20260824195749_team_datenmodell.sql:309-310`) — Veröffentlichen ist heute ein direktes `update trainings set visibility='public'` in `veroeffentlicheTraining`, abgesichert durch die `deferrable initially deferred`-Gates. Diese Architektur wird NICHT angefasst: ersetzt wird ausschliesslich der Körper der zentralen Prüf-Funktion `training_pruefe_oeffentlich`, die beide Gates aufrufen. KEINE neue publish-RPC anlegen (Hygiene-Regel: keine Altlasten wiederbeleben).

```sql
-- ============================================================================
-- Story 7 (Epic #71): Veröffentlichen je Schema
-- ============================================================================
-- training_pruefe_oeffentlich (die Funktion hinter beiden oeffentlich-Gates)
-- stützt sich neu auf die eine Bedingungsfunktion
-- training_fehlende_bedingungen (Migration junioren_schema) — DB-Gate und
-- App-Vorabmeldung nennen damit dieselbe Regel.
-- KiFu-Bedingungen unverändert (Story 7 OoS 1); die Gate-Semantik bleibt
-- BLOCKIEREN (Ist-Verhalten seit dem Umschalten-Epic): eine Änderung, die ein
-- öffentliches Training unter die Bedingungen brächte, wird abgewiesen und
-- von der App erklärt («Setze es zuerst auf Entwurf …»). Auto-Privat gibt es
-- genau an den zwei spezifizierten Stellen: Schema-Wechsel (RPC, Story 3
-- PC 5) — und nirgendwo sonst (Plan-Entscheid, siehe Checkpoint unten).

create or replace function training_pruefe_oeffentlich(p_id uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_public boolean;
  v_missing text[];
begin
  select visibility = 'public' into v_public from trainings where id = p_id;
  -- Zeile weg: Kaskaden-Delete des ganzen Trainings — nichts zu prüfen.
  if v_public is null or not v_public then return; end if;

  v_missing := training_fehlende_bedingungen(p_id);
  if coalesce(array_length(v_missing, 1), 0) >= 1 then
    raise exception 'TRAINING_UNVOLLSTAENDIG: %', v_missing[1];
  end if;
end;
$$;

```

Das ist die GESAMTE Migration dieses Tasks — eine Funktion. `publish_training`-RPCs, Gate-Funktionen und Trigger bleiben unangetastet.

**CHECKPOINT (PO):** Story 7 PC 2 («setzt selbsttätig auf privat und informiert») entstammt einer inzwischen überholten Faktenlage — seit dem Umschalten-Epic BLOCKIERT die Datenbank solche Änderungen, statt still zurückzuziehen. Dieser Plan behält das Blockieren für beide Schemata bei (konsistent, kein Regressionsrisiko für KiFu); Auto-Privat bleibt auf den Schema-Wechsel beschränkt. Diese Abweichung von PC 2 dem PO explizit vorlegen (Stories sind Aufträge — die Abweichung wird dokumentiert, nicht stillschweigend umgangen).

- [ ] **Step 2: App-Bedingungen erweitern**

`web/lib/training-bedingungen.ts`:

```ts
export type Bedingung =
  | "stufe" | "einleitung" | "freies_spiel"
  | "jun-aufwaermen" | "jun-spielform-trainingsziel" | "jun-explosivitaet"
  | "jun-spielformen" | "jun-ausklang" | "nacharbeit";

export const BEDINGUNG_FEHLT: Record<Bedingung, string> = {
  stufe: "mindestens eine Alterskategorie",
  einleitung: "mindestens eine Übung in der Einleitung",
  freies_spiel: "mindestens eine Übung im freien Spiel",
  "jun-aufwaermen": "mindestens eine Übung im Aufwärmen",
  "jun-spielform-trainingsziel": "mindestens eine Übung in der Spielform zum Trainingsziel",
  "jun-explosivitaet": "mindestens eine Übung in der Explosivität",
  "jun-spielformen": "mindestens eine Übung in Spielformen und unterstützende Übungen",
  "jun-ausklang": "mindestens eine Übung im Ausklang",
  nacharbeit: "die Auflösung der offenen Nacharbeit",
};
```

`fehlendeBedingungen` in `actions/trainings.ts` (Server-Seite) und die clientseitige Live-Vorprüfung im Editor (`TrainingEditor.tsx:167 ff.` berechnet sie aus dem lokalen State — dort ist kein DB-Aufruf möglich, Supabase ist server-only): beide bleiben TS-Spiegelungen der Regel und werden um den Junioren-Zweig erweitert (Pflichtblöcke aus `JUNIOREN_PFLICHT_BLOECKE`, Nacharbeit). Die Team-/Fremd-Training-Sonderfälle der Server-Prüfung («Übernimm es zuerst …») bleiben unverändert — die DB-Funktion kann sie nicht ausdrücken. Drei Stellen, EINE Regel: DB-Funktion (Trust-Boundary), Server-Vorabprüfung, Client-Live-Anzeige — alle drei speisen sich aus `JUNIOREN_PFLICHT_BLOECKE` bzw. dem SQL-Pendant; der Kommentar-Querverweis in beiden Richtungen ist Pflicht, der Task-18-Paritäts-Assert prüft die DB-Seite.

- [ ] **Step 3: E2E**

Browser, D-Training: (1) Nur Spielformen+Ausklang belegt ⇒ Veröffentlichen nennt die drei fehlenden Einstiegs-Blöcke im Klartext (AC 3). (2) Alle fünf Pflichtblöcke belegt, Spiel leer ⇒ veröffentlichbar (AC 2). (3) Nacharbeits-Fassung vorhanden ⇒ blockiert mit eigener Meldung (AC 1/4). (4) Veröffentlicht, dann Aufwärmen-Fassung entfernen ⇒ Änderung wird BLOCKIERT mit Klartext-Meldung «Ein öffentliches Training braucht … Setze es zuerst auf Entwurf …» (Ist-Semantik; Abweichung von PC 2 siehe Checkpoint). (5) KiFu-Training: Bedingungen und Meldungen unverändert (OoS 1 — Regression!). (6) Wieder auf privat setzen jederzeit möglich (AC 5).

- [ ] **Step 4: Commit**

```bash
git add -A web/ supabase/
git commit -m "feat(trainings): Veröffentlichungsbedingungen je Trainingsschema"
```

---

### Task 13: Durchführung, Druck und Detailansicht für die Junioren-Struktur (Story 8)

**Files:**
- Modify: `web/lib/training.ts` (`leseBloeckeJunioren` — Lese-Ableitung aus `groupJunioren`)
- Modify: `web/components/training/TrainingDurchfuehren.tsx`
- Modify: `web/app/training/[id]/druck/page.tsx`
- Modify: `web/app/training/[id]/page.tsx` (Detailansicht folgt derselben Gliederung)

**Interfaces:**
- Consumes: `groupJunioren` (Task 9), `schemaAusStufen` (Task 5).
- Produces: `leseBloeckeJunioren(exercises)` — nur belegte Teile/Blöcke:

```ts
export function leseBloeckeJunioren<
  T extends { trainingsteil: string; durationMin: number | null },
>(items: T[]): {
  teilSlug: string; teilLabel: string; teilSum: number;
  bloecke: { key: string; label: string; sum: number; items: T[] }[];
}[] {
  return groupJunioren(items.filter((i) => i.trainingsteil !== NACHARBEIT))
    .map((teil) => ({
      teilSlug: teil.slug,
      teilLabel: teil.label,
      teilSum: teil.sum,
      bloecke: teil.bloecke
        .filter((b) => b.items.length > 0)
        .map((b) => ({ key: b.slug, label: b.label, sum: b.sum, items: b.items })),
    }))
    .filter((teil) => teil.bloecke.length > 0);
}
```

- [ ] **Step 1: Drei Ansichten verzweigen**

In allen drei Dateien: `const schema = schemaAusStufen(training.stufen);` — KiFu-Pfad (`groupByTeil` + `leseBloecke`) bleibt WÖRTLICH unverändert; Junioren-Pfad nutzt `leseBloeckeJunioren`:

- **Durchführung** (`TrainingDurchfuehren.tsx`): ein Trainingsteil pro Schritt (AC 1 — `sections` = die belegten Junioren-Teile); innerhalb des Schritts jeder Block mit eigener Überschrift + Blocksumme (AC 2/4 — Unterblock-Summen sind hier NEU, auch der KiFu-Hauptteil zeigt sie ab jetzt: `leseBloecke` liefert `sum` bereits, nur rendern). Unterblock-Zugehörigkeit beim Scrollen (AC 3): Block-Überschrift als `sticky top-0` innerhalb des Schritt-Containers.
- **Druck**: Junioren-Teile fortlaufend; Block-Überschriften als Unter-Ebene mit `break-inside-avoid` auf Block-Kopf+erster Übung (offene UX-Frage Umbruch: bestehende Regel «Übung nie zerreissen» unverändert lassen, zusätzlich Teil-Überschrift mit `break-after-avoid`).
- **Detailansicht**: identische Blockstruktur wie Druck.
- Nacharbeit und Zeitbandbreiten erscheinen in KEINER der drei Ansichten (OoS 1/2 — `leseBloeckeJunioren` filtert Nacharbeit bereits).
- Leere Blöcke/Teile: ausgeblendet, kein Hinweis (PC 1/2); Training ganz ohne Fassungen behält den bestehenden Hinweis (PC 3 — Bestandsverhalten, verifizieren).
- Fassungs-Angaben: identische Darstellungskomponente wie KiFu (AC 6 — nichts zu tun, gleiche Zeilen-Komponente); nicht erfasste Angaben erscheinen nicht als leere Felder (Bestandsverhalten der Detail-Darstellung prüfen).
- Schema-Kennzeichnung (Epic-NFR 4/5): Das Badge «Juniorenfussball»/«Kinderfussball» aus Task 8 erscheint auch im Kopf von Detailansicht, Druck und Durchführung — die Labels «Hauptteil» und «Ausklang» kommen in beiden Schemata vor und sind nur so eindeutig zuordenbar. Im Übungskatalog kennzeichnet die Heimat-Options-Gruppierung (Task 10) das Schema.

- [ ] **Step 2: E2E**

Browser, veröffentlichtes D-Training aus Task 12: (1) Durchführung: 3 Schritte (Einstieg/Hauptteil/Abschluss), Blöcke beschriftet, Blocksummen sichtbar, sticky Blocktitel beim Scrollen. (2) Druck-Vorschau (`/training/<id>/druck`): alle belegten Blöcke in Editor-Reihenfolge, Kopf mit Name/Stufen/Gesamtdauer. (3) Spiel-Block leer ⇒ taucht nirgends auf, kein Hinweis. (4) KiFu-Training: unverändert PLUS neu Unterblock-Summen in der Durchführung. (5) Als zweiter (nicht angemeldeter) Betrachter: öffentliches Junioren-Training ansehen/drucken.

- [ ] **Step 3: Commit**

```bash
git add -A web/
git commit -m "feat(trainings): Junioren-Struktur in Durchführung, Druck und Detailansicht"
```

---

### Task 14: Übungstyp (Story 9)

**Files:**
- Create: `supabase/migrations/<timestamp>_uebungstyp.sql`
- Modify: `web/lib/uebung-form.ts` (Feld parsen)
- Modify: `web/components/exercise/ExerciseForm.tsx` (Feld + Kurzdefinitionen)
- Modify: `web/lib/queries/exercises.ts` (Filter-Dimension `typ`)
- Modify: `web/components/catalog/CatalogFilterBar.tsx` (Filter)
- Modify: `web/components/training/ExercisePickerDialog.tsx` (Filter)
- Modify: `web/app/uebung/[slug]/page.tsx`, `web/components/training/TrainingExerciseDetail.tsx`, Druck-/Durchführungs-Detaildarstellung (Anzeige in den Detail-Angaben)
- Modify: `web/lib/fassung.ts` (`FASSUNG_INHALT_FELDER` + `"uebungstyp"` — Fassungen übernehmen und ändern den Typ unabhängig)
- Generated: `web/lib/database.types.ts`

**Interfaces:**
- Consumes: Vokabular `uebungstyp` (Task 2).
- Produces: Spalte `uebungstyp` auf `exercises` UND `training_exercises`; Filter-Param `typ` im Katalog und Picker.

- [ ] **Step 1: Migration**

```sql
-- ============================================================================
-- Story 9 (Epic #71): Übungstyp
-- ============================================================================
-- Optionales Attribut für alle Übungen und Fassungen (Manual Fussball
-- Jugendliche S. 56); kein Backfill (PO). Werte aus data/vokabular.yaml.
set lock_timeout = '5s'; -- Lock-Schranke an den Dateianfang (Memory-Regel)

alter table exercises add column uebungstyp text
  check (uebungstyp in ('basisspielform','spielform','isolierte-form'));
alter table training_exercises add column uebungstyp text
  check (uebungstyp in ('basisspielform','spielform','isolierte-form'));
```

- [ ] **Step 2: Erfassen mit Kurzdefinitionen**

`parseUebungsInhalt`: `const uebungstyp = clean(form.get("uebungstyp")); row.uebungstyp = uebungstypSlugs.includes(uebungstyp as never) ? uebungstyp : null;` (leerer Wert = entfernen, AC 2).

`ExerciseForm` (und Fassungs-Formular — beide nutzen dasselbe Inhalts-Formular): `Select` «Übungstyp (optional)» mit leerer Option «Kein Übungstyp»; darunter die Kurzdefinition des gewählten Typs im Manual-Wortlaut (S. 56), als Konstante:

```ts
export const UEBUNGSTYP_DEFINITION: Record<UebungstypSlug, string> = {
  basisspielform:
    "Die Referenzform eines Themas, die die taktischen Prinzipien sichtbar macht.",
  spielform: "Spielnahe Form mit Entscheidungsdruck.",
  "isolierte-form": "Isolierte Form ohne Entscheidungsdruck (im Manual: «Übung»).",
};
```

**CHECKPOINT (blockierend für den PR, analog Task 16):** den exakten Manual-Wortlaut von S. 56 aus `sources/junioren/Manual_Fussball_Jugendliche_d.pdf` ziehen und die drei Definitionen ERSETZEN (AC 4 verlangt Manual-Wortlaut; die obigen Sätze sind Platzhalter aus der Spec-Zusammenfassung) — dem PO zusammen mit den Task-16-Texten zur Abnahme vorlegen.

- [ ] **Step 3: Filter + Anzeige**

- Katalog: Dimension `typ` in `CatalogFilters`, `MultiSelect` «Alle Übungstypen»; Query: `if (typ.length) q = q.in("uebungstyp", typ)` — Übungen ohne Typ fallen bei aktivem Filter raus (PC 1, Standard-Dimensionslogik).
- Picker: gleicher Filter (AC 6).
- Anzeige NUR in Detail-Angaben (Übungs-Detail, Fassungs-Detail, Durchführung, Druck), NICHT auf Katalog-Karten (AC 7 / PC 2): Zeile «Übungstyp: Spielform».
- Freitextsuche unverändert (OoS 4).

- [ ] **Step 4: E2E + Commit**

Browser: Übung mit Typ anlegen, Kurzdefinition erscheint beim Wählen; Katalog nach Typ filtern (Übungen ohne Typ verschwinden); Typ an einer Fassung ändern ⇒ Vorlage unverändert (PC 3); Typ entfernen.

```bash
git add -A web/ supabase/
git commit -m "feat(uebungen): Übungstyp erfassen, filtern und in den Detail-Angaben zeigen"
```

---

### Task 15: Trainingsziel (Story 10)

**Files:**
- Create: `supabase/migrations/<timestamp>_trainingsziel.sql`
- Modify: `web/lib/actions/trainings.ts` (`createTraining` + neue Action `setTrainingZiel`)
- Modify: `web/components/training/TrainingCreateForm.tsx` (Ziel beim Anlegen, AC 2)
- Modify: `web/components/training/TrainingEditor.tsx` (Ziel anzeigen/ändern/entfernen)
- Modify: `web/app/training/[id]/page.tsx` (Detailansicht), `web/app/training/[id]/druck/page.tsx` (Druck-Kopf), `web/components/training/TrainingDurchfuehren.tsx` (nur Start-Schritt)
- Modify: `web/lib/queries/trainings.ts` (`ziel` in Select + Typ)
- Generated: `web/lib/database.types.ts`

- [ ] **Step 1: Migration**

```sql
-- ============================================================================
-- Story 10 (Epic #71): Trainingsziel
-- ============================================================================
-- Genau ein optionales Freitext-Ziel je Training, beide Schemata, max. 200
-- Zeichen (PO 2026-08-17). NULL = kein Ziel; die App normalisiert leere und
-- Nur-Leerzeichen-Eingaben zu NULL (PC 3), der CHECK sichert die Obergrenze.
set lock_timeout = '5s'; -- Lock-Schranke an den Dateianfang (Memory-Regel)

alter table trainings add column ziel text
  check (ziel is null or char_length(ziel) <= 200);
```

- [ ] **Step 2: Action + Normalisierung**

```ts
/** Ziel setzen/ändern/entfernen (Story 10 AC 1/3, PC 3): leer oder nur
 *  Leerzeichen ⇒ NULL. */
export async function setTrainingZiel(
  trainingId: string,
  ziel: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const wert = ziel.trim() === "" ? null : ziel.trim();
  if (wert && wert.length > 200)
    return { ok: false, error: "Das Ziel darf höchstens 200 Zeichen lang sein." };
  const { error } = await supabase
    .from("trainings")
    .update({ ziel: wert })
    .eq("id", trainingId);
  if (error) return { ok: false, error: fehlerMeldung(error.message) };
  revalidatePath(`/training/${trainingId}/edit`);
  return { ok: true };
}
```

`createTraining`: optionales Formularfeld `ziel` mit derselben Normalisierung. (RLS: Update läuft ownergeschützt über die bestehende Policy — kein RPC nötig, einspaltige Mutation.)

- [ ] **Step 3: Ansichten**

- Anlegen-Formular + Editor: `TextArea` «Ziel (optional)» mit `maxLength={200}` und Zeichenzähler.
- Detailansicht + Druck-Kopf: Bereich «Ziel» nur wenn vorhanden (PC 2); im Druck unter dem Kopf (Name/Stufen/Gesamtdauer, Faktenlage Story 10).
- Durchführung: nur im Start-Schritt (AC 5 / PC 4), als eigener Absatz unter dem Trainingsnamen mit Label «Ziel» (Abgrenzung vom Namen, offene UX-Frage).
- Trainings-Karten und -Suche: NICHT anfassen (PC 5 / OoS 5).

- [ ] **Step 4: E2E + Commit**

Browser: Training MIT Ziel anlegen; Ziel im Editor ändern; 201 Zeichen ⇒ Fehler; nur Leerzeichen ⇒ Bereich verschwindet überall; Betrachter eines veröffentlichten Trainings sieht das Ziel in Detail/Druck/Durchführung-Start (PC 1); Karte zeigt es nicht.

```bash
git add -A web/ supabase/
git commit -m "feat(trainings): optionales Trainingsziel von der Planung bis auf den Platz"
```

---

### Task 16: Nutzersichtbare Texte öffnen (Story 11) — mit PO-Checkpoint

**Files:**
- Modify: `web/app/layout.tsx` (globale `metadata`: title + description)
- Modify: `web/app/page.tsx` (Startseiten-Intro)
- Modify: `web/app/uebung/[slug]/page.tsx` (`generateMetadata`: Seitentitel schema-neutral)

- [ ] **Step 1: Stellen inventarisieren**

`grep -rn "Kinderfussball" web/app web/components --include="*.tsx" --include="*.ts"` — es zählen NUR die vier zentralen Stellen (globaler Titel, Beschreibung, Startseiten-Intro, Übungs-Seitentitel). Quellenhinweise, Badge «Kifu-Manual», Editor-Randstellen, Auth/E-Mail: NICHT anfassen (OoS 2–5).

- [ ] **Step 2: Textvorschläge einsetzen**

| Stelle | Vorschlag (zur PO-Abnahme) |
|---|---|
| Globaler Titel | `KiFu — Übungen & Trainings für Kinder- und Juniorenfussball` |
| Beschreibung | `Trainings für Kinder- und Juniorenfussball planen: kuratierte Übungen aus dem SFV-Manual Kinderfussball, eigene Übungen der Community und Trainingsschemata beider Stufen.` |
| Startseiten-Intro | `Der offizielle Kinderfussball-Bestand, Übungen der Community und Trainingsplanung nach den SFV-Schemata für Kinder- und Juniorenfussball (G bis A).` |
| Übungs-Seitentitel | `[Name] — Übung` |

Beide Begriffe kommen wörtlich vor (AC 1/2); kein kuratierter Junioren-Bestand suggeriert (AC 2 — «Bestand» bleibt explizit dem Kinderfussball zugeordnet); Übungs-Titel schema-neutral (AC 3).

- [ ] **Step 3: CHECKPOINT — PO-Abnahme**

Die vier Formulierungen dem PO vorlegen (offene Frage der Story verlangt Abnahme). NICHT weiterarbeiten an Task 18, bevor die Texte abgenommen oder ersetzt sind; Tasks 17 kann parallel laufen.

- [ ] **Step 4: E2E + Commit**

Browser: Browsertab-Titel, `<meta name="description">` (View Source), Startseite, Übungs-Detail-Tab-Titel prüfen.

```bash
git add web/app/layout.tsx web/app/page.tsx web/app/uebung/\[slug\]/page.tsx
git commit -m "feat(texte): Seitentitel, Beschreibung und Startseite auf Kinder- und Juniorenfussball öffnen"
```

---

### Task 17: Junioren-Erscheinungsformen (Story 12)

**Files:**
- KEINE Migration: es existiert kein Werte-CHECK auf `erscheinungsform` (nur die Teil-Bindung `erscheinungsform_nur_haupt_einleitung`, und die erweitert bereits Task 10) — die erlaubten Werte sind rein app-seitig (`uebung-form.ts`). Eine neue Werte-Invariante einzuführen wäre Scope-Ausweitung.
- Modify: `web/lib/uebung-form.ts` (Werte beider Vokabulare akzeptieren)
- Modify: `web/components/exercise/ExerciseForm.tsx` + Fassungs-Formular (Auswahl 17 Werte, flach)
- Modify: `web/components/catalog/CatalogFilterBar.tsx` + `web/lib/queries/exercises.ts` + Picker (gemeinsame Filter-Dimension)
- Modify: `web/app/uebung/[slug]/page.tsx` (Anzeige Detailseite)

**Interfaces:**
- Consumes: Vokabular `erscheinungsform_junioren` (Task 2); Heimat-Berechtigung (Task 10).
- Produces: `exercises.erscheinungsform` akzeptiert die Vereinigung beider Vokabulare (17 Werte).

- [ ] **Step 1: App**

- `parseUebungsInhalt`: gültige Werte = `[...erscheinungsformSlugs, ...erscheinungsform_juniorenSlugs]`; Berechtigung über ein zentrales Set in `labels.ts` (ersetzt die bisherige `FAHRPLAN_TEILE`-Zweckentfremdung an dieser Stelle):

```ts
/** Einordnungen/Heimaten, die Erscheinungsformen tragen dürfen (Story 12;
 *  Auffangen und Ausklang — auch jun-ausklang — bleiben ausgeschlossen).
 *  jun-spielformen/jun-spiel: Fassungen in diesen Blöcken stammen aus
 *  Hauptteil-Übungen und behalten deren Erscheinungsformen. */
export const ERSCHEINUNGSFORM_TEILE = new Set<string>([
  "einleitung", "hauptteil",
  "jun-aufwaermen", "jun-spielform-trainingsziel", "jun-explosivitaet",
  "jun-spielformen", "jun-spiel",
]);
```

  Ohne dieses Set würde jede Bearbeitung einer Fassung mit Junioren-Einordnung die Erscheinungsformen STILL LEEREN (`uebung-form.ts:88-92` leert alles ausserhalb `FAHRPLAN_TEILE`). Ebenso den Picker-Filter-Schalter `hatErscheinungsform` (`ExercisePickerDialog.tsx:62`) auf das neue Set umstellen, sonst fehlt der Filter in Junioren-Blöcken.
- Auswahl im Formular: EIN `MultiSelect` mit 17 Optionen, flache Reihenfolge 6 KiFu → 11 Junioren (Manual-Reihenfolge), keine Gruppierung (OoS 2).
- Filter Katalog + Picker: dieselbe Dimension `form` um die 11 Werte erweitert; ODER-Logik über alle gewählten Werte beider Vokabulare (PC 1 — Bestands-`overlaps`-Query deckt das ab).
- Detailseite zeigt alle gesetzten Werte (AC 5); Fassungen: Feld ist bereits in `FASSUNG_INHALT_FELDER`, unabhängig änderbar (AC 2 / PC 2).
- Freitextsuche unverändert (OoS 4).

- [ ] **Step 2: E2E + Commit**

Browser: Aufwärmen-Übung mit «Den Körper stabil halten» + «Sich flink und geschickt bewegen» (beide Vokabulare gemischt) speichern; Filter «Explosiv und dynamisch agieren» findet die Explosivitäts-Übung; ODER über KiFu+Junioren-Wert; Ausklang-Übung bietet keine Erscheinungsformen an.

```bash
git add -A web/
git commit -m "feat(uebungen): Junioren-Erscheinungsformen erfassen und gemeinsam filtern"
```

---

### Task 18: Abschluss — E2E-Gesamtdurchgang, Doku, PR

- [ ] **Step 1: Regressions-Gesamtlauf**

```bash
cd web && npm run db:reset && npm run gen:vocab && npm run typecheck && npm run seed && npm run seed
cd .. && .venv/bin/pytest && .venv/bin/python scripts/validate.py
```

(Doppelter Seed = Idempotenz-Nachweis.) Zusätzlich der DB-Vokabular-Paritäts-Assert (Story 2 AC 7 / Story 9 AC 8 / Story 12 AC 6 — «automatisiert nachgewiesen» gilt auch für die DB-CHECKs): ein kleines `tsx`-Skript (z. B. `web/scripts/check-vokabular-db.ts`, in den Regressionslauf aufgenommen) liest `pg_get_constraintdef` für `valid_kategorien`, `training_valid_stufen`, `exercises_trainingsteil_check`, `training_exercises_trainingsteil_check`, und die `uebungstyp`-CHECKs und vergleicht die Slug-Mengen gegen `web/lib/vocab.ts` (die Erscheinungsform-WERTE haben bewusst keinen DB-CHECK — nur die Teil-Bindung).

Zusätzlich Story 2 PC 1 («nachgewiesen gegen eine Kopie des Produktionsbestands»): nach dem Staging-Merge `sync-staging.yml` laufen lassen (spiegelt Prod → Staging) und auf Staging prüfen, dass alle bestehenden Übungen und Trainings unverändert und gültig sind (Stichproben + `select count(*)`-Vergleich vor/nach `db push`; kein Migrationsfehler im deploy-staging-Lauf).

- [ ] **Step 2: E2E-Gesamtdurchgang (beide Schemata)**

Vollständiger Durchlauf als e2e@test.local, gegen die Erfolgskriterien 1–17 des Epics als Checkliste: KiFu-Training unverändert (bauen, veröffentlichen, drucken, durchführen — EK 16); D-Training komplett (anlegen → 6 Blöcke befüllen inkl. eigener Aufwärm-/Spielform-/Explosivitäts-Übungen → Zeit-Abgleich → veröffentlichen → als Betrachter ansehen/drucken/durchführen); Schema-Wechsel hin und zurück mit Nacharbeit; Übungstyp/Erscheinungsformen/Ziel; Texte. Abweichungen fixen, dann diesen Step wiederholen.

- [ ] **Step 3: Doku nachführen**

- `docs/superpowers/specs/2026-08-14-juniorenfussball-stories.md`: jede Story «Status: Umgesetzt am <Datum>» (Stories sind Aufträge — als erledigt markieren, nie nachkorrigieren).
- `docs/superpowers/specs/2026-05-31-kifu-architektur-mvp.md` §7.1: überholte Aussagen (feste Vier-Teile-Sequenz, Gleichheitsprüfung) mit Verweis auf dieses Epic nachführen (Abbildungsregel §9.1).
- `CLAUDE.md` Überblick: «aus dem SFV-Manual Kinderfussball extrahiert» präzisieren (§9.2); Beschreibung der zwei Schemata ergänzen.
- Kopf der Init-Migration NICHT anfassen (Migrationshistorie ist unveränderlich); der Hinweis lebt in CLAUDE.md.

- [ ] **Step 4: PR auf develop**

```bash
git push -u origin feature/junioren-epic
gh pr create --base develop --title "Epic: Juniorenfussball-Trainingsschema (#71)" \
  --body "Stories 2–12 gemäss docs/superpowers/specs/2026-08-14-juniorenfussball-stories.md. Release als ganzes Epic. Closes #71 erst mit dem Prod-Release."
```

Nach dem Merge: Staging-Smoke-Test auf staging.ki-fu.ch (Staging-Supabase ggf. im Dashboard wecken; `deploy-staging.yml` pusht die Migrationen).

- [ ] **Step 5: CHECKPOINT — Prod nur mit Freigabe**

PR develop → main NUR nach expliziter PO-Freigabe. Beim Merge nach main zusätzlich (Pflicht laut CLAUDE.md):
- `docs/produkt/trainings.md` + `docs/produkt/uebungen.md`: Juniorenschema, Kategorien D–A, Heimat, Übungstyp, Erscheinungsformen, Ziel, Zeit-Orientierung, Veröffentlichungsbedingungen, «Bekannte Grenzen» (kein kuratierter Junioren-Bestand; hohe Publish-Hürde bis Community-Seed).
- Issue #71 schliessen; Stories/Epics ggf. als Issues nachtragen (Format #66/#67).
- Danach optional `seed-prod` NICHT nötig (keine neuen Manual-Daten); falls der PO Junioren-Community-Übungen seedet, erst Vercel-Deploy abwarten (Reihenfolge-Regel).

---

## Risiken und Wachsamkeitspunkte

1. **Constraint-Bestandsdefinitionen**: Tasks 10/12/17 ersetzen bestehende CHECKs/Trigger — IMMER zuerst `pg_get_constraintdef`/Funktionskörper aus der lokalen DB ziehen und die Alt-Semantik wörtlich übernehmen; die Plan-SQL gibt die Ziel-Semantik vor.
2. **Deploy-Fenster DB vor App**: `deploy.yml` pusht Migrationen, Vercel deployt getrennt. Alle Migrationen dieses Epics sind additiv/erweiternd — das alte Bundle kann mit ihnen leben (keine entfernten Spalten/Signaturen; KEINE `publish_training`-RPC wiederbeleben — sie wurde mit dem Team-Epic ersatzlos gedroppt, Veröffentlichen ist ein direktes UPDATE hinter den Gates). Das NEUE Bundle gegen die ALTE DB wäre kaputt (Junioren-Werte an alten CHECKs) — die Reihenfolge Migrationen→App ist durch CI ohnehin gegeben (db push läuft vor/mit dem Vercel-Build); beim main-Merge prüfen, dass der `deploy.yml`-Lauf VOR dem Vercel-Promote fertig ist.
3. **`teilRank`/Sortierungen**: jede Stelle, die `TRAININGSTEIL_SLUGS.indexOf` nutzt, braucht die Junioren-Erweiterung (Task 9 Step 5) — sonst sortieren Junioren-Fassungen ans Ende «unbekannt». `grep -rn "TRAININGSTEIL_SLUGS\|teilRank" web/`.
4. **RPC-Grants**: neue Funktionen brauchen explizite Grants (Memory «Seed 42501»); `training_fehlende_bedingungen` zusätzlich `grant execute to authenticated`, wenn die App sie direkt ruft (Task 12 Step 2).
5. **`veroeffentlicheTraining` filtert auf `owner_id`** (`actions/trainings.ts:275`): prüfen, wie Team-Trainings veröffentlicht werden (eigener Pfad?) — der Junioren-Umbau darf diesen Filter nicht kopieren, ohne Team-Trainings mitzudenken. (`validStufen` ist dagegen bereits vokabularbasiert und wächst automatisch mit.)
6. **Story-4-AC-5-Erkennbarkeit der Abweichung**: Der Epic-Entscheid (revidiert 2026-08-22) hat den Abweichungs-Hinweis GESTRICHEN — Stories-Doku AC 5 («Abweichung erkennbar») ist damit durch den Epic-Eintrag überholt; es gilt die Epic-Tabelle (keine gesonderte Anzeige). Im Abnahme-Durchgang explizit ansprechen.
