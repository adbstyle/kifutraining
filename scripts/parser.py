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

_SECTION_KEYS = {"Offen": "aufbau", "Üben": "ueben", "Wett-": "wetteifern"}
_SPIELFORM = re.compile(r"\b(\d+\s*:\s*\d+)\b")

def _content_column(line):
    """Spaltenindex, an dem nach Label-Wort + Leerraum der Inhalt beginnt."""
    m = re.match(r"\s*\S+\s{2,}", line)
    return m.end() if m else 0

def parse_exercise_block(block):
    lines = block.splitlines()
    title, cats = split_title_and_categories(lines[0])
    body = lines[1:]

    # Inhaltsspalte aus der ersten Label-Zeile bestimmen.
    content_col = 0
    for ln in body:
        first = ln.strip().split(" ")[0] if ln.strip() else ""
        if first in _SECTION_KEYS:
            content_col = _content_column(ln)
            break

    if content_col == 0:
        for ln in body:
            if ln.strip():
                content_col = len(ln) - len(ln.lstrip())
                break

    sections = {"aufbau": [], "ueben": [], "wetteifern": []}
    current = "aufbau"
    for ln in body:
        first = ln.strip().split(" ")[0] if ln.strip() else ""
        if first in _SECTION_KEYS:
            current = _SECTION_KEYS[first]
        if not ln.strip():
            continue
        content = ln[content_col:] if len(ln) > content_col else ""
        if content.strip():
            sections[current].append(content)

    aufbau = join_text(sections["aufbau"])
    spielform_m = _SPIELFORM.search(aufbau)
    return {
        "name": title,
        "kategorien": cats,
        "aufbau": aufbau,
        "ueben": split_bullets(sections["ueben"]),
        "wetteifern": join_text(sections["wetteifern"]) or None,
        "spielform": spielform_m.group(1).replace(" ", "") if spielform_m else None,
    }

def split_page_into_exercises(page_text):
    """Seitentext an Titelzeilen (mit Kategorie-Badges) in Übungsblöcke teilen."""
    lines = page_text.splitlines()
    blocks, current = [], []
    for ln in lines:
        if is_exercise_title(ln):
            if current:
                blocks.append("\n".join(current))
            current = [ln]
        elif current:
            current.append(ln)
    if current:
        blocks.append("\n".join(current))
    return blocks

_THEME_KEYS = {
    "Ziele": "ziele",
    "Metaphern": "metaphern",
    "Fragen an die Kinder": "fragen_an_die_kinder",
}

def _label_content_col(line, label):
    """Spaltenindex, an dem nach 'label' + Leerraum der Inhalt beginnt."""
    lead = len(line) - len(line.lstrip())
    after = lead + len(label)
    rest = line[after:]
    return after + (len(rest) - len(rest.lstrip()))

def parse_theme_header(text):
    lines = text.splitlines()
    key_idx = next((i for i, ln in enumerate(lines)
                    if any(ln.strip().startswith(k) for k in _THEME_KEYS)), None)
    if key_idx is None:
        return None

    # Themenname = letzte nicht-leere Zeile vor dem ersten Theme-Key
    # (überspringt Seiten-/Kapitel-Header oben auf der Seite).
    name = ""
    for ln in reversed(lines[:key_idx]):
        if ln.strip():
            name = ln.strip()
            break

    first_key = next(k for k in _THEME_KEYS if lines[key_idx].strip().startswith(k))
    content_col = _label_content_col(lines[key_idx], first_key)

    sections = {v: [] for v in _THEME_KEYS.values()}
    current = None
    for ln in lines[key_idx:]:
        stripped = ln.strip()
        matched = next((k for k in _THEME_KEYS if stripped.startswith(k)), None)
        if matched:
            current = _THEME_KEYS[matched]
        if current and len(ln) > content_col:
            tail = ln[content_col:]
            if tail.strip():
                sections[current].append(tail)

    return {
        "name": name,
        "id": slugify(name),
        "ziele": split_bullets(sections["ziele"]),
        "metaphern": split_bullets(sections["metaphern"]),
        "fragen_an_die_kinder": split_bullets(sections["fragen_an_die_kinder"]),
    }
