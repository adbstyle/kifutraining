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
eine freie Neuinterpretation. Der Web-Screenshot der Übungsseite genügt dafür
nicht — gemessen wird auf der Vorlage:

1. **Auf dem Originalbitmap messen, nicht auf einem PDF-Render.** Die Vorlage ist
   `images/<slug>.png` (304 × 228 px). Genau diese Bitmap steckt auch im PDF —
   ein `pdftoppm -r 600` liefert deshalb **keine** zusätzlichen Details, sondern
   interpolierte, geglättete Pixel, auf denen Pfeilrichtungen falsch abgelesen
   werden. Zum Anschauen mit **Nearest Neighbour** vergrössern (PIL:
   `im.resize((w*6, h*6), Image.NEAREST)`), für Details 12- bis 16-fach.
2. **Messen statt schätzen.** Was sich automatisch bestimmen lässt, wird
   automatisch bestimmt:
   - *Feldlinien:* Helligkeitsscan über Zeilen/Spalten (die Linie ist die Zeile
     mit den meisten hellen Pixeln).
   - *Figurenmitten:* Begrenzungsrahmen der Nicht-Rasen-Pixel im Fenster um die
     Figur; als Anker die **Füsse** nehmen (Köpfe sind oft angeschnitten),
     Element-`y` = Fuss-`y` − 72.
   - *Marker, Pylonen, Reifen, Zonen:* Farb-Clustering (erst eine Farbprobe am
     Objekt nehmen, dann mit dieser Referenz clustern).
   - *Pfeilrichtung:* Pixelkarte des Linienendes. Eine Pfeilspitze ist eine
     2–3 px breite Verdickung über ~5 Zeilen — **an welchem Ende sie sitzt,
     bestimmt die Richtung** und ist im vergrösserten Bild oft nicht sicher
     erkennbar.
3. **Inventar auszählen, bevor gezeichnet wird.** Jede Figur (auch wartende
   Kinder in den Kolonnen), jeder Ball, jede Markierung, jedes Tor. Die Vorlage
   zeigt regelmässig mehr Figuren als `anzahl_kinder` — abgebildet wird, was
   gezeichnet ist. Wartende Kolonnen schauen meist ins Feld: dafür die Posen
   `stehen-hinten` / `laufen-hinten` verwenden.
   - *Leibchen* (Symbol `leibchen`, färbbar, drehbar) sind in den Vorlagen
     farbige Tupfer in den Händen — z. B. „Spiel mit dem Feuer", „Trikottausch".
     Die Vorlage streckt die Arme oft waagrecht aus, unsere Posen führen sie am
     Körper: das Tuch darum **an die Hand der Pose** setzen, nicht auf die
     gemessene Bildposition — sonst schwebt es neben der Figur. Hand-Offsets
     anker-relativ (aus `figur.tsx`, mal `SCALE` 0.55), Tuch **22 Einheiten
     weiter nach aussen** auf gleicher Höhe:

     | Pose | hintere Hand | vordere Hand |
     |---|---|---|
     | `stehen` | −22 / +7 | +22 / +7 |
     | `stehen-hinten` | −18 / +7 | +18 / +7 |
     | `dribbeln` | −9 / −3 | +18 / −4 |

     `spiegeln` kehrt die x-Offsets um (die Figur skaliert mit
     `scale(−0.55, 0.55)` um den Anker), die y-Offsets bleiben.
   - *Mini-Hürden* zeichnet das Manual als Zickzack bzw. flachen Bügel mit zwei
     Füssen — das ist eine **Hürde** (`huerde`, drehbar), keine Linie. Ein Balken
     mit Verdickungen an den Enden ist eine flach liegende Hürde.
   - *Stangen* (`stange`, färbbar, drehbar) stehen meist aufrecht (0°), liegen
     aber auch flach am Boden — dann drehen (90° waagrecht, 45°/315° diagonal).
     Balken im Feld sind Stangen, keine Linien; `linie` bleibt den echten
     Feldmarkierungen vorbehalten (Mittellinie, Zonen, Dribbeltore).
   - *Figuren, die im Original Schulter an Schulter stehen* (Verfolger-Paare,
     Kolonnen): nicht die gemessene Distanz übertragen. Unsere Figuren sind
     breiter als die schlanken Manual-Kinder — die Anker auf etwa **0.75
     Figurenbreite (56 Einheiten)** setzen, sonst klafft eine Lücke, wo sich die
     Kinder in der Vorlage fast an den Händen halten.
4. **Transform bestimmen.** Feld-Eckpunkte in Bildpixeln ablesen und linear auf
   die Zeichenfläche 1600 × 1000 abbilden (**uniforme** Skalierung, damit das
   Seitenverhältnis des Felds erhalten bleibt; Rand für Tore und Warteschlangen
   ausserhalb der Linien lassen). Alle weiteren Koordinaten über dieselbe Formel
   umrechnen, nicht schätzen.
5. **Tore mit dem Anker auf die Linie setzen** — unabhängig davon, wo die
   Vorlage die Torgrafik zeichnet (dort liegt sie meist ausserhalb des
   Feldrechtecks). Die Torlinie ist die Feldlinie; sonst enden Torschuss-Pfeile
   vor dem Tormund.
6. **Notation 1:1 übernehmen** (Manual-Zeichenerklärung, Abb. 24):
   Welle + Pfeil = `dribbling`, durchgezogen + Pfeil = `pass` (auch Torschuss),
   gestrichelt + Pfeil = `laufweg`, farbige Linie = `linie` (z. B. Feldbegrenzung).
   Mehrstufige Aktionen bleiben mehrstufig: Dribbling-Welle und anschliessender
   Torschuss sind **zwei** Elemente, kein durchgehender Pfeil. Stützpunkte grob
   setzen — die Wellenform erzeugt `DiagrammView` selbst.
7. **Verifizieren.** `npm run seed`, Übungsseite öffnen und Ausschnitte gegen die
   Vorlage prüfen (Anzahl Figuren, Blickrichtungen, Ballpositionen, Pfeilziele).
   Verdachtsfälle im Zoom klären, nicht auf dem verkleinerten Gesamtbild.

## Wirkung

Der Seed (`web/scripts/seed.ts`) liest diese Dateien beim Einspielen. Eine
gültige, nicht-leere Datei setzt `diagramm` und `bild_quelle = 'diagramm'` auf
der Manual-Übung; das Diagramm wird über `parseDiagramm` validiert. Wird eine
Datei entfernt, setzt der nächste Seed-Lauf beide Felder wieder zurück
(idempotent). Manual-Übungen bleiben für Trainer schreibgeschützt — diese
Diagramme entstehen ausschliesslich hier.
