import json
from pathlib import Path
import yaml

def test_vokabular_matches_schema_enums():
    vocab = yaml.safe_load(Path("data/vokabular.yaml").read_text(encoding="utf-8"))
    schema = json.loads(Path("schema/uebung.schema.json").read_text(encoding="utf-8"))
    props = schema["properties"]

    assert set(vocab["erscheinungsform"]) == set(props["erscheinungsform"]["items"]["enum"])
    assert set(vocab["feldtyp"]) == {v for v in props["feldtyp"]["enum"] if v is not None}
    assert set(vocab["trainingsteil"]) == set(props["trainingsteil"]["enum"])
    assert set(vocab["hauptteilkategorie"]) == set(props["hauptteilkategorie"]["enum"])


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


def test_vokabular_kategorien_und_junioren_bloecke():
    """Alterskategorien und Junioren-Strukturen kommen aus der einen Quelle.

    Story 2 AC 7 / Story 9 AC 8 / Story 12 AC 6 (Epic #71): Die Werte stehen
    kanonisch in data/vokabular.yaml — früher waren die Alterskategorien im
    Vokabular-Generator hartkodiert, im Widerspruch zur Ein-Quellen-Regel.
    """
    vocab = yaml.safe_load(Path("data/vokabular.yaml").read_text(encoding="utf-8"))
    schema = json.loads(Path("schema/uebung.schema.json").read_text(encoding="utf-8"))
    props = schema["properties"]

    # Alterskategorien: fachliche Reihenfolge G→A (Story 2 AC 6)
    assert list(vocab["kategorien"]) == ["G", "F", "E", "D", "C", "B", "A"]
    assert list(vocab["kategorien"]) == props["kategorien"]["items"]["enum"]

    # Junioren-Strukturen vollständig und in der Reihenfolge des Manuals
    assert list(vocab["junioren_trainingsteil"]) == ["einstieg", "hauptteil", "abschluss"]
    assert list(vocab["junioren_block"]) == [
        "jun-aufwaermen", "jun-spielform-trainingsziel", "jun-explosivitaet",
        "jun-spielformen", "jun-spiel", "jun-ausklang",
    ]
    assert list(vocab["junioren_heimat"]) == [
        "jun-aufwaermen", "jun-spielform-trainingsziel", "jun-explosivitaet",
    ]
    # Heimaten sind eine Teilmenge der Blöcke: gleicher Slug ⇒ die Heimat einer
    # Übung IST ihr Einordnungs-Vorschlag (Entscheidungsdokument §4).
    assert set(vocab["junioren_heimat"]) <= set(vocab["junioren_block"])

    assert list(vocab["uebungstyp"]) == ["basisspielform", "spielform", "isolierte-form"]

    # Die 11 Erscheinungsformen des Junioren-Manuals (Tabelle 4, S. 21)
    assert len(vocab["erscheinungsform_junioren"]) == 11
    # Keine Slug-Kollision zwischen den beiden Erscheinungsform-Vokabularen:
    # sie bilden eine gemeinsame Filter-Dimension (Story 12 PC 1).
    assert not set(vocab["erscheinungsform_junioren"]) & set(vocab["erscheinungsform"])
