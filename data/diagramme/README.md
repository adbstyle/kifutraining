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

## Vorgehen: Manual-Diagramm adaptieren

Ziel ist die **originalgetreue** Übertragung in unsere Diagrammsprache, nicht
eine freie Neuinterpretation. Aus dem Web-Screenshot der Übungsseite lässt sich
das nicht ablesen — immer die PDF-Vorlage auswerten:

1. **Vorlage in Auflösung holen.** Seite aus `sources/Manual_Kinderfussball_D.pdf`
   rendern (Seitenzahl steht in `quelle.seite` der Übungs-YAML):
   `pdftoppm -f <seite> -l <seite> -r 600 -x <x> -y <y> -W <b> -H <h> -png <pdf> <out>`.
   Für Laufwege zusätzlich Detailausschnitte mit `-r 1200` — Wellen, Pfeilspitzen
   und Figurenpaare sind sonst nicht unterscheidbar.
2. **Inventar auszählen, bevor gezeichnet wird.** Jede Figur (auch wartende
   Kinder in den Kolonnen), jeder Ball, jede Markierung, jedes Tor. Die Vorlage
   zeigt regelmässig mehr Figuren als `anzahl_kinder` — abgebildet wird, was
   gezeichnet ist.
3. **Transform bestimmen.** Feld-Eckpunkte in Bildpixeln ablesen und linear auf
   die Zeichenfläche 1600 × 1000 abbilden (Seitenverhältnis des Felds erhalten,
   Rand für Tore und Warteschlangen ausserhalb der Linien lassen). Alle weiteren
   Koordinaten über dieselbe Formel umrechnen, nicht schätzen.
4. **Notation 1:1 übernehmen** (Manual-Zeichenerklärung, Abb. 24):
   Welle + Pfeil = `dribbling`, durchgezogen + Pfeil = `pass` (auch Torschuss),
   gestrichelt + Pfeil = `laufweg`, farbige Linie = `linie` (z. B. Feldbegrenzung).
   Mehrstufige Aktionen bleiben mehrstufig: Dribbling-Welle und anschliessender
   Torschuss sind **zwei** Elemente, kein durchgehender Pfeil. Stützpunkte grob
   setzen — die Wellenform erzeugt `DiagrammView` selbst.
5. **Verifizieren.** `npm run seed`, Übungsseite öffnen und Ausschnitte gegen die
   Vorlage prüfen (Anzahl Figuren, Blickrichtungen, Ballpositionen, Pfeilziele).

## Wirkung

Der Seed (`web/scripts/seed.ts`) liest diese Dateien beim Einspielen. Eine
gültige, nicht-leere Datei setzt `diagramm` und `bild_quelle = 'diagramm'` auf
der Manual-Übung; das Diagramm wird über `parseDiagramm` validiert. Wird eine
Datei entfernt, setzt der nächste Seed-Lauf beide Felder wieder zurück
(idempotent). Manual-Übungen bleiben für Trainer schreibgeschützt — diese
Diagramme entstehen ausschliesslich hier.
