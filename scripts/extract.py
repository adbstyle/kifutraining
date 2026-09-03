"""Extrahiert die Übungstexte aus dem Manual nach data/uebungen/.

Das Manual-PDF liegt NICHT im Repo (fremdes Werk, `sources/` ist ignoriert) —
es muss lokal unter sources/Manual_Kinderfussball_D.pdf vorhanden sein.
"""
import subprocess
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parser

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "sources" / "Manual_Kinderfussball_D.pdf"
UEB = ROOT / "data" / "uebungen"

# Seite -> (trainingsteil, [erscheinungsform-slugs])
PAGE_META = {60: ("auffangen", [])}
PAGE_META.update({p: ("einleitung", []) for p in range(61, 65)})
PAGE_META.update({p: ("hauptteil", ["spiel-kreativ-gestalten", "ball-entschlossen-erobern"]) for p in range(65, 75)})
PAGE_META.update({p: ("hauptteil", ["mutig-tore-erzielen", "mutig-tore-verhindern"]) for p in range(75, 80)})
PAGE_META[80] = ("hauptteil", ["flink-geschickt-bewegen"])
PAGE_META[81] = ("hauptteil", ["respektvoll-fair-spielen"])
PAGE_META[82] = ("ausklang", [])

# Seite -> Hauptteilkategorie. Der Hauptteil ist im Manual seitenweise in drei
# Inhalte gegliedert (Abbildung 14, «Trainingsschema im Kinderfussball»); die
# gedruckte Seite ist massgeblich (Enabler #21). Nur Hauptteil-Seiten gelistet.
PAGE_HAUPTTEILKATEGORIE = {p: "fussball-spielen-lernen" for p in range(65, 80)}
PAGE_HAUPTTEILKATEGORIE[80] = "vielseitigkeit-erleben"
PAGE_HAUPTTEILKATEGORIE[81] = "fussball-spielen"


def feldtyp_aus_text(text):
    """Feldtyp best-effort aus Schlüsselwörtern ableiten; None wenn unklar."""
    low = text.lower()
    if "grossfeld" in low:
        return "grossfeld"
    if "kleinfeld" in low or "viereck" in low:
        return "kleinfeld"
    if "freies feld" in low or "frei auf" in low or "freien feld" in low:
        return "freies_feld"
    return None


def page_text(page):
    return subprocess.run(
        ["pdftotext", "-f", str(page), "-l", str(page), "-layout", str(PDF), "-"],
        capture_output=True, text=True, check=True).stdout


def main():
    if not PDF.exists():
        sys.exit(
            f"Manual-PDF fehlt: {PDF}\n"
            "sources/ ist nicht Teil des Repos — das PDF lokal dorthin legen.")
    UEB.mkdir(parents=True, exist_ok=True)

    count = 0
    seen_ids: set = set()
    for page in range(60, 83):
        teil, erschein = PAGE_META[page]
        text = page_text(page)

        blocks = parser.split_page_into_exercises(text)
        for block in blocks:
            ex = parser.parse_exercise_block(block)
            if not ex["name"]:
                continue
            uid = parser.slugify(ex["name"])

            if uid in seen_ids:
                raise ValueError(f"Doppelte ID: {uid} (Seite {page})")
            seen_ids.add(uid)

            doc = {
                "id": uid,
                "name": ex["name"],
                "trainingsteil": teil,
                "erscheinungsform": erschein,
                "feldtyp": feldtyp_aus_text(block),
                "kategorien": ex["kategorien"],
                "anzahl_kinder": None,
                "material": [],
            }
            # Hauptteilkategorie nur bei Hauptteil-Übungen (Enabler #21);
            # andere Trainingsteile bleiben frei davon.
            if teil == "hauptteil":
                doc["hauptteilkategorie"] = PAGE_HAUPTTEILKATEGORIE[page]
            # Übungsablauf je Trainingsteil: einleitung/hauptteil als
            # methodischer_fahrplan-Block (der geparste "Offen"-Text ist das
            # offen_starten), auffangen/ausklang als flaches aufbau-Feld.
            if teil in ("einleitung", "hauptteil"):
                doc["methodischer_fahrplan"] = {
                    "offen_starten": ex["aufbau"],
                    "ueben": ex["ueben"],
                    "wetteifern": ex["wetteifern"],
                }
            else:
                doc["aufbau"] = ex["aufbau"]
            doc.update({
                "varianten": [],
                "quelle": {"datei": PDF.name, "seite": page},
            })
            (UEB / f"{uid}.yaml").write_text(
                yaml.safe_dump(doc, allow_unicode=True, sort_keys=False),
                encoding="utf-8")
            count += 1
    print(f"{count} Übungen extrahiert nach {UEB}/")


if __name__ == "__main__":
    main()
