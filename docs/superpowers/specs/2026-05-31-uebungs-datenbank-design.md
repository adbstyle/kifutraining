# Design: Übungs-Datenbank Kinderfussball

**Datum:** 2026-05-31
**Quelle:** `Manual_Kinderfussball_D.pdf` (84 Seiten, SFV Kinderfussball)

## Ziel

Die Trainingsformen (Übungen) aus dem Manual Kinderfussball sauber extrahieren und
als versionierte, strukturierte Daten in Git ablegen. Die strukturierten YAML-Daten
sind die kanonische Quelle; eine menschlich lesbare Markdown-Ansicht wird daraus
generiert. So sind die Daten sowohl auf GitHub durchblätterbar als auch maschinell
für eine spätere App (Trainingsplaner, Filter) nutzbar.

## Umfang

- **Alle Trainingsformen** des Manuals (Seiten 60–82):
  - Trainingsformen zum Auffangen
  - Trainingsformen zur Einleitung
  - Trainingsformen zum Hauptteil («Fussball spielen lernen», «Vielseitigkeit erleben», «Fussball spielen»)
  - Trainingsformen zum Ausklang
- **Feld-Diagramme** jeder Übung werden als PNG extrahiert.
- Nicht im Umfang: die 3 PDF-Trainingsplanungen und die PPTX-Präsentationen (bleiben in `sources/`).

## Inhaltsstruktur des Manuals (beobachtet)

```
Trainingsteil (Auffangen | Einleitung | Hauptteil | Ausklang)
  └─ Erscheinungsform (z. B. «Das Spiel kreativ gestalten / Den Ball entschlossen erobern»)
       └─ Thema (z. B. Dribbling)  → Ziele, Metaphern, Fragen an die Kinder
            └─ Trainingsform/Übung (z. B. Wechseltore)
                 → Offen starten («setup»), Üben, Wett-eifern,
                   Alterskategorien G/F/E, Feld-Diagramm
```

Beobachtung zur Bild-Zuordnung: Die eingebetteten Diagramme sind raster-JPEGs
(304×228 px). Ihre **Anzahl pro Seite entspricht der Anzahl Übungen pro Seite**
(z. B. S. 65: 3 Bilder = 3 Übungen). Zuordnung Bild→Übung erfolgt über die
Reihenfolge (oben→unten) pro Seite.

## Repo-Struktur

```
kifu/
├── sources/                        # Original-PDFs/PPTX (hierher verschoben)
│   ├── Manual_Kinderfussball_D.pdf
│   └── ... (übrige PDFs/PPTX)
├── data/
│   ├── topics/                     # Themen-Metadaten (geteilt über Übungen)
│   │   └── dribbling.yaml
│   └── exercises/                  # eine YAML pro Übung
│       └── dribbling-wechseltore.yaml
├── images/
│   └── dribbling-wechseltore.png   # Feld-Diagramm pro Übung
├── docs/
│   ├── README.md                   # generierter Index (nach Trainingsteil/Thema)
│   └── exercises/dribbling-wechseltore.md   # generierte Einzelansicht
├── scripts/
│   ├── extract.py                  # PDF → YAML + PNG (wiederholbar)
│   └── build_docs.py               # YAML → Markdown-Ansicht
├── schema/
│   └── exercise.schema.json        # JSON-Schema zur Validierung
└── docs/superpowers/specs/         # dieses Spec-Dokument
```

## Schema einer Übung (`data/exercises/*.yaml`)

Englische Keys (App-Tauglichkeit), deutsche Inhalte. Ausnahme: die vier
`training_part`-Werte bleiben deutsche SFV-Fachbegriffe.

```yaml
id: dribbling-wechseltore           # {topic}-{slug}; eindeutig & lesbar
name: Wechseltore
training_part: hauptteil            # auffangen | einleitung | hauptteil | ausklang (SFV-Begriffe)
focus: "Das Spiel kreativ gestalten / Den Ball entschlossen erobern"   # Erscheinungsform
topic: dribbling                    # ref auf data/topics/dribbling.yaml
categories: [G, F, E]               # Alterskategorien aus den G/F/E-Badges
play_form: "3:3"                    # Spielform, wo angegeben, sonst null
player_count: { min: 6, recommended: 6 }   # abgeleitet (best-effort); null wenn unklar
equipment: [Markierkegel, Minitore, "1 Ball pro Team"]   # Material, best-effort, sonst []
setup: >                            # Inhalt von «Offen starten»
  Zwei Teams spielen 3:3. Dribbelt ein Kind über die Mittellinie...
practice:                           # Liste der «Üben»-Punkte
  - Täuschen und in den freien Raum dribbeln
compete: >                          # Inhalt von «Wett-eifern»
  Welches Team erzielt innerhalb von fünf Minuten mehr Tore?
variants:                           # inline "Variante: ..." im Text, sonst []
  - "nach einem erzielten Tor wechseln die zugeteilten Tore"
image: images/dribbling-wechseltore.png   # null wenn kein Diagramm
source: { file: Manual_Kinderfussball_D.pdf, page: 65 }
```

### Feld-Regeln
- **Nicht ableitbare Felder bleiben leer/`null`** statt geraten zu werden, damit klar
  ist, was bei der manuellen Korrektur noch zu ergänzen ist.
- `play_form`, `player_count`, `equipment`, `variants` sind best-effort aus Text
  (und ggf. Diagramm) abgeleitet.

## Schema eines Themas (`data/topics/*.yaml`)

```yaml
id: dribbling
name: Dribbling
training_part: hauptteil
focus: "Das Spiel kreativ gestalten / Den Ball entschlossen erobern"
goals:                              # Ziele
  - "Die Kinder können den Ball beidfüssig und eng führen."
  - "Die Kinder suchen mutig das 1:1, kennen passende Finten und wenden diese an."
metaphors:                          # Metaphern
  - "Den Ball als Hund verstehen"
questions_for_kids:                 # Fragen an die Kinder
  - "Wie hast du das Dribbling jeweils gemacht?"
```

## Datenfluss

1. **`extract.py`** (wiederholbar):
   - Text je Seite via `pdftotext -layout`.
   - Bilder je Seite via `pdfimages -png`.
   - Parst die wiederkehrende Block-Struktur (Thema-Header mit Ziele/Metaphern/Fragen;
     Übungs-Blöcke mit Offen starten/Üben/Wett-eifern + G/F/E-Badges).
   - Schreibt `data/topics/*.yaml`, `data/exercises/*.yaml` und `images/*.png`.
   - Bild↔Übung-Zuordnung über Reihenfolge pro Seite.
2. **Manuelle Korrektur**: PDF-Parsing ist nie 100 % exakt. Die generierten YAMLs
   werden gegen das PDF geprüft und korrigiert. Danach ist die YAML die **kanonische
   Quelle**; `extract.py` wird nicht erneut blind über korrigierte Daten laufen.
3. **`build_docs.py`**: generiert aus den (korrigierten) YAMLs die Markdown-Ansicht
   unter `docs/` (Index nach Trainingsteil/Thema gruppiert; Einzelseiten mit
   eingebettetem Diagramm).

## Validierung

- `schema/exercise.schema.json`: JSON-Schema, gegen das alle Übungs-YAMLs geprüft werden
  (fängt fehlende Pflichtfelder, ungültige `training_part`-/`categories`-Werte, Tippfehler).
- Validierung läuft als Teil von `build_docs.py` bzw. als separater Check.

## Technische Annahmen / Risiken

- **Tooling vorhanden**: `pdftotext`, `pdfinfo`, `pdfimages` (poppler) sind installiert.
  Python für die Skripte; `PyYAML` für YAML-Ausgabe (ggf. zu installieren).
- **Parsing-Robustheit**: Die Block-Struktur ist konsistent, aber Layout-Eigenheiten
  (zweispaltig, umbrochene Übungsnamen, Themen ohne Diagramm) können Sonderfälle
  erzeugen → durch manuelle Korrektur abgefangen.
- **Material/Anzahl Kinder**: Nicht überall explizit → bewusst best-effort, leer wo unklar.
