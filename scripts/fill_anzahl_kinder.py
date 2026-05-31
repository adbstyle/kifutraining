"""Fill anzahl_kinder from spielform for all exercises in data/uebungen/*.yaml.

For spielform of form 'N:M', sets:
  anzahl_kinder: {min: N+M, empfohlen: N+M}

Leaves anzahl_kinder: null for null or non-N:M spielform.
Preserves field order and unicode.
"""
import re
import sys
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parent.parent
NM_PATTERN = re.compile(r'^(\d+):(\d+)$')


def fill_file(path: Path) -> bool:
    """Return True if the file was modified."""
    text = path.read_text(encoding="utf-8")
    doc = yaml.safe_load(text)

    spielform = doc.get("spielform")
    if spielform is None:
        return False

    m = NM_PATTERN.match(str(spielform))
    if not m:
        return False

    n, mo = int(m.group(1)), int(m.group(2))
    total = n + mo

    # Only update if currently null or wrong
    current = doc.get("anzahl_kinder")
    desired = {"min": total, "empfohlen": total}
    if current == desired:
        return False  # already correct

    # Rewrite the YAML with updated anzahl_kinder
    # We do a targeted string replacement to preserve formatting
    # Replace "anzahl_kinder: null" with the new block
    new_value = f"anzahl_kinder:\n  min: {total}\n  empfohlen: {total}"
    if "anzahl_kinder: null" in text:
        new_text = text.replace("anzahl_kinder: null", new_value, 1)
    elif "anzahl_kinder:" in text:
        # Handle case where anzahl_kinder is already a block — replace block
        lines = text.splitlines(keepends=True)
        out = []
        i = 0
        while i < len(lines):
            line = lines[i]
            if line.rstrip() == "anzahl_kinder:" or line.startswith("anzahl_kinder:"):
                # Replace current block
                # Skip old block lines (indented or inline)
                out.append(new_value + "\n")
                i += 1
                # Skip sub-keys of old block
                while i < len(lines) and lines[i].startswith("  ") and ":" in lines[i]:
                    # Check it's a sub-key (2-space indent) of anzahl_kinder
                    stripped = lines[i].strip()
                    if stripped.startswith("min:") or stripped.startswith("empfohlen:"):
                        i += 1
                    else:
                        break
            else:
                out.append(line)
                i += 1
        new_text = "".join(out)
    else:
        print(f"WARNING: could not find anzahl_kinder in {path.name}", file=sys.stderr)
        return False

    path.write_text(new_text, encoding="utf-8")
    return True


def main():
    uebungen_dir = ROOT / "data" / "uebungen"
    files = sorted(uebungen_dir.glob("*.yaml"))
    filled = 0
    for f in files:
        if fill_file(f):
            filled += 1
            print(f"  filled: {f.name}")
    print(f"\n{filled} exercises got anzahl_kinder filled.")


if __name__ == "__main__":
    main()
