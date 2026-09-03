"""Das SFV-Manual als lokale Quelle der Extraktions-Skripte.

Die PDF ist fremdes Werk und liegt nicht im Repo (`sources/` ist ignoriert);
wer extract.py oder extract_kategorien.py laufen lässt, legt sie lokal ab.
Dazu braucht es poppler (`pdftotext`, `pdftoppm`) im PATH.
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "sources" / "Manual_Kinderfussball_D.pdf"


def require_pdf(*tools: str) -> None:
    """Bricht mit klarer Meldung ab, wenn das Manual-PDF oder ein Werkzeug fehlt."""
    fehlt = []
    if not PDF.exists():
        fehlt.append(f"Manual-PDF fehlt: {PDF}\n"
                     "  sources/ ist nicht Teil des Repos — das PDF lokal dorthin legen.")
    for tool in tools:
        if shutil.which(tool) is None:
            fehlt.append(f"Werkzeug fehlt im PATH: {tool}\n"
                         "  gehört zu poppler (macOS: `brew install poppler`).")
    if fehlt:
        sys.exit("\n".join(fehlt))
