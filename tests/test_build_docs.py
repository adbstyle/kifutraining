import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import build_docs

VOCAB = {
    "erscheinungsform": {"spiel-kreativ-gestalten": "Das Spiel kreativ gestalten",
                         "ball-entschlossen-erobern": "Den Ball entschlossen erobern"},
    "feldtyp": {"kleinfeld": "Kleinfeld"},
}

def test_render_exercise_markdown():
    doc = {
        "id": "dribbling-wechseltore", "name": "Wechseltore",
        "trainingsteil": "hauptteil", "thema": "dribbling",
        "erscheinungsform": ["spiel-kreativ-gestalten", "ball-entschlossen-erobern"],
        "feldtyp": "kleinfeld",
        "kategorien": ["G", "F", "E"], "spielform": "3:3",
        "methodischer_fahrplan": {
            "offen_starten": "Zwei Teams spielen 3:3.",
            "ueben": ["Täuschen und dribbeln"],
            "wetteifern": "Welches Team erzielt mehr Tore?",
        },
        "bild": "images/dribbling-wechseltore.png",
        "quelle": {"datei": "Manual_Kinderfussball_D.pdf", "seite": 65},
    }
    md = build_docs.render_exercise(doc, VOCAB)
    assert md.startswith("# Wechseltore")
    assert "**Kategorien:** G, F, E" in md
    assert "**Feldtyp:** Kleinfeld" in md
    assert "Das Spiel kreativ gestalten" in md
    assert "## Offen starten" in md
    assert "Zwei Teams spielen 3:3." in md
    assert "- Täuschen und dribbeln" in md
    assert "## Wett-eifern" in md
    assert "![Wechseltore](../images/dribbling-wechseltore.png)" in md


def test_render_auffangen_aufbau():
    doc = {
        "id": "dribblestart", "name": "Dribblestart",
        "trainingsteil": "auffangen", "kategorien": ["G", "F", "E"],
        "aufbau": "Den Kindern steht vor dem Training ein Feld zur Verfügung.",
        "quelle": {"datei": "Manual_Kinderfussball_D.pdf", "seite": 60},
    }
    md = build_docs.render_exercise(doc, VOCAB)
    assert "## Aufbau" in md
    assert "Den Kindern steht vor dem Training ein Feld zur Verfügung." in md
    assert "## Offen starten" not in md
