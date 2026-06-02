"""Einmalige, idempotente Migration: flache aufbau/ueben/wetteifern-Felder ->
methodischer_fahrplan-Block (einleitung/hauptteil). Siehe
docs/superpowers/specs/2026-06-01-methodischer-fahrplan-design.md.

- einleitung/hauptteil: methodischer_fahrplan = {offen_starten: <aufbau>,
  ueben: <ueben>, wetteifern: <wetteifern>}; flache Felder entfernt; der Block
  wird an der Stelle eingefügt, an der zuvor `aufbau` stand (Reihenfolge stabil).
- auffangen/ausklang: aufbau bleibt; leere ueben/wetteifern entfernt.

Idempotent: bereits migrierte Dateien (kein Top-Level ueben/wetteifern) werden
übersprungen.
"""
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
UEB = ROOT / "data" / "uebungen"
FAHRPLAN_TEILE = {"einleitung", "hauptteil"}


def migrate_doc(doc: dict) -> dict | None:
    """Gibt das migrierte Dokument zurück oder None, wenn nichts zu tun ist."""
    teil = doc.get("trainingsteil")
    hat_flache_felder = "ueben" in doc or "wetteifern" in doc

    if teil in FAHRPLAN_TEILE:
        if "methodischer_fahrplan" in doc:
            return None  # bereits migriert
        block = {
            "offen_starten": doc.get("aufbau", ""),
            "ueben": doc.get("ueben", []) or [],
            "wetteifern": doc.get("wetteifern"),
        }
        out: dict = {}
        for key, value in doc.items():
            if key == "aufbau":
                out["methodischer_fahrplan"] = block  # an Stelle von aufbau
            elif key in ("ueben", "wetteifern"):
                continue  # in den Block gewandert
            else:
                out[key] = value
        if "methodischer_fahrplan" not in out:
            out["methodischer_fahrplan"] = block
        return out

    # auffangen/ausklang: nur leere Reste entfernen
    if not hat_flache_felder:
        return None
    out = {k: v for k, v in doc.items() if k not in ("ueben", "wetteifern")}
    return out


def main() -> None:
    migriert = 0
    for f in sorted(UEB.glob("*.yaml")):
        doc = yaml.safe_load(f.read_text(encoding="utf-8"))
        neu = migrate_doc(doc)
        if neu is None:
            continue
        f.write_text(
            yaml.safe_dump(neu, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
        migriert += 1
    print(f"{migriert} Dateien migriert.")


if __name__ == "__main__":
    main()
