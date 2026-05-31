import re

_UMLAUT = {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
           "Ä": "ae", "Ö": "oe", "Ü": "ue"}

def slugify(text):
    text = text.strip().lower()
    for k, v in _UMLAUT.items():
        text = text.replace(k.lower(), v)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")

# Kategorie-Badges am Zeilenende: G / F / E, je durch Leerraum getrennt.
_CATEGORY_TAIL = re.compile(r"\s{2,}((?:[GFE]\s+)*[GFE])\s*$")

def split_title_and_categories(line):
    line = line.rstrip()
    m = _CATEGORY_TAIL.search(line)
    if not m:
        return line.strip(), []
    cats = re.findall(r"[GFE]", m.group(1))
    title = line[: m.start()].strip()
    return title, cats

def is_exercise_title(line):
    title, cats = split_title_and_categories(line)
    return bool(cats) and bool(title)

def join_text(lines):
    """Mehrere Zeilen Fliesstext zu einem Absatz; Trennstrich-Umbrüche auflösen."""
    out = ""
    for raw in lines:
        seg = raw.strip()
        if not seg:
            continue
        if out.endswith("-") and not out.endswith("- -"):
            out = out[:-1] + seg          # Silbentrennung: ohne Leerzeichen kleben
        elif out:
            out += " " + seg
        else:
            out = seg
    return out

def split_bullets(lines):
    """Zeilen mit führendem '–' zu einzelnen Listeneinträgen; Folgezeilen anhängen."""
    bullets = []
    for raw in lines:
        seg = raw.strip()
        if not seg:
            continue
        if seg.startswith("–") or seg.startswith("-"):
            bullets.append(seg.lstrip("–-").strip())
        elif bullets:
            tail = bullets[-1]
            if tail.endswith("-"):
                bullets[-1] = tail[:-1] + seg
            else:
                bullets[-1] = tail + " " + seg
    return bullets
