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
        "erscheinungsform": ["spiel-kreativ-gestalten", "ball-entschlossen-erobern"],
        "hauptteilkategorie": "fussball-spielen-lernen",
        "feldtyp": "kleinfeld",
        "kategorien": ["G", "F", "E"],
        "methodischer_fahrplan": {
            "offen_starten": "Zwei Teams spielen 3:3.",
            "ueben": ["Täuschen"],
            "wetteifern": "Welches Team erzielt mehr Tore?",
        },
        "quelle": {"datei": "Manual_Kinderfussball_D.pdf", "seite": 65},
    }
    assert list(v.iter_errors(doc)) == []


def test_einleitung_ohne_fahrplan_fails():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = {"id": "x", "name": "X", "trainingsteil": "einleitung",
           "kategorien": ["G"], "aufbau": "Setup ohne Fahrplan",
           "quelle": {"datei": "a.pdf", "seite": 1}}
    assert list(v.iter_errors(doc)) != []


def test_auffangen_ohne_aufbau_fails():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = {"id": "x", "name": "X", "trainingsteil": "auffangen",
           "kategorien": ["G"],
           "quelle": {"datei": "a.pdf", "seite": 1}}
    assert list(v.iter_errors(doc)) != []


def test_auffangen_mit_aufbau_passes():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = {"id": "x", "name": "X", "trainingsteil": "auffangen",
           "kategorien": ["G"], "aufbau": "Den Kindern steht ein Feld zur Verfügung.",
           "quelle": {"datei": "a.pdf", "seite": 1}}
    assert list(v.iter_errors(doc)) == []

def test_invalid_trainingsteil_fails():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = {"id": "x", "name": "X", "trainingsteil": "quatsch",
           "kategorien": ["G"], "aufbau": "...",
           "quelle": {"datei": "a.pdf", "seite": 1}}
    assert list(v.iter_errors(doc)) != []

def test_invalid_feldtyp_fails():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = {"id": "x", "name": "X", "trainingsteil": "auffangen",
           "feldtyp": "fussballplatz", "kategorien": ["G"], "aufbau": "...",
           "quelle": {"datei": "a.pdf", "seite": 1}}
    assert list(v.iter_errors(doc)) != []

def test_invalid_erscheinungsform_slug_fails():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = {"id": "x", "name": "X", "trainingsteil": "hauptteil",
           "erscheinungsform": ["nicht-im-vokabular"], "kategorien": ["G"],
           "aufbau": "...", "quelle": {"datei": "a.pdf", "seite": 1}}
    assert list(v.iter_errors(doc)) != []


def _hauptteil_doc(**extra):
    """Minimal gültige Hauptteil-Übung (ohne Hauptteilkategorie) als Basis."""
    doc = {"id": "x", "name": "X", "trainingsteil": "hauptteil",
           "kategorien": ["G"],
           "methodischer_fahrplan": {"offen_starten": "Start."},
           "quelle": {"datei": "a.pdf", "seite": 65}}
    doc.update(extra)
    return doc


def test_hauptteil_ohne_hauptteilkategorie_fails():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    assert list(v.iter_errors(_hauptteil_doc())) != []


def test_hauptteil_mit_hauptteilkategorie_passes():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = _hauptteil_doc(hauptteilkategorie="vielseitigkeit-erleben")
    assert list(v.iter_errors(doc)) == []


def test_invalid_hauptteilkategorie_slug_fails():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = _hauptteil_doc(hauptteilkategorie="nicht-im-vokabular")
    assert list(v.iter_errors(doc)) != []


def test_nicht_hauptteil_mit_hauptteilkategorie_fails():
    """Andere Trainingsteile dürfen keine Hauptteilkategorie tragen (Postcondition 2)."""
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = {"id": "x", "name": "X", "trainingsteil": "ausklang",
           "kategorien": ["G"], "aufbau": "Ausklang-Aufbau.",
           "hauptteilkategorie": "fussball-spielen",
           "quelle": {"datei": "a.pdf", "seite": 82}}
    assert list(v.iter_errors(doc)) != []


# ── Ablauf-Form je Hauptteilkategorie (Epic #72, Story 2) ────────────────────
# «Fussball spielen» ist das freie Spiel und trägt eine Beschreibung im Feld
# `aufbau` statt des methodischen Fahrplans.

def _fussball_spielen_doc(**extra):
    """Hauptteil-Übung der Kategorie «Fussball spielen» mit Beschreibung."""
    doc = _hauptteil_doc(hauptteilkategorie="fussball-spielen",
                         aufbau="Die Kinder spielen frei auf zwei Tore.")
    doc.pop("methodischer_fahrplan", None)
    doc.update(extra)
    return doc


def test_fussball_spielen_mit_beschreibung_passes():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    assert list(v.iter_errors(_fussball_spielen_doc())) == []


def test_fussball_spielen_mit_fahrplan_fails():
    """Der Fahrplan ist in dieser Kategorie nicht mehr zulässig."""
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = _fussball_spielen_doc(
        methodischer_fahrplan={"offen_starten": "Start."})
    assert list(v.iter_errors(doc)) != []


def test_fussball_spielen_ohne_beschreibung_fails():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = _fussball_spielen_doc()
    doc.pop("aufbau")
    assert list(v.iter_errors(doc)) != []


def test_fussball_spielen_mit_leerer_beschreibung_fails():
    """Vollständig heisst: die Beschreibung ist nicht leer (PO 2026-08-22)."""
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    assert list(v.iter_errors(_fussball_spielen_doc(aufbau=""))) != []


def test_andere_hauptteilkategorie_braucht_weiterhin_fahrplan():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    doc = _hauptteil_doc(hauptteilkategorie="fussball-spielen-lernen",
                         aufbau="Nur eine Beschreibung genügt hier nicht.")
    doc.pop("methodischer_fahrplan")
    assert list(v.iter_errors(doc)) != []
