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
