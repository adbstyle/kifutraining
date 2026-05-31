# Design: Übungs-Datenbank Kinderfussball

**Datum:** 2026-05-31
**Quelle:** `Manual_Kinderfussball_D.pdf` (84 Seiten, SFV Kinderfussball)

## Ziel

Die Trainingsformen (Übungen) aus dem Manual Kinderfussball sauber extrahieren und
als versionierte, strukturierte Daten in Git ablegen. Die strukturierten YAML-Daten
sind die kanonische Quelle; eine menschlich lesbare Markdown-Ansicht wird daraus
generiert. So sind die Daten sowohl auf GitHub durchblätterbar als auch maschinell
für eine spätere App (Trainingsplaner, Filter) nutzbar.

**Filterbarkeit ist ein Kernziel:** Felder, nach denen die App filtern soll
(`erscheinungsform`, `feldtyp`, `kategorien`, `anzahl_kinder`, `spielform`), sind als
**kontrollierte Vokabulare/Enums** modelliert — nicht als Freitext. Die erlaubten
Werte liegen in `data/vokabular.yaml` (Slug → Anzeigetext) für Filter-Dropdowns.

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
                 → Offen starten («aufbau»), Üben, Wett-eifern,
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
│   ├── vokabular.yaml              # kontrollierte Enums (Slug → Anzeigetext)
│   ├── themen/                     # Themen-Metadaten (geteilt über Übungen)
│   │   └── dribbling.yaml
│   └── uebungen/                   # eine YAML pro Übung
│       └── dribbling-wechseltore.yaml
├── images/
│   └── dribbling-wechseltore.png   # Feld-Diagramm pro Übung
├── docs/
│   ├── README.md                   # generierter Index (nach Trainingsteil/Thema)
│   └── uebungen/dribbling-wechseltore.md   # generierte Einzelansicht
├── scripts/
│   ├── extract.py                  # PDF → YAML + PNG (wiederholbar)
│   └── build_docs.py               # YAML → Markdown-Ansicht
├── schema/
│   └── uebung.schema.json          # JSON-Schema zur Validierung
└── docs/superpowers/specs/         # dieses Spec-Dokument
```

## Schema einer Übung (`data/uebungen/*.yaml`)

```yaml
id: dribbling-wechseltore           # {thema}-{slug}; eindeutig & lesbar
name: Wechseltore
trainingsteil: hauptteil            # auffangen | einleitung | hauptteil | ausklang
erscheinungsform: [spiel-kreativ-gestalten, ball-entschlossen-erobern]   # Liste von Enum-Slugs; [] wenn keine
feldtyp: kleinfeld                  # kleinfeld | grossfeld | freies_feld | null (best-effort)
thema: dribbling                    # ref auf data/themen/dribbling.yaml
kategorien: [G, F, E]               # Alterskategorien aus den G/F/E-Badges
spielform: "3:3"                    # wo angegeben, sonst null
anzahl_kinder: { min: 6, empfohlen: 6 }   # abgeleitet (best-effort); null wenn unklar
material: [Markierkegel, Minitore, "1 Ball pro Team"]   # best-effort, sonst []
aufbau: >                           # Inhalt von «Offen starten»
  Zwei Teams spielen 3:3. Dribbelt ein Kind über die Mittellinie...
ueben:                              # Liste der «Üben»-Punkte
  - Täuschen und in den freien Raum dribbeln
wetteifern: >                       # Inhalt von «Wett-eifern»
  Welches Team erzielt innerhalb von fünf Minuten mehr Tore?
varianten:                          # inline "Variante: ..." im Text, sonst []
  - "nach einem erzielten Tor wechseln die zugeteilten Tore"
bild: images/dribbling-wechseltore.png   # null wenn kein Diagramm
quelle: { datei: Manual_Kinderfussball_D.pdf, seite: 65 }
```

### Feld-Regeln
- **Nicht ableitbare Felder bleiben leer/`null`** statt geraten zu werden, damit klar
  ist, was bei der manuellen Korrektur noch zu ergänzen ist.
- `spielform`, `anzahl_kinder`, `material`, `varianten`, `feldtyp` sind best-effort aus
  Text (und ggf. Diagramm) abgeleitet.
- **Filter-Enums (kontrolliertes Vokabular, definiert in `data/vokabular.yaml`):**
  - `erscheinungsform` (Liste): `spiel-kreativ-gestalten`, `ball-entschlossen-erobern`,
    `mutig-tore-erzielen`, `mutig-tore-verhindern`, `flink-geschickt-bewegen`,
    `respektvoll-fair-spielen`. Zuordnung über das Seiten→Erscheinungsform-Mapping.
  - `feldtyp`: `kleinfeld`, `grossfeld`, `freies_feld` oder `null`. Aus Schlüsselwörtern
    im Text abgeleitet (`Viereck` → `kleinfeld`), sonst `null` für manuelle Ergänzung.
- **Zwei Übungsformate** im Manual:
  - *Voll* (Einleitung, Hauptteil): `aufbau` (= «Offen starten»), `ueben` (Liste),
    `wetteifern`.
  - *Einfach* (Auffangen, Ausklang): nur eine Beschreibung → landet in `aufbau`;
    `ueben: []`, `wetteifern: null`.
  - `erscheinungsform` (Liste) / Themen-Metadaten (Ziele/Metaphern/Fragen) gibt es nur
    beim Hauptteil; sonst `[]` bzw. kein Themen-Eintrag.

## Vokabular (`data/vokabular.yaml`)

Kontrollierte Enum-Werte mit Anzeigetext, von der App für Filter-Dropdowns nutzbar.

```yaml
erscheinungsform:
  spiel-kreativ-gestalten: "Das Spiel kreativ gestalten"
  ball-entschlossen-erobern: "Den Ball entschlossen erobern"
  mutig-tore-erzielen: "Mutig Tore erzielen"
  mutig-tore-verhindern: "Mutig Tore verhindern"
  flink-geschickt-bewegen: "Sich flink und geschickt bewegen"
  respektvoll-fair-spielen: "Sich respektvoll verhalten und fair spielen"
feldtyp:
  kleinfeld: "Kleinfeld"
  grossfeld: "Grossfeld"
  freies_feld: "Freies Feld"
trainingsteil:
  auffangen: "Auffangen"
  einleitung: "Einleitung"
  hauptteil: "Hauptteil"
  ausklang: "Ausklang"
```

## Schema eines Themas (`data/themen/*.yaml`)

```yaml
id: dribbling
name: Dribbling
trainingsteil: hauptteil
erscheinungsform: [spiel-kreativ-gestalten, ball-entschlossen-erobern]   # Liste von Enum-Slugs
ziele:
  - "Die Kinder können den Ball beidfüssig und eng führen."
  - "Die Kinder suchen mutig das 1:1, kennen passende Finten und wenden diese an."
metaphern:
  - "Den Ball als Hund verstehen"
fragen_an_die_kinder:
  - "Wie hast du das Dribbling jeweils gemacht?"
```

## Datenfluss

1. **`extract.py`** (wiederholbar):
   - Text je Seite via `pdftotext -layout`.
   - Bilder je Seite via `pdfimages -png`.
   - Parst die wiederkehrende Block-Struktur (Thema-Header mit Ziele/Metaphern/Fragen;
     Übungs-Blöcke mit Offen starten/Üben/Wett-eifern + G/F/E-Badges).
   - Setzt `erscheinungsform` (Liste) aus dem Seiten→Erscheinungsform-Mapping und
     leitet `feldtyp` aus Schlüsselwörtern im Text ab (sonst `null`).
   - Schreibt `data/themen/*.yaml`, `data/uebungen/*.yaml` und `images/*.png`.
   - Bild↔Übung-Zuordnung über Reihenfolge pro Seite.
2. **Manuelle Korrektur**: PDF-Parsing ist nie 100 % exakt. Die generierten YAMLs
   werden gegen das PDF geprüft und korrigiert. Danach ist die YAML die **kanonische
   Quelle**; `extract.py` wird nicht erneut blind über korrigierte Daten laufen.
3. **`build_docs.py`**: generiert aus den (korrigierten) YAMLs die Markdown-Ansicht
   unter `docs/` (Index nach Trainingsteil/Thema gruppiert; Einzelseiten mit
   eingebettetem Diagramm).

## Validierung

- `schema/uebung.schema.json`: JSON-Schema, gegen das alle Übungs-YAMLs geprüft werden
  (fängt fehlende Pflichtfelder, ungültige `trainingsteil`-/`kategorien`-/`feldtyp`-/
  `erscheinungsform`-Werte, Tippfehler). Die Enum-Werte im Schema sind die Quelle der
  Wahrheit für die Filter-Vokabulare.
- Ein Test stellt sicher, dass die Slugs in `data/vokabular.yaml` exakt den Enum-Werten
  im Schema entsprechen (kein Drift zwischen Vokabular und erlaubten Werten).
- Validierung läuft als `scripts/validate.py` (separater Check).

## Technische Annahmen / Risiken

- **Tooling vorhanden**: `pdftotext`, `pdfinfo`, `pdfimages` (poppler) sind installiert.
  Python für die Skripte; `PyYAML` für YAML-Ausgabe (ggf. zu installieren).
- **Parsing-Robustheit**: Die Block-Struktur ist konsistent, aber Layout-Eigenheiten
  (zweispaltig, umbrochene Übungsnamen, Themen ohne Diagramm) können Sonderfälle
  erzeugen → durch manuelle Korrektur abgefangen.
- **Material/Anzahl Kinder**: Nicht überall explizit → bewusst best-effort, leer wo unklar.
