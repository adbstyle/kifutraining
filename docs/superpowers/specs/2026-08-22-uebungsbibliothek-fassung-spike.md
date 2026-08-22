# Spike: Fassungs-Datenmodell und Überführungsansatz

**Datum:** 2026-08-22
**Story:** Story 1 (Enabler, Spike) des Epics `2026-08-16-uebungsbibliothek-epic.md` (Stories: `2026-08-16-uebungsbibliothek-stories.md`)
**Status:** Entscheide mit dem Product Owner abgestimmt; Abnahme ausstehend
**Messbasis:** Produktionsstand vom 2026-08-22 — 89 Übungen (14 von Trainern), 6 Trainings, 37 Zuordnungen (0 verwaiste), 27 Zuordnungen mit Bild, 34 mit Diagramm, 79 Bilddateien (~3,3 MB Bucket total, ~1,0 MB auf referenzierte Bilder), 7 Nutzerkonten.

Begriffsrahmen (PO 2026-08-22, siehe Stories-Dokument): «Fassung» ist ein interner Arbeitsbegriff. In der Oberfläche heisst die Fassung schlicht «Übung», Bibliothekseinträge heissen «Vorlage»; der Kopie-Charakter zeigt sich ausschliesslich über die Herkunftsangabe «basiert auf …».

---

## Gate 1 — Wo lebt die Fassung im Datenmodell?

**Entscheid:** Die Zuordnung ist die Fassung. `training_exercises` wird um die inhaltlichen Übungsfelder erweitert (Name, Erscheinungsform, Feldtyp, Alterskategorien, Anzahl Kinder, Material, methodischer Fahrplan bzw. Beschreibung, Aufbau, Varianten, Bild, Bildquelle, Diagramm) und um die Herkunftsfelder aus Gate 2. Der Fremdschlüssel `exercise_id` auf die Bibliotheks-Übung entfällt ersatzlos, ebenso `exercise_name_cache` (der Name wird reguläres Fassungs-Feld).

Begründung: Fassung und Zuordnung stehen ohnehin 1:1; `trainingsteil`, `hauptteilkategorie` und der Namens-Cache liegen heute schon als Snapshot auf der Zuordnung — das Modell verallgemeinert das bestehende Muster. Konstruktive Folgen: Fassungen können nie in Katalog, Suche oder Favoriten auftauchen (Erfolgskriterium 7 gilt by design, diese Pfade lesen nur `exercises`), die Zugriffsregeln erben vollständig vom Training (Gate 3), und der Manual-Seed kann keine Fassungen erzeugen (Gate 6).

Geprüfte und verworfene Alternativen:
1. **Fassung als markierte Zeile in `exercises`** — verworfen: Katalog, Suche, Favoriten und RLS müssten Fassungen an jeder Stelle aktiv ausblenden; jede vergessene Stelle verletzt Erfolgskriterium 7. Die Manual-Invarianten (`manual_is_public`, Schreibsperre) und die Konto-Löschung kollidieren mit trainingsgebundenen Zeilen.
2. **Eigene Fassungs-Tabelle mit 1:1-Beziehung zur Zuordnung** — verworfen: gleiche konstruktive Sauberkeit wie der Entscheid, aber eine zusätzliche Tabelle und ein zusätzlicher Join ohne Informationsgewinn gegenüber der Zuordnung selbst.

## Gate 2 — Herkunftsangabe

**Entscheid:** Eine einheitliche dreiteilige Struktur, ohne Fremdschlüssel und ohne Personenidentität (PO 2026-08-22):

| Feld | Inhalt |
|---|---|
| Herkunfts-Name | Name des Originals zum Übernahmezeitpunkt |
| Herkunfts-Typ | `manual` (KiFu-Manual), `community` (Vorlage eines anderen Trainers), `eigen` (eigene Vorlage) |
| Übernahme-Zeitpunkt | Zeitstempel der Übernahme |

Die Struktur liegt an drei Stellen: an der Fassung (`training_exercises`), an Übungen, die per «in meine Bibliothek übernehmen» entstehen (`exercises`), und an Diagramm-Kopien (Korrektur des Diagramm-Wiederverwendungs-Spikes gemäss Epic §10.4). Der Anzeigetext lautet «basiert auf …», nie «ist». Bei Kopien von Kopien und bei Trainings-Kopien werden die drei Felder unverändert weiterkopiert — die ursprüngliche Herkunft bleibt stehen. Die Unveränderlichkeit erzwingt die Datenbank: Änderungsversuche an den Herkunftsfeldern einer bestehenden Zeile werden abgewiesen; die übrigen Fassungs-Felder bleiben frei editierbar.

Geprüfte und verworfene Alternativen:
1. **Fremdschlüssel auf das Original** — verworfen durch Epic-Entscheid («kein Sprungziel, reine Angabe»); ein FK stürbe zudem mit dem Original und verletzte die Unabhängigkeit.
2. **Trainer-Identität in der Herkunft (Anzeigename jetzt einführen oder E-Mail-Lokalteil)** — verworfen (PO 2026-08-22): Die App kennt keinen Anzeigenamen, seine Einführung griffe dem Team-Epic vor; der E-Mail-Lokalteil ist datenschutz-heikel. Bei `community` bleibt die Angabe personenlos; nachrüstbar, falls später ein Anzeigename existiert.

## Gate 3 — Zugriffsregeln der Fassung

**Entscheid:** Keine neuen Policies. Die Fassung erbt Lese- und Schreibrecht vollständig vom Training über die bestehenden `te_*`-Policies (Subquery auf `trainings`): Der Eigentümer schreibt, öffentliche Trainings sind für alle lesbar. Damit entfällt die heutige Situation, dass eine Übung im öffentlichen Training für den Betrachter unsichtbar sein kann (zwei getrennte RLS-Ketten) — die Fassung hängt an genau einer Kette. Die Manual-Schreibsperre gilt für Fassungen nicht (sie liegen nicht in `exercises`); genau das macht Manual-Übungen im Training anpassbar, während der Bestand in der Bibliothek unverändert schreibgeschützt bleibt. Der Rückweg «in meine Bibliothek übernehmen» erzeugt eine gewöhnliche private Trainer-Übung (`source = 'user'`, `owner_id` = Handelnder) — das deckt die bestehende Insert-Policy bereits ab; neu ist nur das Mitschreiben der Herkunftsfelder.

Geprüfte und verworfene Alternative: eigene Rollen-/Policy-Struktur für Fassungen — verworfen, weil die Zuordnungstabelle die Vererbung vom Training bereits implementiert und kein Fall existiert, in dem Fassungs-Rechte von Trainings-Rechten abweichen.

## Gate 4 — Bildkopie (Machbarkeit experimentell bestätigt)

**Entscheid:** Byte-identische, serverseitige Kopie innerhalb des Buckets über die Storage-Copy-Operation, ausgeführt vom nutzergebundenen Server-Client — ohne RLS-Änderung, ohne Service-Role im Request-Pfad, ohne Download/Re-Upload. Zielpfad ist das Verzeichnis des Trainings-Eigentümers mit der Zuordnungs-ID als Dateiname (`user/<owner-uid>/<zuordnungs-id>.<ext>`) — kollisionsfrei zu Übungsbildern (`<exercise-id>.<ext>`). Beim Entfernen einer Zuordnung und beim Löschen eines Trainings wird die kopierte Datei mitgelöscht; das bestehende URL-zu-Pfad-Verfahren (`bildUrlToPath`) wird weiterverwendet. Das Diagramm wird als tiefe JSON-Kopie mit frischen Element-IDs auf die Fassung gelegt (bestehender Baustein `kopiereDiagramm`).

Experiment (2026-08-22, lokaler Stack, Wegwerf-Skript): Ein per Passwort angemeldeter Client kopierte erfolgreich `manual/<datei>` → eigener Pfad **und** `user/<fremde-uid>/<datei>` → eigener Pfad; beide Kopien waren byte-identisch. Der Gegenversuch (Kopie in einen fremden Pfad) wurde von der RLS korrekt abgewiesen («new row violates row-level security policy»). Die Copy-Operation prüft Leserecht auf der Quelle (der Bucket ist öffentlich lesbar) und Schreibrecht auf dem Ziel (eigener Pfad) — exakt die benötigte Semantik. Die NFR «keine Qualitätsveränderung, keine erneute serverseitige Bildverarbeitung» ist erfüllt, weil keine Bytes transformiert werden.

Geprüfte und verworfene Alternativen:
1. **Download + erneuter Upload durch den Client** — verworfen: unnötiger Transfer, Risiko erneuter Verarbeitung, langsamer (NFR «unter einer Sekunde»).
2. **Kopie per Service-Role im Request-Pfad** — verworfen: umgeht RLS unnötig; das Experiment zeigt, dass die nutzergebundene Kopie genügt. Service-Role bleibt der Bestand-Überführung (Gate 7) vorbehalten.
3. **Geteilte Datei zwischen Original und Fassung** — verworfen durch Epic-Entscheid («keine geteilten Dateien»); das Original könnte gelöscht werden und risse die Fassung mit.

## Gate 5 — Prüfungen arbeiten auf der Fassung

**Entscheid:** Alle Prüfungen, die heute live auf der referenzierten Übung arbeiten, lesen künftig die Fassungs-Felder:
1. Die Veröffentlichungs-Vollständigkeit eines Trainings (`publish_training`, Auto-Privat-Trigger) prüft die Fassungs-Spalten statt des Joins.
2. Die Alterskategorien-Abgleichswarnung liest die kopierten Alterskategorien der Fassung.
3. Der Trigger, der die Gleichheit von Übungs- und Zuordnungs-Trainingsteil erzwingt (`training_exercise_phase_guard`), entfällt: Die Einordnung der Fassung (Trainingsteil und Hauptteilkategorie) ist frei änderbar. Die Abbildungsregel liefert beim Übernehmen nur noch den Vorschlag; eine Abweichung erzeugt den Hinweis am Training (Erfolgskriterium 9), keine Sperre.
4. Die Vollständigkeitsregel je Hauptteilkategorie (Story 2) erhält Constraint-Pendants auf `training_exercises`, damit die Fassung einer Manual-Übung denselben Regeln genügt wie eine Trainer-Übung — der Grund, weshalb Story 2 diesem Modell vorausgeht.

Geprüfte und verworfene Alternative: Prüfungen weiterhin gegen die Live-Quelle — verworfen, weil die Quelle nach der Übernahme keinerlei Autorität mehr über das Training hat (Kernidee des Epics) und verschwinden darf.

## Gate 6 — Manual-Seed

**Entscheid (by design, keine Alternative nötig):** Der wiederholbare Ladevorgang schreibt ausschliesslich `exercises` und bleibt unverändert funktionsfähig; im Modell aus Gate 1 kann er konstruktiv keine Fassungen erzeugen (NFR 5 des Epics erfüllt). Einzige Anpassung: Der Seed muss die neue Beschreibungs-Spalte aus Story 2 tragen — das gehört zu Story 2, nicht zu diesem Spike.

## Gate 7 — Bestand-Überführung

**Entscheid:** Dreischrittiges, wiederanlauffähiges Verfahren, ausgeliefert im selben Release wie das neue Zuordnen (harte Umstellung, Erfolgskriterium 15):

1. **Bild-Kopierskript (Service-Role, idempotent):** liest alle Zuordnungen mit Bild und kopiert jedes Objekt nach dem deterministischen Schema aus Gate 4 (`user/<owner>/<zuordnungs-id>.<ext>`). Existiert das Zielobjekt bereits, wird übersprungen — beliebig oft wiederholbar. Gleiche Werkzeugklasse wie Seed und Storage-Sync.
2. **Feld-Migration (eine Transaktion, atomar):** kopiert die Übungsfelder jeder Zuordnung aus der referenzierten Übung in die Fassungs-Spalten, setzt die Herkunftsfelder (Typ aus `source`/Eigentümer-Vergleich, Zeitpunkt = Überführungszeitpunkt) und die Bild-URL auf das kopierte Objekt. Zuordnungen ohne auflösbare Übung übernehmen den zwischengespeicherten Namen als benannte, inhaltsleere Fassung (in Produktion aktuell 0 Fälle). Teilausfall hinterlässt keinen Mischzustand — die Transaktion greift ganz oder gar nicht.
3. **Nachweis-Abgleich (maschinell):** prüft nach der Überführung, dass jede Zuordnung ihre Pflichtfelder gemäss Kategorie trägt, jede Bild-Fassung ihr Zielobjekt besitzt und die Feldwerte mit der Quelle übereinstimmen. Erst ein grüner Abgleich schliesst die Überführung ab.

**Laufzeit- und Volumenabschätzung (gemessene Produktionszahlen vom 2026-08-22):** 37 Zuordnungen → Feld-Migration im Sekundenbereich; 27 Bildkopien, ~1,0 MB zusätzliches Storage-Volumen → Kopierskript im Sekundenbereich. Fortlaufender Mehrverbrauch: pro künftiger Zuordnung eine Bildkopie (Ø ~40 KB) plus Zeilendaten — bei heutiger Nutzung vernachlässigbar gegenüber dem Free-Tier-Kontingent.

Geprüfte und verworfene Alternativen:
1. **Alles in einer SQL-Migration** — nicht möglich: Storage-Objekte lassen sich nicht aus einer Migration kopieren.
2. **Alles in einem Node-Skript (auch die Felder)** — verworfen: verliert die Atomarität der Feld-Überführung; die Migration läuft ohnehin über den etablierten Deploy-Weg (`db push` via CI).
3. **Reihenfolge Migration vor Kopierskript** — verworfen: dann zeigten Fassungs-Bild-URLs bis zum Skriptlauf ins Leere; in der gewählten Reihenfolge existieren die Objekte, bevor eine URL auf sie zeigt. Der Nachweis-Abgleich deckt Zuordnungen auf, die im Fenster zwischen Skript und Migration entstanden sind; das Skript ist dann einfach erneut auszuführen.

---

## Offene Detailfragen für die Umsetzung (erst dort klärbar)

1. Exakte Spaltenliste und Benennung der Fassungs-Felder sowie die konkreten Constraint-Pendants — abhängig vom finalen Story-2-Schema (Beschreibungsfeld), das zum Spike-Zeitpunkt noch nicht umgesetzt ist.
2. Ob die Trainings-Suche (`trainings.search_text`) künftig auch Fassungs-Inhalte indexiert — heute indexiert sie nur Trainings-Stammdaten; eine Erweiterung ist ein eigenständiger Produktentscheid ausserhalb dieses Epics.
3. Die Darstellung des Abweichungs-Hinweises und der Herkunftsangabe — offene UX-Fragen des Epics (§11.1–11.3), betreffen die Stories 5 und 6.
4. Der Umbau der vier Anzeige-/Editor-Pfade (Detail, Druck, Durchführen, Editor) vom Join- auf das Fassungs-Objekt einschliesslich der Frage, ob der bisherige «Übung nicht verfügbar»-Zustand für inhaltsleere Alt-Fassungen erhalten bleibt — Gegenstand der Stories 4 und 5, erst am konkreten Code entscheidbar.
5. Ob der nie validierte Alt-Constraint `training_ex_hkat_genau_bei_hauptteil` im Zuge der Migration validiert oder ersetzt wird — technischer Schuldenposten, der erst mit der finalen Spaltenstruktur beurteilbar ist.

## Konsequenzen für bestehende Festlegungen

1. Das Platzhalter-Prinzip der Architektur-Spec §9.3 (`exercise_id` mit `ON DELETE SET NULL` + Namens-Cache) entfällt mit dem Wegfall des Fremdschlüssels (bereits im Epic §10.1 beschlossen; dieses Dokument konkretisiert das Wie).
2. Der Diagramm-Wiederverwendungs-Spike (Gate 4 dort: «kein Bezug zur Quelle») ist in Bezug auf die Herkunftsangabe überholt; die Kopiermechanik (tiefe Kopie, frische IDs) bleibt gültig.
3. Der Trigger `training_exercise_phase_guard` und die RPC-Logik `move_training_exercise` arbeiten künftig auf Fassungs-Feldern; der Gleichheits-Zwang entfällt (Gate 5).
