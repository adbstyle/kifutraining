"""Einmalige Datenmigration: Hauptteilkategorie in bestehende Übungs-YAMLs.

Ordnet jeder Hauptteil-Übung deterministisch ihre Hauptteilkategorie zu, anhand
der gedruckten Manual-Seite (`quelle.seite`). Massgeblich ist der Abschnitt, in
dem die Übung steht — nicht der (teils irreführende) Slug-Präfix (Enabler #21,
AC5). Andere Trainingsteile bleiben unverändert und frei von der Kategorie.

Bewusst getrennt von extract.py: ein erneuter Voll-Extract würde IDs/Slugs der
bereits committeten Dateien verändern. Diese Migration editiert nur in-place und
fügt das eine neue Feld hinzu (idempotent — mehrfach ausführbar).

Aufruf: .venv/bin/python scripts/migrate_hauptteilkategorie.py
"""
from pathlib import Path

import yaml

from extract import PAGE_HAUPTTEILKATEGORIE

ROOT = Path(__file__).resolve().parent.parent
UEB = ROOT / "data" / "uebungen"


def migrate_doc(doc: dict) -> bool:
    """Setzt hauptteilkategorie passend zum Trainingsteil. True, wenn geändert."""
    if doc.get("trainingsteil") != "hauptteil":
        # Nicht-Hauptteil-Übungen tragen keine Kategorie (Postcondition 2).
        return doc.pop("hauptteilkategorie", None) is not None

    seite = doc["quelle"]["seite"]
    kat = PAGE_HAUPTTEILKATEGORIE.get(seite)
    if kat is None:
        raise ValueError(
            f"{doc['id']}: Hauptteil-Übung auf Seite {seite} ohne Kategorie-Zuordnung "
            f"in PAGE_HAUPTTEILKATEGORIE (extract.py)."
        )
    if doc.get("hauptteilkategorie") == kat:
        return False

    # Feld direkt nach feldtyp einsortieren (zu den übrigen Hauptteil-Dimensionen).
    neu = {}
    for key, value in doc.items():
        if key == "hauptteilkategorie":
            continue  # alten Platz überspringen, gleich neu setzen
        neu[key] = value
        if key == "feldtyp":
            neu["hauptteilkategorie"] = kat
    if "hauptteilkategorie" not in neu:  # falls feldtyp fehlt: ans Ende
        neu["hauptteilkategorie"] = kat
    doc.clear()
    doc.update(neu)
    return True


def main() -> None:
    geaendert = 0
    for f in sorted(UEB.glob("*.yaml")):
        doc = yaml.safe_load(f.read_text(encoding="utf-8"))
        if migrate_doc(doc):
            f.write_text(
                yaml.safe_dump(doc, allow_unicode=True, sort_keys=False),
                encoding="utf-8",
            )
            geaendert += 1
    print(f"{geaendert} Übungen aktualisiert.")


if __name__ == "__main__":
    main()
