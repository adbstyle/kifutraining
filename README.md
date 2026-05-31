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
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/validate.py     # Daten prüfen
.venv/bin/python scripts/build_docs.py   # Markdown-Ansicht neu bauen
.venv/bin/pytest                         # Parser-Tests
```
