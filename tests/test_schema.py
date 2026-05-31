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
        "feldtyp": "kleinfeld",
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
