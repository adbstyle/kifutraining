# Übungs-Datenbank Kinderfussball – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Trainingsformen (Übungen) aus `Manual_Kinderfussball_D.pdf` als versionierte YAML-Datenbank + Feld-Diagramme (PNG) extrahieren und daraus eine lesbare Markdown-Ansicht generieren.

**Architecture:** Reine Parser-Funktionen (`scripts/parser.py`, text→dicts, unit-getestet) werden von einem I/O-Orchestrator (`scripts/extract.py`) genutzt, der poppler-Tools (`pdftotext`/`pdfimages`) aufruft und `data/uebungen/*.yaml`, `data/themen/*.yaml` + `images/*.png` schreibt. `scripts/validate.py` prüft alle YAMLs gegen ein JSON-Schema. `scripts/build_docs.py` rendert die Markdown-Ansicht. Die YAMLs sind nach Extraktion die kanonische, von Hand korrigierbare Quelle.

**Tech Stack:** Python 3, poppler (`pdftotext`, `pdfimages`, vorhanden), PyYAML, jsonschema, pytest.

**Spec:** `docs/superpowers/specs/2026-05-31-uebungs-datenbank-design.md`

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `requirements.txt` | Python-Abhängigkeiten (pyyaml, jsonschema, pytest) |
| `.gitignore` | `.venv/`, `__pycache__/`, `*.pyc` |
| `schema/uebung.schema.json` | JSON-Schema für eine Übungs-YAML |
| `scripts/parser.py` | Reine Parsing-Funktionen (Text → dicts), keine I/O |
| `scripts/extract.py` | Orchestrator: poppler aufrufen, Seiten→Trainingsteil mappen, YAML+PNG schreiben |
| `scripts/validate.py` | Alle `data/uebungen/*.yaml` gegen Schema validieren |
| `scripts/build_docs.py` | YAML → `docs/README.md` + `docs/uebungen/*.md` |
| `tests/test_parser.py` | Unit-Tests für `parser.py` (echte Text-Snippets als Fixtures) |
| `tests/test_build_docs.py` | Unit-Test für die Markdown-Rendering-Funktion |

**Seiten→Trainingsteil-Mapping** (aus dem Inhaltsverzeichnis, lebt als Tabelle in `extract.py`):

| Seiten | trainingsteil | erscheinungsform |
|---|---|---|
| 60 | auffangen | – |
| 61–64 | einleitung | – |
| 65–74 | hauptteil | Das Spiel kreativ gestalten / Den Ball entschlossen erobern |
| 75–79 | hauptteil | Mutig Tore erzielen / Mutig Tore verhindern |
| 80 | hauptteil | Sich flink und geschickt bewegen |
| 81 | hauptteil | Sich respektvoll verhalten und fair spielen |
| 82 | ausklang | – |

---

## Task 1: Projekt-Setup

**Files:**
- Create: `requirements.txt`, `.gitignore`
- Move: alle PDF/PPTX im Wurzelverzeichnis → `sources/`

- [ ] **Step 1: Verzeichnisse anlegen und Original-Dateien verschieben**

```bash
cd /Users/adrianbader/Dev/kifu
mkdir -p sources data/uebungen data/themen images scripts tests docs/uebungen schema
git mv Manual_Kinderfussball_D.pdf sources/
git mv B_02_Praesentation_Trainingsplanung.pptx sources/
git mv B_03_Merkblatt_A5_Trainingsplanung.pdf sources/
git mv B_10_Trainingsplanung_3_Wochen_Kat._E-FF-12_Dribbling.pdf sources/
git mv B_11_Trainingsplanung_3_Wochen_Kat._E-FF-12_Torabschluss.pdf sources/
git mv B_12_Trainingsplanung_3_Wochen_Kat._E-FF-12_Passen_und_Ballkontrolle.pdf sources/
git mv "C_02_Praesentation_Beispieltrainings_Praxis_Theorie (1).pptx" sources/
git mv C_04_Praesentation_Beispieltrainings_Theorie-Praxis.pptx sources/
```

- [ ] **Step 2: `requirements.txt` schreiben**

```
pyyaml>=6.0
jsonschema>=4.0
pytest>=8.0
```

- [ ] **Step 3: `.gitignore` schreiben**

```
.venv/
__pycache__/
*.pyc
.pytest_cache/
```

- [ ] **Step 4: venv anlegen und Abhängigkeiten installieren**

Run:
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```
Expected: `Successfully installed jsonschema... pyyaml... pytest...`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: Projektstruktur, Abhängigkeiten, Originale nach sources/"
```

---

## Task 2: JSON-Schema für Übungen

**Files:**
- Create: `schema/uebung.schema.json`
- Test: `tests/test_schema.py`

- [ ] **Step 1: Failing-Test schreiben** (`tests/test_schema.py`)

```python
import json
from pathlib import Path
from jsonschema import Draft202012Validator

SCHEMA = Path("schema/uebung.schema.json")

def test_schema_is_valid_jsonschema():
    data = json.loads(SCHEMA.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(data)  # wirft bei ungültigem Schema

def test_minimal_valid_uebung_passes():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = {
        "id": "dribbling-wechseltore",
        "name": "Wechseltore",
        "trainingsteil": "hauptteil",
        "thema": "dribbling",
        "kategorien": ["G", "F", "E"],
        "aufbau": "Zwei Teams spielen 3:3.",
        "ueben": ["Täuschen"],
        "wetteifern": "Welches Team erzielt mehr Tore?",
        "quelle": {"datei": "Manual_Kinderfussball_D.pdf", "seite": 65},
    }
    assert list(v.iter_errors(doc)) == []

def test_invalid_trainingsteil_fails():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = {"id": "x", "name": "X", "trainingsteil": "quatsch",
           "kategorien": ["G"], "aufbau": "...",
           "quelle": {"datei": "a.pdf", "seite": 1}}
    assert list(v.iter_errors(doc)) != []
```

- [ ] **Step 2: Test ausführen, fehlschlagen sehen**

Run: `.venv/bin/pytest tests/test_schema.py -v`
Expected: FAIL (Datei `schema/uebung.schema.json` existiert nicht → `FileNotFoundError`)

- [ ] **Step 3: Schema schreiben** (`schema/uebung.schema.json`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Kinderfussball Übung",
  "type": "object",
  "required": ["id", "name", "trainingsteil", "kategorien", "aufbau", "quelle"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "name": { "type": "string", "minLength": 1 },
    "trainingsteil": { "enum": ["auffangen", "einleitung", "hauptteil", "ausklang"] },
    "erscheinungsform": { "type": ["string", "null"] },
    "thema": { "type": ["string", "null"] },
    "kategorien": {
      "type": "array",
      "items": { "enum": ["G", "F", "E"] },
      "uniqueItems": true
    },
    "spielform": { "type": ["string", "null"] },
    "anzahl_kinder": {
      "type": ["object", "null"],
      "additionalProperties": false,
      "properties": {
        "min": { "type": ["integer", "null"] },
        "empfohlen": { "type": ["integer", "null"] }
      }
    },
    "material": { "type": "array", "items": { "type": "string" } },
    "aufbau": { "type": "string" },
    "ueben": { "type": "array", "items": { "type": "string" } },
    "wetteifern": { "type": ["string", "null"] },
    "varianten": { "type": "array", "items": { "type": "string" } },
    "bild": { "type": ["string", "null"] },
    "quelle": {
      "type": "object",
      "required": ["datei", "seite"],
      "additionalProperties": false,
      "properties": {
        "datei": { "type": "string" },
        "seite": { "type": "integer" }
      }
    }
  }
}
```

- [ ] **Step 4: Test ausführen, bestehen sehen**

Run: `.venv/bin/pytest tests/test_schema.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add schema/uebung.schema.json tests/test_schema.py
git commit -m "feat: JSON-Schema für Übungen"
```

---

## Task 3: Parser – `slugify`

**Files:**
- Create: `scripts/parser.py`, `tests/test_parser.py`

- [ ] **Step 1: Failing-Test schreiben** (`tests/test_parser.py`)

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import parser

def test_slugify_basic():
    assert parser.slugify("Wechseltore") == "wechseltore"

def test_slugify_umlaute_und_spaces():
    assert parser.slugify("Über die Brücke – um eine Wache") == "ueber-die-bruecke-um-eine-wache"

def test_slugify_collapses_separators():
    assert parser.slugify("Feuerball (Tupfball)") == "feuerball-tupfball"
```

- [ ] **Step 2: Test ausführen, fehlschlagen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'parser'` bzw. `AttributeError`)

- [ ] **Step 3: `slugify` implementieren** (`scripts/parser.py`)

```python
import re

_UMLAUT = {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
           "Ä": "ae", "Ö": "oe", "Ü": "ue"}

def slugify(text):
    text = text.strip().lower()
    for k, v in _UMLAUT.items():
        text = text.replace(k.lower(), v)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")
```

- [ ] **Step 4: Test ausführen, bestehen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add scripts/parser.py tests/test_parser.py
git commit -m "feat: parser.slugify"
```

---

## Task 4: Parser – `split_title_and_categories`

Erkennt die Titelzeile einer Übung: Titel links, Alterskategorien `G/F/E` rechts (durch ≥2 Leerzeichen getrennt).

**Files:**
- Modify: `scripts/parser.py`, `tests/test_parser.py`

- [ ] **Step 1: Failing-Test ergänzen** (`tests/test_parser.py`)

```python
def test_title_with_all_categories():
    line = "Wechseltore                                   G     F      E"
    assert parser.split_title_and_categories(line) == ("Wechseltore", ["G", "F", "E"])

def test_title_with_dashes_and_umlaut():
    line = "Über die Brücke – um eine Wache                G     F      E"
    title, cats = parser.split_title_and_categories(line)
    assert title == "Über die Brücke – um eine Wache"
    assert cats == ["G", "F", "E"]

def test_line_without_categories_returns_empty_list():
    title, cats = parser.split_title_and_categories("Dribbling")
    assert title == "Dribbling"
    assert cats == []
```

- [ ] **Step 2: Test ausführen, fehlschlagen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -k categories -v`
Expected: FAIL (`AttributeError: module 'parser' has no attribute 'split_title_and_categories'`)

- [ ] **Step 3: Funktion implementieren** (`scripts/parser.py` anhängen)

```python
# Kategorie-Badges am Zeilenende: G / F / E, je durch Leerraum getrennt.
_CATEGORY_TAIL = re.compile(r"\s{2,}((?:[GFE]\s+)*[GFE])\s*$")

def split_title_and_categories(line):
    line = line.rstrip()
    m = _CATEGORY_TAIL.search(line)
    if not m:
        return line.strip(), []
    cats = re.findall(r"[GFE]", m.group(1))
    title = line[: m.start()].strip()
    return title, cats

def is_exercise_title(line):
    title, cats = split_title_and_categories(line)
    return bool(cats) and bool(title)
```

- [ ] **Step 4: Test ausführen, bestehen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -v`
Expected: PASS (alle)

- [ ] **Step 5: Commit**

```bash
git add scripts/parser.py tests/test_parser.py
git commit -m "feat: parser.split_title_and_categories + is_exercise_title"
```

---

## Task 5: Parser – `extract_column` (Spalten-Helfer)

Hilfsfunktion: extrahiert aus mehrspaltigem `-layout`-Text die rechte Inhaltsspalte ab einer gegebenen Spaltenposition, fügt Zeilen zusammen und entfernt Trennstrich-Umbrüche.

**Files:**
- Modify: `scripts/parser.py`, `tests/test_parser.py`

- [ ] **Step 1: Failing-Test ergänzen**

```python
def test_join_dehyphenates_and_joins():
    lines = ["Zwei Teams spielen 3:3. Dribbelt ein Kind über die Mittel-",
             "linie, kann es in dieser Hälfte ein Tor erzielen."]
    assert parser.join_text(lines) == (
        "Zwei Teams spielen 3:3. Dribbelt ein Kind über die Mittellinie, "
        "kann es in dieser Hälfte ein Tor erzielen."
    )

def test_split_bullets():
    lines = ["– Den Ball nur mit links führen",
             "– Abwechslungsweise links und rechts führen",
             "  sowie Finten schlagen"]
    assert parser.split_bullets(lines) == [
        "Den Ball nur mit links führen",
        "Abwechslungsweise links und rechts führen sowie Finten schlagen",
    ]
```

- [ ] **Step 2: Test ausführen, fehlschlagen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -k "join or bullet" -v`
Expected: FAIL (`AttributeError`)

- [ ] **Step 3: Funktionen implementieren** (`scripts/parser.py` anhängen)

```python
def join_text(lines):
    """Mehrere Zeilen Fliesstext zu einem Absatz; Trennstrich-Umbrüche auflösen."""
    out = ""
    for raw in lines:
        seg = raw.strip()
        if not seg:
            continue
        if out.endswith("-") and not out.endswith("- -"):
            out = out[:-1] + seg          # Silbentrennung: ohne Leerzeichen kleben
        elif out:
            out += " " + seg
        else:
            out = seg
    return out

def split_bullets(lines):
    """Zeilen mit führendem '–' zu einzelnen Listeneinträgen; Folgezeilen anhängen."""
    bullets = []
    for raw in lines:
        seg = raw.strip()
        if not seg:
            continue
        if seg.startswith("–") or seg.startswith("-"):
            bullets.append(seg.lstrip("–-").strip())
        elif bullets:
            tail = bullets[-1]
            if tail.endswith("-"):
                bullets[-1] = tail[:-1] + seg
            else:
                bullets[-1] = tail + " " + seg
    return bullets
```

- [ ] **Step 4: Test ausführen, bestehen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -v`
Expected: PASS (alle)

- [ ] **Step 5: Commit**

```bash
git add scripts/parser.py tests/test_parser.py
git commit -m "feat: parser.join_text + split_bullets"
```

---

## Task 6: Parser – `parse_exercise_block` (volles Format)

Parst einen Übungsblock mit Spalten-Labels `Offen starten` / `Üben` / `Wett-eifern`. Inhalt steht rechts ab einer Inhaltsspalte; Labels stehen links.

**Files:**
- Modify: `scripts/parser.py`, `tests/test_parser.py`

- [ ] **Step 1: Failing-Test ergänzen** (echtes Snippet aus S.65)

```python
WECHSELTORE_BLOCK = (
"Wechseltore                                                         G     F      E\n"
"\n"
"                    Offen          Zwei Teams spielen 3:3. Dribbelt ein Kind über die Mittel-\n"
"                    starten        linie, kann es in dieser Hälfte ein Tor erzielen. Dribbelt es\n"
"                                   wieder zurück, sind die anderen beiden Tore freigeschal-\n"
"                                   tet.\n"
"\n"
"                    Üben           – Täuschen und in den freien Raum dribbeln\n"
"                                   – Als Mitspieler/innen freilaufen, anspielbar sein\n"
"\n"
"                    Wett-          Welches Team erzielt innerhalb von fünf Minuten mehr\n"
"                    eifern         Tore?\n"
)

def test_parse_full_exercise_block():
    ex = parser.parse_exercise_block(WECHSELTORE_BLOCK)
    assert ex["name"] == "Wechseltore"
    assert ex["kategorien"] == ["G", "F", "E"]
    assert ex["aufbau"].startswith("Zwei Teams spielen 3:3.")
    assert "Mittellinie" in ex["aufbau"]          # de-hyphenated
    assert ex["ueben"] == [
        "Täuschen und in den freien Raum dribbeln",
        "Als Mitspieler/innen freilaufen, anspielbar sein",
    ]
    assert ex["wetteifern"].startswith("Welches Team erzielt")
    assert ex["spielform"] == "3:3"
```

- [ ] **Step 2: Test ausführen, fehlschlagen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -k full_exercise -v`
Expected: FAIL (`AttributeError: ... parse_exercise_block`)

- [ ] **Step 3: Funktion implementieren** (`scripts/parser.py` anhängen)

```python
_SECTION_KEYS = {"Offen": "aufbau", "Üben": "ueben", "Wett-": "wetteifern"}
_SPIELFORM = re.compile(r"\b(\d+\s*:\s*\d+)\b")

def _content_column(line):
    """Spaltenindex, an dem nach Label-Wort + Leerraum der Inhalt beginnt."""
    m = re.match(r"\s*\S+\s{2,}", line)
    return m.end() if m else 0

def parse_exercise_block(block):
    lines = block.splitlines()
    title, cats = split_title_and_categories(lines[0])
    body = lines[1:]

    # Inhaltsspalte aus der ersten Label-Zeile bestimmen.
    content_col = 0
    for ln in body:
        first = ln.strip().split(" ")[0] if ln.strip() else ""
        if first in _SECTION_KEYS:
            content_col = _content_column(ln)
            break

    sections = {"aufbau": [], "ueben": [], "wetteifern": []}
    current = "aufbau"
    for ln in body:
        first = ln.strip().split(" ")[0] if ln.strip() else ""
        if first in _SECTION_KEYS:
            current = _SECTION_KEYS[first]
        if not ln.strip():
            continue
        content = ln[content_col:] if len(ln) > content_col else ""
        if content.strip():
            sections[current].append(content)

    aufbau = join_text(sections["aufbau"])
    spielform_m = _SPIELFORM.search(aufbau)
    return {
        "name": title,
        "kategorien": cats,
        "aufbau": aufbau,
        "ueben": split_bullets(sections["ueben"]),
        "wetteifern": join_text(sections["wetteifern"]) or None,
        "spielform": spielform_m.group(1).replace(" ", "") if spielform_m else None,
    }
```

- [ ] **Step 4: Test ausführen, bestehen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -v`
Expected: PASS (alle). Falls die Inhaltsspalte beim echten PDF leicht abweicht: Snippet exakt aus `pdftotext`-Ausgabe übernehmen (Task 8 erzeugt die Fixture).

- [ ] **Step 5: Commit**

```bash
git add scripts/parser.py tests/test_parser.py
git commit -m "feat: parser.parse_exercise_block (volles Format)"
```

---

## Task 7: Parser – einfaches Format + `split_page_into_exercises`

Auffangen/Ausklang haben keine Labels: der ganze Text rechts ist die Beschreibung. `parse_exercise_block` muss das erkennen (keine Label-Zeile → alles = `aufbau`). Zusätzlich teilt `split_page_into_exercises` eine Seite an den Titelzeilen in Blöcke.

**Files:**
- Modify: `scripts/parser.py`, `tests/test_parser.py`

- [ ] **Step 1: Failing-Test ergänzen** (echtes Snippet aus S.60)

```python
SIMPLE_BLOCK = (
"Freies Kleinfeldspiel                                               G     F      E\n"
"\n"
"                         Den Kindern steht vor dem Training mind. ein Kleinfeld zur\n"
"                         Verfügung. Sobald die ersten Kinder auf dem Feld erscheinen,\n"
"                         spielen sie frei auf dem vorbereiteten Kleinfeld.\n"
)

def test_parse_simple_block_has_only_aufbau():
    ex = parser.parse_exercise_block(SIMPLE_BLOCK)
    assert ex["name"] == "Freies Kleinfeldspiel"
    assert ex["aufbau"].startswith("Den Kindern steht vor dem Training")
    assert ex["ueben"] == []
    assert ex["wetteifern"] is None

PAGE_TWO_EXERCISES = (
"Freies Kleinfeldspiel                                               G     F      E\n"
"\n"
"                         Den Kindern steht ein Kleinfeld zur Verfügung.\n"
"\n"
"Dribblestart                                                        G     F      E\n"
"\n"
"                         Sobald die Kinder kommen, umdribbeln sie die Gegenstände.\n"
)

def test_split_page_into_two_exercises():
    blocks = parser.split_page_into_exercises(PAGE_TWO_EXERCISES)
    assert len(blocks) == 2
    assert parser.split_title_and_categories(blocks[0].splitlines()[0])[0] == "Freies Kleinfeldspiel"
    assert parser.split_title_and_categories(blocks[1].splitlines()[0])[0] == "Dribblestart"
```

- [ ] **Step 2: Test ausführen, fehlschlagen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -k "simple or split_page" -v`
Expected: FAIL (`split_page_into_exercises` fehlt; `test_parse_simple_block` evtl. content_col=0)

- [ ] **Step 3: `parse_exercise_block` für content_col=0 absichern + `split_page_into_exercises` ergänzen**

In `parse_exercise_block` den content_col-Fallback ergänzen (falls keine Label-Zeile gefunden, Inhaltsspalte aus erster nicht-leerer Body-Zeile bestimmen):

```python
    if content_col == 0:
        for ln in body:
            if ln.strip():
                content_col = len(ln) - len(ln.lstrip())
                break
```
(direkt nach der Label-Suche, vor der Sections-Schleife einfügen)

Neue Funktion anhängen:

```python
def split_page_into_exercises(page_text):
    """Seitentext an Titelzeilen (mit Kategorie-Badges) in Übungsblöcke teilen."""
    lines = page_text.splitlines()
    blocks, current = [], []
    for ln in lines:
        if is_exercise_title(ln):
            if current:
                blocks.append("\n".join(current))
            current = [ln]
        elif current:
            current.append(ln)
    if current:
        blocks.append("\n".join(current))
    return blocks
```

- [ ] **Step 4: Test ausführen, bestehen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -v`
Expected: PASS (alle)

- [ ] **Step 5: Commit**

```bash
git add scripts/parser.py tests/test_parser.py
git commit -m "feat: parser einfaches Format + split_page_into_exercises"
```

---

## Task 8: Parser – `parse_theme_header`

Themen-Header (nur Hauptteil 65–79): Themenname + `Ziele` / `Metaphern` / `Fragen an die Kinder`. Steht oberhalb der ersten Übungs-Titelzeile.

**Files:**
- Modify: `scripts/parser.py`, `tests/test_parser.py`

- [ ] **Step 1: Failing-Test ergänzen** (echtes Snippet aus S.65)

```python
THEME_HEADER = (
"Dribbling\n"
"\n"
"Ziele                  Die Kinder\n"
"                       – können den Ball beidfüssig und eng führen.\n"
"                       – suchen mutig das 1:1, kennen passende Finten.\n"
"\n"
"Metaphern              – Den Ball als Hund verstehen\n"
"                       – Superman oder Superwoman sein\n"
"\n"
"Fragen an die Kinder   – Wie hast du das Dribbling jeweils gemacht?\n"
"                       – Was ist dir gut gelungen?\n"
)

def test_parse_theme_header():
    th = parser.parse_theme_header(THEME_HEADER)
    assert th["name"] == "Dribbling"
    assert th["ziele"] == [
        "können den Ball beidfüssig und eng führen.",
        "suchen mutig das 1:1, kennen passende Finten.",
    ]
    assert th["metaphern"][0] == "Den Ball als Hund verstehen"
    assert th["fragen_an_die_kinder"][0] == "Wie hast du das Dribbling jeweils gemacht?"

def test_parse_theme_header_none_when_no_labels():
    assert parser.parse_theme_header("Jäger und Hase   G  F  E\n\n  Offen ...") is None
```

- [ ] **Step 2: Test ausführen, fehlschlagen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -k theme -v`
Expected: FAIL (`AttributeError: ... parse_theme_header`)

- [ ] **Step 3: Funktion implementieren** (`scripts/parser.py` anhängen)

```python
_THEME_KEYS = {
    "Ziele": "ziele",
    "Metaphern": "metaphern",
    "Fragen an die Kinder": "fragen_an_die_kinder",
}

def _label_content_col(line, label):
    """Spaltenindex, an dem nach 'label' + Leerraum der Inhalt beginnt."""
    lead = len(line) - len(line.lstrip())
    after = lead + len(label)
    rest = line[after:]
    return after + (len(rest) - len(rest.lstrip()))

def parse_theme_header(text):
    lines = text.splitlines()
    key_idx = next((i for i, ln in enumerate(lines)
                    if any(ln.strip().startswith(k) for k in _THEME_KEYS)), None)
    if key_idx is None:
        return None

    # Themenname = letzte nicht-leere Zeile vor dem ersten Theme-Key
    # (überspringt Seiten-/Kapitel-Header oben auf der Seite).
    name = ""
    for ln in reversed(lines[:key_idx]):
        if ln.strip():
            name = ln.strip()
            break

    first_key = next(k for k in _THEME_KEYS if lines[key_idx].strip().startswith(k))
    content_col = _label_content_col(lines[key_idx], first_key)

    sections = {v: [] for v in _THEME_KEYS.values()}
    current = None
    for ln in lines:
        stripped = ln.strip()
        matched = next((k for k in _THEME_KEYS if stripped.startswith(k)), None)
        if matched:
            current = _THEME_KEYS[matched]
        if current and len(ln) > content_col:
            tail = ln[content_col:]
            if tail.strip():
                sections[current].append(tail)

    return {
        "name": name,
        "id": slugify(name),
        "ziele": split_bullets(sections["ziele"]),
        "metaphern": split_bullets(sections["metaphern"]),
        "fragen_an_die_kinder": split_bullets(sections["fragen_an_die_kinder"]),
    }
```

- [ ] **Step 4: Test ausführen, bestehen sehen**

Run: `.venv/bin/pytest tests/test_parser.py -v`
Expected: PASS (alle). `split_bullets` ignoriert die Zeile „Die Kinder" (kein `–`), behält nur die Aufzählungspunkte.

- [ ] **Step 5: Commit**

```bash
git add scripts/parser.py tests/test_parser.py
git commit -m "feat: parser.parse_theme_header"
```

---

## Task 9: Extraktion – `extract.py` Orchestrator

**Files:**
- Create: `scripts/extract.py`

- [ ] **Step 1: Fixture der echten Seitentexte erzeugen** (zur Kontrolle der Parser-Annahmen)

Run:
```bash
.venv/bin/python - <<'PY'
import subprocess, pathlib
out = pathlib.Path("tests/fixtures"); out.mkdir(parents=True, exist_ok=True)
for p in range(60, 83):
    txt = subprocess.run(["pdftotext","-f",str(p),"-l",str(p),"-layout",
                          "sources/Manual_Kinderfussball_D.pdf","-"],
                         capture_output=True, text=True).stdout
    (out / f"page-{p}.txt").write_text(txt, encoding="utf-8")
print("Fixtures geschrieben:", len(list(out.glob('*.txt'))))
PY
```
Expected: `Fixtures geschrieben: 23`

- [ ] **Step 2: `extract.py` schreiben** (`scripts/extract.py`)

```python
"""Extrahiert Übungen + Diagramme aus dem Manual in data/ und images/."""
import subprocess
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parser

PDF = Path("sources/Manual_Kinderfussball_D.pdf")
UEB = Path("data/uebungen")
THEMEN = Path("data/themen")
IMAGES = Path("images")

# Seite -> (trainingsteil, erscheinungsform | None)
PAGE_META = {60: ("auffangen", None)}
PAGE_META.update({p: ("einleitung", None) for p in range(61, 65)})
PAGE_META.update({p: ("hauptteil", "Das Spiel kreativ gestalten / Den Ball entschlossen erobern") for p in range(65, 75)})
PAGE_META.update({p: ("hauptteil", "Mutig Tore erzielen / Mutig Tore verhindern") for p in range(75, 80)})
PAGE_META[80] = ("hauptteil", "Sich flink und geschickt bewegen")
PAGE_META[81] = ("hauptteil", "Sich respektvoll verhalten und fair spielen")
PAGE_META[82] = ("ausklang", None)


def page_text(page):
    return subprocess.run(
        ["pdftotext", "-f", str(page), "-l", str(page), "-layout", str(PDF), "-"],
        capture_output=True, text=True, check=True).stdout


def extract_images(page, dest_prefix):
    """Eingebettete Bilder einer Seite als PNG; gibt sortierte Pfade zurück."""
    subprocess.run(["pdfimages", "-png", "-f", str(page), "-l", str(page),
                    str(PDF), str(dest_prefix)], check=True, capture_output=True)
    return sorted(dest_prefix.parent.glob(dest_prefix.name + "-*.png"))


def main():
    for d in (UEB, THEMEN, IMAGES):
        d.mkdir(parents=True, exist_ok=True)
    tmp = IMAGES / "_tmp"
    tmp.mkdir(exist_ok=True)

    current_thema = None
    count = 0
    for page in range(60, 83):
        teil, erschein = PAGE_META[page]
        text = page_text(page)

        theme = parser.parse_theme_header(text)
        if theme:
            current_thema = theme["id"]
            (THEMEN / f"{theme['id']}.yaml").write_text(
                yaml.safe_dump({**theme, "trainingsteil": teil,
                                "erscheinungsform": erschein},
                               allow_unicode=True, sort_keys=False),
                encoding="utf-8")

        blocks = parser.split_page_into_exercises(text)
        imgs = extract_images(page, tmp / f"p{page}")

        for i, block in enumerate(blocks):
            ex = parser.parse_exercise_block(block)
            if not ex["name"]:
                continue
            thema = current_thema if teil == "hauptteil" else None
            uid = f"{thema + '-' if thema else ''}{parser.slugify(ex['name'])}"

            bild = None
            if i < len(imgs):
                bild = f"images/{uid}.png"
                imgs[i].replace(IMAGES / f"{uid}.png")

            doc = {
                "id": uid,
                "name": ex["name"],
                "trainingsteil": teil,
                "erscheinungsform": erschein,
                "thema": thema,
                "kategorien": ex["kategorien"],
                "spielform": ex["spielform"],
                "anzahl_kinder": None,
                "material": [],
                "aufbau": ex["aufbau"],
                "ueben": ex["ueben"],
                "wetteifern": ex["wetteifern"],
                "varianten": [],
                "bild": bild,
                "quelle": {"datei": PDF.name, "seite": page},
            }
            (UEB / f"{uid}.yaml").write_text(
                yaml.safe_dump(doc, allow_unicode=True, sort_keys=False),
                encoding="utf-8")
            count += 1

    for leftover in tmp.glob("*"):
        leftover.unlink()
    tmp.rmdir()
    print(f"{count} Übungen extrahiert nach {UEB}/")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Extraktion ausführen**

Run: `.venv/bin/python scripts/extract.py`
Expected: `NN Übungen extrahiert nach data/uebungen/` (NN ≈ 50–80). Keine Exception.

- [ ] **Step 4: Sichtprüfung** einer vollen und einer einfachen Übung

Run:
```bash
cat data/uebungen/dribbling-wechseltore.yaml
ls images/ | head
cat data/themen/dribbling.yaml
```
Expected: plausible Felder; `bild` zeigt auf existierende PNG; Themen-YAML mit Zielen.

- [ ] **Step 5: Commit**

```bash
git add scripts/extract.py tests/fixtures data/ images/
git commit -m "feat: extract.py – Übungen + Diagramme extrahiert (Rohstand)"
```

---

## Task 10: Validierung – `validate.py`

**Files:**
- Create: `scripts/validate.py`

- [ ] **Step 1: `validate.py` schreiben**

```python
"""Validiert alle data/uebungen/*.yaml gegen schema/uebung.schema.json."""
import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator


def main():
    schema = json.loads(Path("schema/uebung.schema.json").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    errors = 0
    files = sorted(Path("data/uebungen").glob("*.yaml"))
    for f in files:
        doc = yaml.safe_load(f.read_text(encoding="utf-8"))
        for err in validator.iter_errors(doc):
            errors += 1
            print(f"{f.name}: {err.message} (Pfad: {list(err.path)})")
    print(f"\n{len(files)} Dateien geprüft, {errors} Fehler.")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Validierung ausführen**

Run: `.venv/bin/python scripts/validate.py`
Expected: `NN Dateien geprüft, 0 Fehler.` Bei Fehlern: Parser/Extract nachbessern (neuen Fixture-Test in `test_parser.py` ergänzen, der den Fall abbildet, dann fixen) bis 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add scripts/validate.py
git commit -m "feat: validate.py – Schema-Validierung aller Übungen"
```

---

## Task 11: Manuelle Korrektur-Runde

Programmatisches Parsing ist nie 100 %. Diese Runde prüft die generierten YAMLs gegen das PDF und korrigiert sie. Danach sind die YAMLs kanonisch.

**Files:**
- Modify: `data/uebungen/*.yaml`, `data/themen/*.yaml` (nach Bedarf)

- [ ] **Step 1: Vollständigkeit gegen PDF abgleichen**

Run:
```bash
ls data/uebungen | wc -l
# Übungstitel je Seite zählen (Kategorie-Badges):
for p in $(seq 60 82); do
  n=$(pdftotext -f $p -l $p -layout sources/Manual_Kinderfussball_D.pdf - 2>/dev/null \
      | grep -cE '\s{2,}G\s+F\s+E\s*$'); echo "S.$p: $n Übungen";
done
```
Expected: Summe der Zeilen ≈ Anzahl YAML-Dateien. Abweichungen notieren (z. B. Übungen ohne vollständiges G/F/E-Badge).

- [ ] **Step 2: Stichprobe je Trainingsteil gegen PDF lesen** und Felder korrigieren

Für je 1–2 Übungen aus auffangen / einleitung / hauptteil / ausklang: `aufbau`, `ueben`, `wetteifern`, `kategorien` mit der PDF-Seite vergleichen. Tippfehler/Umbruch-Artefakte direkt in der YAML korrigieren. Bei systematischen Fehlern stattdessen den Parser fixen (Task 6/7/8 erweitern) und `extract.py` erneut laufen lassen — aber **nur** solange noch keine manuellen Edits vorgenommen wurden.

- [ ] **Step 3: Bild-Zuordnung prüfen**

Run: `.venv/bin/python -c "import yaml,glob; [print(d['id'], d['bild']) for f in sorted(glob.glob('data/uebungen/*.yaml')) for d in [yaml.safe_load(open(f))]]"`
Stichprobe: 2–3 PNGs öffnen und gegen die Übung im PDF prüfen (richtige Reihenfolge?). Falsche Zuordnungen in der YAML (`bild`-Feld + Dateiname) korrigieren.

- [ ] **Step 4: `anzahl_kinder` / `material` best-effort ergänzen** (optional, wo eindeutig)

Wo `spielform` gesetzt ist (z. B. "3:3"), `anzahl_kinder.min` = Summe (6) eintragen. Material aus `aufbau`/Diagramm ergänzen wo offensichtlich (Markierkegel, Minitore, Bälle). Unklares leer lassen.

- [ ] **Step 5: Re-Validierung + Commit**

Run: `.venv/bin/python scripts/validate.py`
Expected: `0 Fehler.`
```bash
git add data/
git commit -m "fix: manuelle Korrektur der extrahierten Übungen"
```

---

## Task 12: Markdown-Ansicht – `build_docs.py`

**Files:**
- Create: `scripts/build_docs.py`, `tests/test_build_docs.py`

- [ ] **Step 1: Failing-Test für `render_exercise`** (`tests/test_build_docs.py`)

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import build_docs

def test_render_exercise_markdown():
    doc = {
        "id": "dribbling-wechseltore", "name": "Wechseltore",
        "trainingsteil": "hauptteil", "thema": "dribbling",
        "kategorien": ["G", "F", "E"], "spielform": "3:3",
        "aufbau": "Zwei Teams spielen 3:3.",
        "ueben": ["Täuschen und dribbeln"],
        "wetteifern": "Welches Team erzielt mehr Tore?",
        "bild": "images/dribbling-wechseltore.png",
        "quelle": {"datei": "Manual_Kinderfussball_D.pdf", "seite": 65},
    }
    md = build_docs.render_exercise(doc)
    assert md.startswith("# Wechseltore")
    assert "**Kategorien:** G, F, E" in md
    assert "## Offen starten" in md
    assert "Zwei Teams spielen 3:3." in md
    assert "- Täuschen und dribbeln" in md
    assert "## Wett-eifern" in md
    assert "![Wechseltore](../images/dribbling-wechseltore.png)" in md
```

- [ ] **Step 2: Test ausführen, fehlschlagen sehen**

Run: `.venv/bin/pytest tests/test_build_docs.py -v`
Expected: FAIL (`ModuleNotFoundError`/`AttributeError`)

- [ ] **Step 3: `build_docs.py` schreiben** (`scripts/build_docs.py`)

```python
"""Generiert docs/README.md (Index) und docs/uebungen/*.md aus den YAMLs."""
import sys
from pathlib import Path

import yaml

UEB = Path("data/uebungen")
OUT = Path("docs")
TEILE = ["auffangen", "einleitung", "hauptteil", "ausklang"]
TEIL_TITEL = {"auffangen": "Auffangen", "einleitung": "Einleitung",
              "hauptteil": "Hauptteil", "ausklang": "Ausklang"}


def render_exercise(doc):
    lines = [f"# {doc['name']}", ""]
    meta = [f"**Trainingsteil:** {doc['trainingsteil']}",
            f"**Kategorien:** {', '.join(doc['kategorien'])}"]
    if doc.get("thema"):
        meta.append(f"**Thema:** {doc['thema']}")
    if doc.get("spielform"):
        meta.append(f"**Spielform:** {doc['spielform']}")
    lines += [" · ".join(meta), ""]
    if doc.get("bild"):
        lines += [f"![{doc['name']}](../{doc['bild']})", ""]
    lines += ["## Offen starten", "", doc["aufbau"], ""]
    if doc.get("ueben"):
        lines += ["## Üben", ""] + [f"- {u}" for u in doc["ueben"]] + [""]
    if doc.get("wetteifern"):
        lines += ["## Wett-eifern", "", doc["wetteifern"], ""]
    if doc.get("varianten"):
        lines += ["## Varianten", ""] + [f"- {v}" for v in doc["varianten"]] + [""]
    lines += ["---", f"*Quelle: {doc['quelle']['datei']}, S. {doc['quelle']['seite']}*"]
    return "\n".join(lines)


def main():
    docs = [yaml.safe_load(f.read_text(encoding="utf-8"))
            for f in sorted(UEB.glob("*.yaml"))]
    (OUT / "uebungen").mkdir(parents=True, exist_ok=True)
    for doc in docs:
        (OUT / "uebungen" / f"{doc['id']}.md").write_text(
            render_exercise(doc), encoding="utf-8")

    idx = ["# Übungs-Datenbank Kinderfussball", "",
           f"{len(docs)} Übungen aus dem Manual Kinderfussball.", ""]
    for teil in TEILE:
        group = [d for d in docs if d["trainingsteil"] == teil]
        if not group:
            continue
        idx.append(f"## {TEIL_TITEL[teil]}")
        idx.append("")
        for d in sorted(group, key=lambda x: (x.get("thema") or "", x["name"])):
            thema = f" _({d['thema']})_" if d.get("thema") else ""
            idx.append(f"- [{d['name']}](uebungen/{d['id']}.md)"
                       f" – {', '.join(d['kategorien'])}{thema}")
        idx.append("")
    (OUT / "README.md").write_text("\n".join(idx), encoding="utf-8")
    print(f"{len(docs)} Übungsseiten + Index generiert in {OUT}/")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Test ausführen, bestehen sehen**

Run: `.venv/bin/pytest tests/test_build_docs.py -v`
Expected: PASS

- [ ] **Step 5: Generieren + Sichtprüfung**

Run: `.venv/bin/python scripts/build_docs.py && head -30 docs/README.md`
Expected: Index nach Trainingsteilen gruppiert; Links existieren.

- [ ] **Step 6: Commit**

```bash
git add scripts/build_docs.py tests/test_build_docs.py docs/README.md docs/uebungen
git commit -m "feat: build_docs.py – Markdown-Ansicht generiert"
```

---

## Task 13: README im Wurzelverzeichnis + Push

**Files:**
- Create: `README.md` (Repo-Wurzel)

- [ ] **Step 1: `README.md` schreiben**

```markdown
# kifutraining

Übungs-Datenbank für den Kinderfussball, extrahiert aus dem SFV-Manual.

## Struktur
- `data/uebungen/` – eine YAML pro Übung (kanonische Quelle)
- `data/themen/` – Themen-Metadaten (Ziele, Metaphern, Fragen)
- `images/` – Feld-Diagramme (PNG)
- `docs/` – generierte, lesbare Markdown-Ansicht ([Index](docs/README.md))
- `scripts/` – Extraktion (`extract.py`), Validierung (`validate.py`), Doku-Build (`build_docs.py`)
- `schema/` – JSON-Schema der Übungen
- `sources/` – Original-PDFs/PPTX

## Workflow
\`\`\`bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/validate.py     # Daten prüfen
.venv/bin/python scripts/build_docs.py   # Markdown-Ansicht neu bauen
.venv/bin/pytest                         # Parser-Tests
\`\`\`
```

- [ ] **Step 2: Gesamttest + Validierung als Abschlusscheck**

Run: `.venv/bin/pytest && .venv/bin/python scripts/validate.py`
Expected: alle Tests PASS, `0 Fehler.`

- [ ] **Step 3: Commit + Push**

```bash
git add README.md
git commit -m "docs: Repo-README"
git push
```
Expected: Push nach `origin/main` erfolgreich.

---

## Offene Punkte / Risiken

- **Inhaltsspalten-Erkennung**: `content_col` wird heuristisch bestimmt. Falls eine Seite
  ein abweichendes Layout hat (z. B. Bild rechts statt links), liefert der Block evtl.
  leeren `aufbau` → fällt in Task 10 (Validierung schlägt nicht an, aber leeres Feld) /
  Task 11 (Sichtprüfung) auf. Dann content_col-Logik anhand des Fixtures nachschärfen.
- **Übungen über Seitenumbruch**: Eine Übung, die unten auf einer Seite beginnt und oben
  auf der nächsten endet, wird als zwei Blöcke erfasst. In Task 11 prüfen und ggf. manuell
  zusammenführen (selten im Manual, da pro Übung kompakt).
- **Bild↔Übung-Reihenfolge**: Annahme „i-tes Bild = i-te Übung pro Seite" — in Task 11
  stichprobenartig verifiziert.
