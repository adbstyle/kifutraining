# Decision Record: Diagramm-Wiederverwendung — Datenmodell-Ansatz (Spike #59)

**Datum:** 2026-06-13
**Epic:** #58 — Diagramme wiederverwenden
**Status:** Entschieden

## Kontext

Trainer sollen beim Anlegen eines Diagramms ein bestehendes Diagramm als
Ausgangspunkt übernehmen (eigenes oder ein KiFu-Manual-Diagramm). Dazu stehen
drei Anforderungen quer zum heutigen Stand (Epic #47):

1. KiFu-Manual-Übungen sollen ein gezeichnetes Diagramm tragen und als aktives
   Anzeige-Bild zeigen — heute verbietet das der CHECK `manual_ohne_diagramm`.
2. Eine übernommene Vorlage muss eine unabhängige Kopie sein (keine geteilte
   Referenz) — die Quelle darf sich nie mitändern.
3. KiFu-Manual-Übungen bleiben für Trainer schreibgeschützt.

## Gate 1 — Wie tragen KiFu-Manual-Übungen ein Diagramm?

**Entscheid:** Den CHECK `manual_ohne_diagramm` **ersatzlos entfernen**. Damit
darf jede Übungszeile — auch `source = 'manual'` — optional `diagramm` und
`bild_quelle` führen. Keine eigene Tabelle, kein neuer `source`-Wert (konsistent
zum Spike #48, der eine eigene Diagramm-Entität als 1:1-Overkill verwarf).

Der Constraint stammt aus Epic #47 Out-of-Scope 1 („Manual-Übungen behalten ihr
statisches Bild"). Epic #58 hebt genau diesen Punkt für eine kleine Auswahl
auf — der Constraint hat keinen Zweck mehr.

**Verworfen:** Separater `source`-Wert (`'kifu'`) — berührt zahllose Constraints,
Queries und RLS-Policies ohne Mehrwert. Eigene Diagramm-Tabelle — bricht das
„Diagramm liegt auf der Übung"-Modell und alle bestehenden Anzeigestellen.

## Gate 2 — Read-only der KiFu-Manual-Übungen bleibt erhalten

**Entscheid:** Keine Änderung an den RLS-Policies. `ex_update`/`ex_delete`
verlangen weiterhin `source = 'user'` — Trainer können Manual-Übungen (und damit
deren Diagramm) nicht schreiben. Das KiFu-Manual-Diagramm entsteht ausschliesslich
über den Seed (Service-Role, umgeht RLS). Der Editor-Guard
(`/uebung/[slug]/diagramm`) sperrt Manual-Übungen ohnehin auf Routen-Ebene.

## Gate 3 — Aktives Anzeige-Bild der KiFu-Manual-Übung

**Entscheid:** Der Seed setzt `bild_quelle = 'diagramm'` und lässt `bild_url`
(das statische Original-Foto) stehen. Die bestehende Weiche `aktivesBild()`
zeigt damit das Diagramm aktiv, das Foto bleibt als Umschalt-Option erhalten —
ohne neue Logik (#56 wird wiederverwendet).

## Gate 4 — Übernahme als unabhängige Kopie

**Entscheid:** Eine Server-Action liest das `diagramm`-JSON der Quelle und
schreibt eine **tiefe Kopie mit neu erzeugten Element-IDs** in die Zielübung
(eigene User-Übung, RLS-geschützt). Es gibt keinen Fremdschlüssel zur Quelle —
spätere Änderungen an Quelle oder Kopie sind entkoppelt. Beim Schreiben wird
`bild_quelle` wie beim normalen Speichern mitgeführt (Diagramm wird aktiv, ein
vorhandenes Foto der Zielübung bleibt erhalten). Ein vorhandenes Diagramm der
Zielübung wird nur nach ausdrücklicher Bestätigung ersetzt; kein Rückgängig.

- Vorlagen-Quelle: `source = 'manual' OR owner_id = auth.uid()`, mit
  vorhandenem Diagramm. Fremde öffentliche Trainer-Diagramme erscheinen nicht
  (Epic #58 Out-of-Scope 1). RLS deckt die Lesbarkeit bereits ab.
- Nebenläufigkeit: Die Kopie ist ein Snapshot zum Zeitpunkt der Übernahme;
  ist die Quelle dann nicht mehr lesbar/vorhanden, schlägt die Übernahme sauber
  fehl, ohne die Zielübung zu verändern.

## Konsequenzen

- Migration `20260613100000_diagramm_wiederverwendung.sql`: `drop constraint
  manual_ohne_diagramm`. Pre-launch, daher unkritisch (Loosening, kein Backfill).
- Seed (#60) kann `diagramm`/`bild_quelle` für ausgewählte Manual-Übungen
  schreiben — daten-getrieben, idempotent.
- Übernahme-Action (#61) und Vorlagen-Query (#61/#62) bauen auf den bestehenden
  Mustern (`saveDiagramm`, `getExercises` mit `likePattern`) auf.
- Anzeige, Druck, Editor-Guard, `parseDiagramm` bleiben unverändert.
