"""Extrahiert Übungen + Diagramme aus dem Manual in data/ und images/."""
import subprocess
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parser

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "sources" / "Manual_Kinderfussball_D.pdf"
UEB = ROOT / "data" / "uebungen"
IMAGES = ROOT / "images"

# Seite -> (trainingsteil, [erscheinungsform-slugs])
PAGE_META = {60: ("auffangen", [])}
PAGE_META.update({p: ("einleitung", []) for p in range(61, 65)})
PAGE_META.update({p: ("hauptteil", ["spiel-kreativ-gestalten", "ball-entschlossen-erobern"]) for p in range(65, 75)})
PAGE_META.update({p: ("hauptteil", ["mutig-tore-erzielen", "mutig-tore-verhindern"]) for p in range(75, 80)})
PAGE_META[80] = ("hauptteil", ["flink-geschickt-bewegen"])
PAGE_META[81] = ("hauptteil", ["respektvoll-fair-spielen"])
PAGE_META[82] = ("ausklang", [])


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


def extract_images(page, dest_prefix):
    """Eingebettete Bilder einer Seite als PNG; gibt sortierte Pfade zurück."""
    subprocess.run(["pdfimages", "-png", "-f", str(page), "-l", str(page),
                    str(PDF), str(dest_prefix)], check=True, capture_output=True)
    return sorted(dest_prefix.parent.glob(dest_prefix.name + "-*.png"))


def main():
    for d in (UEB, IMAGES):
        d.mkdir(parents=True, exist_ok=True)
    tmp = IMAGES / "_tmp"
    tmp.mkdir(exist_ok=True)

    count = 0
    seen_ids: set = set()
    try:
        for page in range(60, 83):
            teil, erschein = PAGE_META[page]
            text = page_text(page)

            blocks = parser.split_page_into_exercises(text)
            imgs = extract_images(page, tmp / f"p{page}")

            named_count = 0
            for i, block in enumerate(blocks):
                ex = parser.parse_exercise_block(block)
                if not ex["name"]:
                    continue
                uid = parser.slugify(ex["name"])

                if uid in seen_ids:
                    raise ValueError(f"Doppelte ID: {uid} (Seite {page})")
                seen_ids.add(uid)

                bild = None
                if i < len(imgs):
                    bild = f"images/{uid}.png"
                    imgs[i].replace(IMAGES / f"{uid}.png")

                doc = {
                    "id": uid,
                    "name": ex["name"],
                    "trainingsteil": teil,
                    "erscheinungsform": erschein,
                    "feldtyp": feldtyp_aus_text(block),
                    "kategorien": ex["kategorien"],
                    "spielform": ex["spielform"],
                    "anzahl_kinder": None,
                    "material": [],
                }
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
                    "bild": bild,
                    "quelle": {"datei": PDF.name, "seite": page},
                })
                (UEB / f"{uid}.yaml").write_text(
                    yaml.safe_dump(doc, allow_unicode=True, sort_keys=False),
                    encoding="utf-8")
                count += 1
                named_count += 1

            if len(imgs) != named_count:
                print(
                    f"WARNUNG: Seite {page}: {len(imgs)} Bilder, aber {named_count} Übungen",
                    file=sys.stderr,
                )
    finally:
        for leftover in tmp.glob("*"):
            leftover.unlink()
        tmp.rmdir()
    print(f"{count} Übungen extrahiert nach {UEB}/")


if __name__ == "__main__":
    main()
