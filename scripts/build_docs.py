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
    if doc.get("hauptteilkategorie"):
        kat = doc["hauptteilkategorie"]
        meta.append(f"**Hauptteilkategorie:** {vocab['hauptteilkategorie'].get(kat, kat)}")
    formen = [vocab["erscheinungsform"].get(s, s) for s in doc.get("erscheinungsform") or []]
    if formen:
        meta.append(f"**Erscheinungsform:** {', '.join(formen)}")
    if doc.get("feldtyp"):
        meta.append(f"**Feldtyp:** {vocab['feldtyp'].get(doc['feldtyp'], doc['feldtyp'])}")
    lines += [" · ".join(meta), ""]
    fahrplan = doc.get("methodischer_fahrplan")
    if fahrplan:
        lines += ["## Offen starten", "", fahrplan["offen_starten"], ""]
        if fahrplan.get("ueben"):
            lines += ["## Üben", ""] + [f"- {u}" for u in fahrplan["ueben"]] + [""]
        if fahrplan.get("wetteifern"):
            lines += ["## Wett-eifern", "", fahrplan["wetteifern"], ""]
    elif doc.get("aufbau"):
        lines += ["## Aufbau", "", doc["aufbau"], ""]
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
        for d in sorted(group, key=lambda x: x["name"]):
            idx.append(f"- [{d['name']}](uebungen/{d['id']}.md)"
                       f" – {', '.join(d['kategorien'])}")
        idx.append("")
    (OUT / "README.md").write_text("\n".join(idx), encoding="utf-8")
    print(f"{len(docs)} Übungsseiten + Index generiert in {OUT}/")


if __name__ == "__main__":
    main()
