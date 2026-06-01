# Design: Methodischer Fahrplan strukturiert erfassen

**Datum:** 2026-06-01
**Status:** Genehmigt (Brainstorming)

## Problem

Die Übungsdatenbank erfasst den methodischen Fahrplan (Offen starten → Üben →
Wett-eifern) des Kinderfussball-Manuals nur teilweise und uneinheitlich:

- Das Feld `aufbau` enthält faktisch den **"Offen starten"**-Text (so mappt es der
  Parser in `scripts/parser.py:61`: `"Offen" → aufbau`), ist aber als "Aufbau"
  (physisches Setup) benannt.
- `ueben` und `wetteifern` liegen als lose Top-Level-Felder daneben, nicht als
  erkennbarer Fahrplan-Block.

Ziel: Den methodischen Fahrplan für Übungen der **Einleitung** und des
**Hauptteils** als zusammenhängenden, korrekt benannten Block erfassen.

## Scope

- **Betroffen:** `einleitung` (12 Übungen) + `hauptteil` (55 Übungen).
- **Nicht betroffen vom Fahrplan:** `auffangen` (4) + `ausklang` (4). Diese haben
  im Manual nur eine einzige Beschreibung (`ueben: []`, `wetteifern: null`); ihr
  `aufbau`-Text ist echtes Setup ("Den Kindern steht vor dem Training … zur
  Verfügung"). Sie behalten ein flaches `aufbau`-Feld.

## Gewählter Ansatz: Bedingt nach Trainingsteil

Verlustfreie Umbenennung + Gruppierung. Jedes Feld bedeutet genau eine Sache.

### Zielstruktur

```yaml
# einleitung / hauptteil
methodischer_fahrplan:
  offen_starten: "Die Kinder dribbeln auf die Abschlusszone zu und schliessen ab."
  ueben:
    - "Mit linkem und rechtem Fuss kontrolliert führen und in die freie Ecke zielen"
  wetteifern: "Wie viele Versuche gelingen mit links, wie viele mit rechts?"

# auffangen / ausklang
aufbau: "Den Kindern steht vor dem Training mind. ein Feld zur Verfügung."
```

## Komponenten

### 1. Schema (`schema/uebung.schema.json`)

- Top-Level `ueben` und `wetteifern` **entfernen** (wandern in den Block).
- `aufbau`: bleibt als optionaler `string`.
- Neuer `methodischer_fahrplan`:
  - `type: object`, `additionalProperties: false`
  - `offen_starten`: `string`, `minLength: 1`, **required**
  - `ueben`: `array` of `string` (default leer)
  - `wetteifern`: `string` oder `null`
- `required` (Top-Level) bleibt: `id`, `name`, `trainingsteil`, `kategorien`,
  `quelle`. `aufbau` wird aus den globalen Required entfernt.
- Bedingte Pflichtprüfung via `allOf` + `if/then`:
  - `trainingsteil ∈ {einleitung, hauptteil}` ⇒ `required: [methodischer_fahrplan]`
  - `trainingsteil ∈ {auffangen, ausklang}` ⇒ `required: [aufbau]`

### 2. Migrationsskript (`scripts/migrate_fahrplan.py`, einmalig)

Liest jede Datei in `data/uebungen/*.yaml`, schreibt schlüsselreihenfolge- und
unicode-erhaltend zurück (`yaml.safe_dump(..., allow_unicode=True, sort_keys=False)`):

- **einleitung/hauptteil:**
  - `methodischer_fahrplan = {offen_starten: <aufbau>, ueben: <ueben>, wetteifern: <wetteifern>}`
  - Top-Level `aufbau`, `ueben`, `wetteifern` entfernen.
  - Block an der Stelle einfügen, an der zuvor `aufbau` stand (Reihenfolge stabil).
- **auffangen/ausklang:**
  - `aufbau` unverändert lassen.
  - Leere `ueben: []` und `wetteifern: null` entfernen (sonst von
    `additionalProperties: false` verboten).

Das Skript ist idempotent: bereits migrierte Dateien (kein Top-Level `ueben`/
`wetteifern`) werden übersprungen.

### 3. Extraktion (`scripts/extract.py`)

Bei `scripts/extract.py:104` das `doc` je nach `teil` aufbauen:

- `teil ∈ {einleitung, hauptteil}`:
  `doc["methodischer_fahrplan"] = {"offen_starten": ex["aufbau"], "ueben": ex["ueben"], "wetteifern": ex["wetteifern"]}`
- sonst: `doc["aufbau"] = ex["aufbau"]`

`scripts/parser.py` bleibt unverändert — es parst weiterhin die Manual-Abschnitte
(`Offen`/`Üben`/`Wett-`) und liefert flache Felder, die `extract.py` umformt.

### 4. Doku-Ansicht (`scripts/build_docs.py`)

Bei `scripts/build_docs.py:32`:

- Wenn `doc` ein `methodischer_fahrplan` hat → rendern als
  `## Offen starten` (`offen_starten`), `## Üben` (Bulletliste), `## Wett-eifern`.
- Sonst (auffangen/ausklang) → `## Aufbau` mit `aufbau`-Text.

## Tests

- `tests/test_schema.py`: validiert alle migrierten YAMLs gegen das neue Schema —
  muss grün bleiben.
- `tests/test_build_docs.py` + Fixtures: an neue Struktur anpassen (Fixture mit
  `methodischer_fahrplan` + Fixture mit `aufbau`).
- Neuer Schema-Test: `einleitung` ohne `methodischer_fahrplan` wird abgelehnt;
  `auffangen` ohne `aufbau` wird abgelehnt.
- `tests/test_parser.py`: unverändert (Parser bleibt gleich).

## Verifikation

1. `python scripts/migrate_fahrplan.py` läuft fehlerfrei über alle 71 Dateien.
2. `pytest` ist grün.
3. Stichprobe: `torabschluss-ballschule-schusszone.yaml` (hauptteil) hat den Block;
   `dribblestart.yaml` (auffangen) hat flaches `aufbau`.
4. `python scripts/build_docs.py` erzeugt korrekte Markdown-Überschriften.

## Bewusst nicht im Scope (YAGNI)

- Kein separates physisches Aufbau-Feld für einleitung/hauptteil (Skizze/`bild`
  deckt das Setup ab).
- Keine zusätzliche Tiefe je Phase (Coaching-Punkte, Differenzierung etc.).
- Kein einheitlicher Fahrplan-Block für auffangen/ausklang.
