import re

_UMLAUT = {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
           "Ä": "ae", "Ö": "oe", "Ü": "ue"}

def slugify(text):
    text = text.strip().lower()
    for k, v in _UMLAUT.items():
        text = text.replace(k.lower(), v)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")
