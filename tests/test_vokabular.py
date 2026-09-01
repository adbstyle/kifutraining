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


def test_vokabular_altersstufe():
    """Die Altersstufe steht in derselben kontrollierten Quelle wie alles andere.

    Story 1 AC 10 (Epic Übungswelten): Sie ist die oberste Dimension — welches
    Lehrmittel für eine Übung und ein Training gilt. Genau zwei Werte, mehr
    kennt die Fachlichkeit nicht.
    """
    vocab = yaml.safe_load(Path("data/vokabular.yaml").read_text(encoding="utf-8"))

    assert list(vocab["altersstufe"]) == ["kinderfussball", "juniorenfussball"]
    assert vocab["altersstufe"]["kinderfussball"] == "Kinderfussball"
    assert vocab["altersstufe"]["juniorenfussball"] == "Juniorenfussball"

    # Die Alterskategorien teilen sich überschneidungsfrei auf die beiden
    # Altersstufen auf — das ist die Regel, die die DB-Constraints
    # `ex_kategorien_je_altersstufe` und `training_stufen_je_altersstufe`
    # durchsetzen.
    kifu = {"G", "F", "E"}
    junioren = {"D", "C", "B", "A"}
    assert kifu | junioren == set(vocab["kategorien"])
    assert not kifu & junioren


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

    # Junioren-Strukturen vollständig und in der Reihenfolge des Manuals — dem
    # das «Auffangen» vorangestellt ist (Story #128, PO-Entscheid 2026-08-31):
    # eine bewusste Erweiterung über das Manual hinaus, die Zeit vor dem
    # eigentlichen Trainingsbeginn.
    assert list(vocab["junioren_trainingsteil"]) == [
        "auffangen", "einstieg", "hauptteil", "abschluss",
    ]
    assert list(vocab["junioren_block"]) == [
        "jun-auffangen", "jun-aufwaermen", "jun-spielform-trainingsziel",
        "jun-explosivitaet", "jun-spielformen", "jun-spiel", "jun-abschluss",
    ]
    # Das Auffangen steht in beiden Altersstufen vor allem anderen, und die
    # Sortierung der Einordnungen folgt genau dieser Reihenfolge
    # (EINORDNUNG_RANG in web/lib/queries/trainings.ts) — darum je der ERSTE
    # Eintrag. Es heisst in beiden Stufen gleich; unterschieden werden die
    # beiden in der Filterleiste über die Gruppierung nach Altersstufe.
    assert list(vocab["trainingsteil"])[0] == "auffangen"
    assert vocab["junioren_block"]["jun-auffangen"] == vocab["trainingsteil"]["auffangen"]
    # Der Abschluss ist EIN Block ohne Untergliederung (Story #127, PO-Entscheid
    # 2026-08-31): Sein Block trägt darum den Namen des Trainingsteils, und der
    # Begriff «Ausklang» kommt im Juniorenfussball nicht mehr vor — im
    # Kinderfussball bleibt er als Trainingsteil unverändert.
    assert vocab["junioren_block"]["jun-abschluss"] == "Abschluss"
    assert not any("Ausklang" in v for v in vocab["junioren_block"].values())
    # Kein eigenes «Heimat»-Vokabular mehr: seit Story 3 (Epic Übungswelten)
    # kann eine Junioren-Übung in JEDEM der sieben Blöcke zuhause sein, nicht
    # mehr nur in den drei Einstiegs-Blöcken. `junioren_block` ist damit die
    # eine Liste; die Teilmenge `junioren_heimat` ist ersatzlos entfallen.
    assert "junioren_heimat" not in vocab

    assert list(vocab["uebungstyp"]) == ["basisspielform", "spielform", "isolierte-form"]

    # Die 11 Erscheinungsformen des Junioren-Manuals (Tabelle 4, S. 21)
    assert len(vocab["erscheinungsform_junioren"]) == 11
    # Keine Slug-Kollision zwischen den beiden Erscheinungsform-Vokabularen:
    # sie bilden eine gemeinsame Filter-Dimension (Story 12 PC 1).
    assert not set(vocab["erscheinungsform_junioren"]) & set(vocab["erscheinungsform"])
