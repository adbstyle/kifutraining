"""Generiert docs/README.md (Index) und docs/uebungen/*.md aus den YAMLs."""
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
UEB = ROOT / "data" / "uebungen"
OUT = ROOT / "docs"
VOKABULAR = ROOT / "data" / "vokabular.yaml"
TEILE = ["auffangen", "einleitung", "hauptteil", "ausklang"]
TEIL_TITEL = {"auffangen": "Auffangen", "einleitung": "Einleitung",
              "hauptteil": "Hauptteil", "ausklang": "Ausklang"}


def render_exercise(doc, vocab):
    lines = [f"# {doc['name']}", ""]
    meta = [f"**Trainingsteil:** {doc['trainingsteil']}",
            f"**Kategorien:** {', '.join(doc['kategorien'])}"]
    formen = [vocab["erscheinungsform"].get(s, s) for s in doc.get("erscheinungsform") or []]
    if formen:
        meta.append(f"**Erscheinungsform:** {', '.join(formen)}")
    if doc.get("feldtyp"):
        meta.append(f"**Feldtyp:** {vocab['feldtyp'].get(doc['feldtyp'], doc['feldtyp'])}")
    if doc.get("thema"):
        meta.append(f"**Thema:** {doc['thema']}")
    if doc.get("spielform"):
        meta.append(f"**Spielform:** {doc['spielform']}")
    lines += [" · ".join(meta), ""]
    if doc.get("bild"):
        lines += [f"![{doc['name']}](../{doc['bild']})", ""]
    lines += ["## Offen starten", "", doc["aufbau"], ""]
    if doc.get("ueben"):
        lines += ["## Üben", ""] + [f"- {u}" for u in doc["ueben"]] + [""]
    if doc.get("wetteifern"):
        lines += ["## Wett-eifern", "", doc["wetteifern"], ""]
    if doc.get("varianten"):
        lines += ["## Varianten", ""] + [f"- {v}" for v in doc["varianten"]] + [""]
    lines += ["---", f"*Quelle: {doc['quelle']['datei']}, S. {doc['quelle']['seite']}*"]
    return "\n".join(lines)


def main():
    vocab = yaml.safe_load(VOKABULAR.read_text(encoding="utf-8"))
    docs = [yaml.safe_load(f.read_text(encoding="utf-8"))
            for f in sorted(UEB.glob("*.yaml"))]
    (OUT / "uebungen").mkdir(parents=True, exist_ok=True)
    for doc in docs:
        (OUT / "uebungen" / f"{doc['id']}.md").write_text(
            render_exercise(doc, vocab), encoding="utf-8")

    idx = ["# Übungs-Datenbank Kinderfussball", "",
           f"{len(docs)} Übungen aus dem Manual Kinderfussball.", ""]
    for teil in TEILE:
        group = [d for d in docs if d["trainingsteil"] == teil]
        if not group:
            continue
        idx.append(f"## {TEIL_TITEL[teil]}")
        idx.append("")
        for d in sorted(group, key=lambda x: (x.get("thema") or "", x["name"])):
            thema = f" _({d['thema']})_" if d.get("thema") else ""
            idx.append(f"- [{d['name']}](uebungen/{d['id']}.md)"
                       f" – {', '.join(d['kategorien'])}{thema}")
        idx.append("")
    (OUT / "README.md").write_text("\n".join(idx), encoding="utf-8")
    print(f"{len(docs)} Übungsseiten + Index generiert in {OUT}/")


if __name__ == "__main__":
    main()
