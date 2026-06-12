# Decision Record: Diagramm-Editor — Persistenz- und Render-Ansatz (Spike #48)

**Datum:** 2026-06-12
**Epic:** #47 — Übungs-Diagramme
**Status:** Entschieden

## Kontext

Trainer zeichnen für eigene Übungen Spielfeld-Diagramme im Browser (Epic #47).
Drei Anforderungen stehen quer zur bisherigen Bild-Architektur (statische
Storage-URL in `bild_url`):

1. Diagramme sind **element-genau nachbearbeitbar** (#54) → strukturierte Persistenz.
2. Zentrale Symbol-Updates wirken **sofort und automatisch** in allen bestehenden
   Diagrammen, auch im Anzeige- und Druckbild (#55) → kein eingefrorenes Standbild.
3. **Keine serverseitige Bildverarbeitung** (CLAUDE.md) → kein Server-Rendering
   in ein Rasterformat.

## Gate 1 — Speicherformat

**Entscheid:** Neue nullable Spalte `exercises.diagramm jsonb` mit der
element-genauen Diagramm-Struktur. `bild_url` bleibt ausschliesslich der
Foto-Pfad; das Diagramm berührt den Storage nicht.

```jsonc
{
  "version": 1,
  "elemente": [
    // Symbol-Element: Geometrie kommt aus dem Symbol-Register, nicht aus den Daten
    { "id": "…", "typ": "pylone", "x": 420, "y": 310, "farbe": "rot", "rotation": 0 },
    // Pfad-Element (Linien/Bewegungen): Punkte in Flächen-Koordinaten
    { "id": "…", "typ": "laufweg", "punkte": [{ "x": 100, "y": 200 }, …] },
    // Zone / Textbox: eigene Felder (form, text, breite/hoehe)
  ]
}
```

- Koordinatensystem: logische Zeichenfläche **1600 × 1000** (16:10, wie die
  SFV-Diagramme und die `ExerciseCard`-Container). Anzeige skaliert via
  SVG-viewBox verlustfrei auf jede Containergrösse (Detail 16:9 mit
  `meet`-Letterboxing, analog `object-contain` heute).
- Aktives Anzeige-Bild (#56): neue Spalte `bild_quelle text` (`'foto' | 'diagramm'`,
  nullable). Effektiv aktiv = `bild_quelle`, sonst `diagramm` falls vorhanden,
  sonst Foto/Platzhalter. Beim ersten Speichern eines Diagramms wird
  `bild_quelle = 'diagramm'` gesetzt (Diagramm bevorzugt, #56 AK3).
- Zugriffskontrolle: die bestehenden RLS-Policies (`ex_update`: nur eigene
  User-Übungen) decken die neuen Spalten ab — kein neuer RPC nötig.
  DB-Invariante: Manual-Übungen tragen kein Diagramm (`CHECK`).

**Verworfen:** eigene Tabelle (1:1-Overkill, Joins ohne Nutzen), Storage-JSON
(kein RLS-Filter auf Feldebene, zweiter Konsistenzpfad), Raster-Export in
`bild_url` (bricht #55: Standbild reagiert nicht auf Symbol-Updates).

## Gate 2 — Render für Anzeige und Druck

**Entscheid:** Das Diagramm wird überall **als SVG aus der Struktur gerendert**
— eine gemeinsame React-Komponente (`DiagrammView`), als Server Component
nutzbar (reines Markup, keine Bildverarbeitung). Alle Anzeigestellen
(Übungsliste/Karte, Detail, Trainings-Thumb, Durchführung, Druck) zeigen bei
aktivem Diagramm `DiagrammView` statt `next/image`.

- Druck: Vektoren → verlustfrei lesbar auf A4 (NFR), kein Qualitätsverlust.
- Mobil: responsives SVG, klar erkennbar (NFR).
- Symbol-Update (#55): neue Symbol-Version rendert beim nächsten Request —
  sofort und automatisch, ohne Migration der gespeicherten Diagramme.
- Es wird **kein Rasterbild erzeugt oder gespeichert** — weder client- noch
  serverseitig.

**Verworfen:** Client-seitiger Canvas/PNG-Export in den Storage (Standbild,
bricht #55; zusätzlicher Upload-Pfad), Server-Rasterung (verboten).

## Gate 3 — Symbol-Register & Versionierung

**Entscheid:** Zentrales Register im Code: `web/components/diagramm/symbols.tsx`.
Pro Element-Typ eine SVG-Symbol-Definition mit fixer Eigen-viewBox und
**Anker = Symbol-Mittelpunkt** auf `(x, y)`; Rotation dreht um den Anker.

- Elemente speichern nur `typ/x/y/rotation/farbe` — Form und Ausdehnung kommen
  zur Renderzeit aus dem Register. Ein Symbol-Tausch kann Position, Grösse und
  Orientierung bestehender Elemente nicht verschieben (#55 AK4), solange die
  Anker-Konvention gilt; sie ist im Register als Vertrag dokumentiert.
- Bereitstellung neuer Versionen: Code-Änderung → Review → Deploy über `main`
  (bestehender Deploy-Weg). Rollback = Git-Revert + Deploy.
- Fallback (#55 AK5): unbekannter/fehlerhafter `typ` rendert einen neutralen
  Platzhalter am gespeicherten Ort; das Diagramm bleibt intakt und editierbar,
  Daten werden nie angefasst.
- Das Diagramm-Vokabular lebt bewusst NICHT in `data/vokabular.yaml`: es ist
  App-Darstellungswissen (Symbole/Geometrie), kein Übungs-Fachattribut.

## Gate 4 — Performance (~50 Elemente)

**Entscheid:** SVG mit Pointer-Events, Drag als direkter Transform-Update auf
dem bewegten Element (kein Re-Layout der Fläche). Nachweis erfolgt im Walking
Skeleton (#49) per E2E: 50 platzierte Elemente, Platzieren/Verschieben ohne
spürbare Verzögerung. SVG mit 50 Knoten liegt um Grössenordnungen unter
Browser-Limits; Canvas/WebGL wäre Overkill und verlöre die
Server-Renderbarkeit aus Gate 2.

## Konsequenzen

- Editor (`DiagrammEditor`, Client Component) und Anzeige (`DiagrammView`,
  Server-renderbar) teilen sich Symbol-Register und Typen.
- Autosave als Server Action (`saveDiagramm`), debounced; RLS sichert Owner.
- Editor-Einstieg: eigene Route `/uebung/[slug]/diagramm` (vom Bearbeiten aus),
  damit Autosave unabhängig vom Formular-Submit läuft.
- `bild_url`-Konsumenten wechseln auf eine gemeinsame Weiche
  „aktives Bild" (Foto-`next/image` | `DiagrammView` | Platzhalter).
