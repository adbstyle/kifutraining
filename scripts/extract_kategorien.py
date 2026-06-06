"""Story 2 — Alterskategorien je Übung aus den PDF-Badges gewinnen.

Der Textlayer des Manuals enthält für jede Übung immer alle drei Buchstaben
G/F/E; nur die FARBE der Badge-Box unterscheidet gültig (gesättigt: G=gelb,
F=orange, E=rot) von ungültig (entsättigt/ausgegraut). Dieses Skript rendert
jede Manual-Seite, klassifiziert je Übungs-Header die drei Badge-Boxen per
Pixel-Sättigung und ordnet sie über die Lese-Reihenfolge (parser) den Slugs zu.

  --write   schreibt die korrigierten kategorien in die YAMLs zurück
  (ohne)    Dry-Run: nur Report (alt -> neu, Mismatches)

Kalibriert bei 150 DPI auf A4 (1241x1754). Box-Zentren x≈[1010,1055,1100].
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parser as P

ROOT = Path(__file__).resolve().parent.parent
UEB = ROOT / "data" / "uebungen"
PDF = ROOT / "sources" / "Manual_Kinderfussball_D.pdf"
DPI = 150

# Badge-Geometrie (150 DPI). Die Badge-Spalte ist NICHT seitenkonstant
# positioniert (±30px), aber die Box-Folge G·F·E ist rechtsbündig im
# cremefarbenen Header-Balken mit fixem Raster. Daher pro Band an der rechten
# Header-Kante ankern: E=hr-25, F=hr-70, G=hr-115 (PITCH 45, PAD 25).
BADGE_X0, BADGE_X1 = 980, 1135    # X-Fenster für Band-Erkennung
PAD, PITCH = 25, 45               # E-Offset zur Header-Kante, Box-Abstand
PATCH = 7                # halbe Patch-Grösse fürs Sampling
SAT_ACTIVE = 160         # Sättigungsschwelle aktiv/inaktiv
VAL_MIN = 110            # Mindesthelligkeit (schliesst dunkle Flächen aus)


def load_pages():
    """slug + aktuelle kategorien je gedruckter Seite."""
    pages = {}
    for f in sorted(UEB.glob("*.yaml")):
        d = yaml.safe_load(f.read_text(encoding="utf-8"))
        pages.setdefault(d["quelle"]["seite"], []).append(
            {"slug": d["id"], "alt": d["kategorien"], "file": f, "doc": d})
    return pages


def reading_order(page_no):
    """Übungsnamen einer Seite in Lese-Reihenfolge (oben->unten) via parser."""
    txt = subprocess.run(
        ["pdftotext", "-layout", "-f", str(page_no), "-l", str(page_no),
         str(PDF), "-"], capture_output=True, text=True).stdout
    blocks = P.split_page_into_exercises(txt)
    names = []
    for b in blocks:
        title, _ = P.split_title_and_categories(b.splitlines()[0])
        names.append(title)
    return names


def render(page_no):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-f", str(page_no), "-l", str(page_no),
                        "-r", str(DPI), "-png", str(PDF), f"{tmp}/p"],
                       check=True, capture_output=True)
        png = next(Path(tmp).glob("*.png"))
        return Image.open(png).convert("RGB"), Image.open(png).convert("HSV")


def detect_bands(hsv, n_expected):
    """y-Zentren der Übungs-Header (oben->unten), erkannt an gesättigten
    Badge-Pixeln im Badge-X-Fenster (Feld-Illustrationen sind ausgeblendet)."""
    S = np.array(hsv)[:, :, 1]
    V = np.array(hsv)[:, :, 2]
    Hh = np.array(hsv)[:, :, 0]
    vibrant = (S > SAT_ACTIVE) & (V > VAL_MIN) & ((Hh < 48) | (Hh > 232))
    col = vibrant[:, BADGE_X0:BADGE_X1]
    rowsum = col.sum(axis=1)
    # y<70 ignorieren: auf rechten (ungeraden) Seiten sitzt dort eine rote
    # Kapitel-Tab-Markierung in der Badge-Spalte, die sonst ein Phantom-Band gäbe.
    rows = [y for y in range(70, len(rowsum)) if rowsum[y] > 8]
    bands = []
    if rows:
        s = p = rows[0]
        for y in rows[1:]:
            if y - p > 25:
                bands.append((s + p) // 2)
                s = y
            p = y
        bands.append((s + p) // 2)
    return bands


def header_right(H, yc):
    """Rechte Kante des Header-Balkens: rechtester nicht-reinweisser Pixel."""
    row = H[yc]
    for x in range(BADGE_X1, BADGE_X0, -1):
        if not (row[x, 1] < 18 and row[x, 2] > 244):
            return x
    return BADGE_X1


def classify(rgb_hsv, yc):
    rgb, hsv = rgb_hsv
    H = np.array(hsv)
    hr = header_right(H, yc)
    centers = {"E": hr - PAD, "F": hr - PAD - PITCH, "G": hr - PAD - 2 * PITCH}
    cats = []
    detail = {}
    for cat in ("G", "F", "E"):
        xc = centers[cat]
        patch = H[yc - PATCH:yc + PATCH, xc - PATCH:xc + PATCH]
        s = int(np.median(patch[:, :, 1]))
        v = int(np.median(patch[:, :, 2]))
        active = s > SAT_ACTIVE and v > VAL_MIN
        detail[cat] = (s, v, active)
        if active:
            cats.append(cat)
    return cats, detail


def main():
    write = "--write" in sys.argv
    pages = load_pages()
    changed = mism = 0
    for page_no in sorted(pages):
        exs = pages[page_no]
        names = reading_order(page_no)
        order = []
        # Namen -> Slug über Suffix-Match (slug == slugify(name) o. mit Präfix davor)
        for nm in names:
            sl = P.slugify(nm)
            match = next((e for e in exs if e["slug"] == sl or e["slug"].endswith("-" + sl)), None)
            order.append(match)
        rgb, hsv = render(page_no)
        bands = detect_bands(hsv, len(exs))
        ok = len(bands) == len(exs) and all(order) and len(names) == len(exs)
        if not ok:
            mism += 1
            print(f"⚠  S.{page_no}: {len(exs)} Übungen, {len(bands)} Bänder, "
                  f"{len(names)} Namen, Matches {sum(1 for o in order if o)} — MANUELL PRÜFEN")
        for i, yc in enumerate(bands):
            if i >= len(order) or order[i] is None:
                continue
            e = order[i]
            cats, detail = classify((rgb, hsv), yc)
            if not cats:
                print(f"⚠  S.{page_no} {e['slug']}: KEINE aktive Kategorie erkannt {detail}")
                continue
            mark = "" if cats == e["alt"] else "  ← Änderung"
            if cats != e["alt"]:
                changed += 1
            print(f"S.{page_no} {e['slug']:55s} {''.join(e['alt']):3s} -> {''.join(cats):3s}{mark}")
            if write:
                e["doc"]["kategorien"] = cats
                e["file"].write_text(
                    yaml.safe_dump(e["doc"], allow_unicode=True, sort_keys=False),
                    encoding="utf-8")
    print(f"\n{changed} Übungen geändert, {mism} Seiten mit Mismatch.")


if __name__ == "__main__":
    main()
