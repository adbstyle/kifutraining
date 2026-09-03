# KiFu-Manual-Diagramme (Vorlagen-Fundus)

Gezeichnete Spielfeld-Diagramme für ausgewählte KiFu-Manual-Übungen (Epic #58).
Sie dienen Trainern als Vorlage beim Anlegen eines eigenen Diagramms und werden
zugleich zum aktiven Anzeige-Bild der jeweiligen Manual-Übung (das statische
Original-Foto bleibt als Umschalt-Option erhalten).

## Format

Eine Datei pro Übung: `<slug>.json`, wobei `<slug>` exakt der `id` der Übung in
`data/uebungen/<slug>.yaml` entspricht. Inhalt ist eine `DiagrammData`-Struktur
(siehe `web/lib/diagramm.ts`):

```json
{
  "version": 1,
  "elemente": [
    { "id": "a1", "art": "symbol", "typ": "tor", "x": 800, "y": 80, "rotation": 0 },
    { "id": "a2", "art": "symbol", "typ": "spieler", "x": 600, "y": 500, "farbe": "blau" },
    { "id": "a3", "art": "pfad", "typ": "laufweg", "punkte": [{ "x": 600, "y": 500 }, { "x": 800, "y": 200 }] }
  ]
}
```

Koordinatensystem: logische Zeichenfläche 1600 × 1000 (16:10). Element-Typen,
Farben und Geometrie siehe `web/lib/diagramm.ts` und `web/components/diagramm/symbols.tsx`.

## Bestand

Der Fundus ist vollständig: für jede der 75 Manual-Übungen liegt ein Diagramm
vor (`data/uebungen/<slug>.yaml` ↔ `data/diagramme/<slug>.json`, gleiche Slugs).
`npm run check:diagramme` prüft den Bestand strukturell.

Die Diagramme sind in unserer eigenen Diagrammsprache gezeichnet — Symbole,
Farben und Geometrie stammen aus `web/lib/diagramm.ts` und
`web/components/diagramm/symbols.tsx`. Die Bitmaps aus dem Manual-PDF, die
früher unter `images/` lagen, sind aus dem Repo entfernt; sie waren
unveränderte Abbildungen aus einem fremden Werk. Ein Diagramm wird darum nicht
mehr gegen eine Vorlage nachgemessen, sondern anhand des Übungstexts geprüft
und im Editor korrigiert.

## Wirkung

Der Seed (`web/scripts/seed.ts`) liest diese Dateien beim Einspielen. Eine
gültige, nicht-leere Datei setzt `diagramm` und `bild_quelle = 'diagramm'` auf
der Manual-Übung; das Diagramm wird über `parseDiagramm` validiert. Wird eine
Datei entfernt, setzt der nächste Seed-Lauf beide Felder wieder zurück
(idempotent). Manual-Übungen bleiben für Trainer schreibgeschützt — diese
Diagramme entstehen ausschliesslich hier.
