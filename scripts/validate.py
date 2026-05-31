"""Validiert alle data/uebungen/*.yaml gegen schema/uebung.schema.json."""
import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent


def main():
    schema = json.loads((ROOT / "schema" / "uebung.schema.json").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    errors = 0
    files = sorted((ROOT / "data" / "uebungen").glob("*.yaml"))
    for f in files:
        doc = yaml.safe_load(f.read_text(encoding="utf-8"))
        for err in validator.iter_errors(doc):
            errors += 1
            print(f"{f.name}: {err.message} (Pfad: {list(err.path)})")
    print(f"\n{len(files)} Dateien geprüft, {errors} Fehler.")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
