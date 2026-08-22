# Stories: Übungsbibliothek — Vorlagen kopieren statt referenzieren

**Datum:** 2026-08-22
**Epic:** `2026-08-16-uebungsbibliothek-epic.md`
**Status:** wächst Story für Story
**Umsetzungsreihenfolge:** Story 2 vor Story 1 (PO-Entscheid 2026-08-22); der Spike setzt einen regelkonformen Bestand voraus.

**Beantwortete Epic-Frage (§11.4, PO 2026-08-22):** Die «Fassung» erhält keinen eigenen Begriff in der Oberfläche. Im Training heisst sie schlicht «Übung», Bibliothekseinträge heissen «Vorlage»; der Kopie-Charakter zeigt sich ausschliesslich über die Herkunftsangabe «basiert auf …». «Fassung» bleibt interner Arbeitsbegriff der Spezifikationen.

---

## Story 1 (Enabler, Spike) — Fassungs-Datenmodell und Überführungsansatz

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Fassungs-Datenmodell und Überführungsansatz

Als Entwicklungsteam
möchte ich klären, wie eine Fassung im Datenmodell lebt, wie Bild und Diagramm entkoppelt kopiert werden und wie der Bestand sicher überführt wird
damit die Datenmodell-Story und die Bestand-Überführung auf abgestimmten, vom Product Owner abgenommenen Entscheiden aufbauen

Preconditions
1. Die Vollständigkeitsregel je Hauptteilkategorie ist wirksam und der gesamte Übungsbestand erfüllt sie.
2. Für Diagramme existiert ein Kopiermechanismus, der die Diagramm-Struktur entkoppelt kopiert; er arbeitet heute nur innerhalb einer bereits bestehenden eigenen Übung.

Acceptance Criteria
1. Das TEAM hat entschieden und dokumentiert, wie eine Fassung im Datenmodell lebt, einschliesslich ihres Verhältnisses zu Katalog, Suche und Favoriten sowie zur privaten Vorlage, die aus «in meine Bibliothek übernehmen» entsteht.
2. Das TEAM hat entschieden, welche Felder die Herkunftsangabe umfasst und wie sie bei Kopien von Kopien und bei Trainings-Kopien unverändert erhalten bleibt.
3. Das TEAM hat die Zugriffsregeln für Fassungen entschieden: wer eine Fassung liest und schreibt, und wie sich das vom Zugriff auf Bibliotheks-Übungen unterscheidet.
4. Das TEAM hat die Machbarkeit eines Bilddatei-Kopierverfahrens geprüft, das ohne erneute serverseitige Bildverarbeitung und ohne Qualitätsverlust auskommt und die Zugriffsregeln des Bildspeichers respektiert.
5. Das TEAM legt einen allfälligen Zielkonflikt beim Bildkopieren dem Product Owner zur Entscheidung vor.
6. Das TEAM hat das Überführungsverfahren für den Bestand festgelegt, mit Laufzeit- und Speichervolumen-Abschätzung auf Basis gemessener Produktionszahlen, benanntem Wiederanlauf-Verhalten bei Teilausfall und einem maschinell prüfbaren Nachweis der Vollständigkeit.
7. Das TEAM hat geklärt, wie die Prüfungen, die heute live auf der referenzierten Übung arbeiten (Vollständigkeit beim Veröffentlichen, Alterskategorien-Abgleich, zwingende Snapshot-Übernahme der Einordnung), künftig auf der Fassung arbeiten.
8. Das TEAM hat geklärt, wie der wiederholbare Ladevorgang des Manual-Bestands funktionsfähig bleibt, ohne Fassungen zu erzeugen.
9. Das TEAM hat je Entscheid die geprüften und verworfenen Alternativen mit Begründung dokumentiert.
10. Der Product Owner hat das Entscheidungsdokument abgenommen.

Postconditions
1. Das Entscheidungsdokument liegt im Repository vor und dient als Grundlage für die Datenmodell-Story und die Bestand-Überführung.
2. Das TEAM hat offene Detailfragen dokumentiert, die erst in der Umsetzung klärbar sind, jeweils mit Begründung, warum sie im Spike nicht entscheidbar waren.

Out of Scope
1. Das TEAM implementiert keine produktive Funktionalität; es entstehen Entscheide und allenfalls Wegwerf-Experimente.
2. Die Darstellung der Herkunftsangabe in der Oberfläche ist nicht Teil des Spikes.

Offene Fragen
Keine. Die drei UX-Fragen des Epics betreffen die Stories 5 und 6; die fehlenden Produktionszahlen werden im Spike selbst gemessen.

Getroffene Entscheide (PO 2026-08-22)
1. Keine Timebox; der Spike ist ergebnisgetrieben, die PO-Abnahme ist das Stop-Kriterium.
2. Story 2 geht dem Spike voraus; die strenge Precondition 1 bleibt bestehen.
3. «Nicht ohne Kompromiss machbar» ist ein zulässiges Spike-Ergebnis beim Bildkopieren; der Zielkonflikt geht dann zurück an den Product Owner.

Mögliche Lösungsansätze (Kontext, keine Empfehlung)
1. Trainings laden heute sämtliche Übungsfelder live über die Verknüpfung; kopiert werden bislang nur der Namens-Zwischenspeicher und der Einordnungs-Snapshot der Zuordnung — ein Verfahren «ganze Übung kopieren» existiert im Bestand nicht.
2. Der Diagramm-Kopiermechanismus kopiert die Diagramm-Struktur mit frischen Element-IDs, jedoch nur in eine bereits existierende eigene Übung; Bilddateien kopiert er nicht.
3. Der Bildspeicher bindet Schreibrechte an das eigene Pfadsegment des Eigentümers; das Kopieren einer fremden Bilddatei ist damit nicht durch den Aufrufer allein möglich.

---

## Story 2 (Enabler, Data) — Fahrplan-Regel je Hauptteilkategorie und Manual-Vollständigkeit

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Fahrplan-Regel je Hauptteilkategorie und Manual-Vollständigkeit

Als Trainer
möchte ich ein freies Spiel mit einer Beschreibung statt eines methodischen Fahrplans erfassen
damit meine Übung das Spiel so festhält, wie es durchgeführt wird, und nicht in ein unpassendes Schema gezwängt wird

Preconditions
1. Im Bestand existieren Übungen der Hauptteilkategorie «Fussball spielen», deren Ablauf noch als methodischer Fahrplan gespeichert ist: eine Manual-Übung mit Extraktionsfehler im Text sowie Trainer-Übungen mit befüllten Fahrplan-Stufen.
2. Der Manual-Bestand ist über einen wiederholbaren Ladevorgang aktualisierbar.

Acceptance Criteria
1. Der USER erfasst bei einer Übung der Hauptteilkategorie «Fussball spielen» eine Beschreibung des Spiels anstelle des methodischen Fahrplans.
2. Der USER erfasst bei Übungen der übrigen Hauptteilkategorien und bei Einleitungs-Übungen weiterhin alle drei Stufen des methodischen Fahrplans.
3. Der USER, der die Hauptteilkategorie einer Übung wechselt, findet seinen bisherigen Ablauftext als Ausgangstext in der zur neuen Kategorie passenden Form vor und redigiert ihn selbst.
4. Der USER findet Übungen der Kategorie «Fussball spielen» über den Inhalt ihrer Beschreibung in der Suche.
5. Das SYSTEM lehnt das Speichern einer Übung ab, deren Ablauf für ihre Hauptteilkategorie unvollständig ist.
6. Das SYSTEM wertet die Beschreibung als vollständig, wenn sie nicht leer ist.
7. Das SYSTEM wendet die Vollständigkeitsregel auf sämtliche Übungen an, auch auf den Manual-Bestand.

Postconditions
1. Das SYSTEM überführt bestehende Übungen der Kategorie «Fussball spielen» einmalig: die befüllten Fahrplan-Stufen stehen in ihrer Reihenfolge als getrennte Absätze in der Beschreibung, ohne Textverlust und ohne redaktionelle Eingriffe.
2. Das SYSTEM liefert die betroffene Manual-Übung mit einer fortlaufend lesbaren, von Extraktionsfehlern bereinigten Beschreibung des Spiels aus; der wiederholbare Ladevorgang erzeugt dauerhaft diesen bereinigten Stand.
3. Das SYSTEM weist die Einhaltung der Vollständigkeitsregel für den gesamten Bestand durch einen automatisierten Validierungslauf nach, der bei jeder Änderung am Bestand erneut läuft.

Out of Scope
1. Beim Kategoriewechsel wird der übernommene Ausgangstext nicht automatisch strukturiert; das Aufteilen auf Fahrplan-Stufen bleibt beim USER.
2. Fassungen von Übungen in Trainings entstehen in dieser Story noch nicht; das Verhältnis zwischen Training und Übung bleibt unverändert.
3. Der übrige Manual-Bestand wird inhaltlich nicht verändert; die Bereinigung betrifft ausschliesslich die eine Übung mit Extraktionsfehler.
4. Die Merkmale des freien Spiels (Mindestdauer von 15 Minuten, Vorgabenarmut) werden weder als Angaben erfasst noch geprüft.

Non-Functional Requirements
1. Die Regelverschärfung greift erst, nachdem die produktiv gespeicherten Übungen nachweislich bereinigt sind.
2. Der wiederholbare Ladevorgang des Manual-Bestands bleibt nach der Umstellung funktionsfähig.
3. Die Überführung verändert an bestehenden Übungen und Trainings nichts Erkennbares ausser der Darstellungsform des Ablaufs.

Offene Fragen
1. @UX Designer: Wie wird das Beschreibungsfeld im Erfassungsformular benannt und von den Fahrplan-Stufen unterschieden?
2. @UX Designer: Wie erkennt der Trainer beim Kategoriewechsel, dass sein bisheriger Text als Ausgangstext übernommen wurde und Redigieren erwartet wird?

Getroffene Entscheide (PO 2026-08-22)
1. Die Beschreibung gilt als vollständig, wenn sie nicht leer ist; keine Mindestlänge.
2. Beim Kategoriewechsel wird der bisherige Ablauftext in beide Richtungen als Ausgangstext übernommen; der Trainer redigiert selbst.
3. Die Merkmale des freien Spiels werden nicht abgebildet oder geprüft; die Beschreibung bleibt frei.
4. Die einmalige Überführung übernimmt die Stufen-Texte als getrennte Absätze in ihrer Reihenfolge, ohne Beschriftung und ohne redaktionelle Eingriffe.
5. Die bereinigte Manual-Beschreibung ist ein fortlaufender, lesbarer Text; Lesbarkeit geht vor Wörtlichkeit.
6. Die neue Regel gilt durchgängig ab dieser Story, einschliesslich des Erfassungs- und Bearbeitungsformulars für Trainer-Übungen.

Mögliche Lösungsansätze (Kontext, keine Empfehlung)
1. Die Vollständigkeitsprüfung ist heute dreifach verankert: im Schema der Übungsdatenbank, in der Formularvalidierung der Anwendung und als Datenbank-Regel; die Datenbank-Regel verlangt die drei Fahrplan-Stufen nur für Trainer-Übungen und nimmt den Manual-Bestand aus.
2. Der Suchtext einer Übung wird heute ausschliesslich aus den Fahrplan-Stufen und dem Aufbau-Text gebildet; die neue Beschreibung ist darin noch nicht enthalten.
3. Im Manual-Bestand ist genau eine Übung betroffen (Seite 81, «Fussball spielen auf Klein- und Grossfeld»); sie ist die einzige mit leeren Stufen, alle übrigen 74 sind vollständig. In Produktion existieren zusätzlich Trainer-Übungen dieser Kategorie mit befüllten Stufen.

---

## Story 3 (Enabler, Data) — Datenmodell für Fassungen mit Herkunftsangabe

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Datenmodell für Fassungen mit Herkunftsangabe

Als Entwicklungsteam
möchte ich ein Datenmodell, in dem jede Trainings-Zuordnung ihre Übungsinhalte als eigenständige Fassung mit unveränderlicher Herkunftsangabe selbst trägt
damit die Business-Stories des Epics auf einer Datengrundlage aufsetzen, in der ein Training von niemandem mehr abhängt

Preconditions
1. Das Spike-Entscheidungsdokument (Zuordnung = Fassung, Herkunftsstruktur, Kopierverfahren) ist abgenommen.
2. Die Vollständigkeitsregel je Hauptteilkategorie ist wirksam und der Übungsbestand erfüllt sie.

Acceptance Criteria
1. Das SYSTEM speichert die Übungsinhalte einer Trainings-Zuordnung als eigenständige Fassung an der Zuordnung selbst.
2. Das SYSTEM hält an jeder Fassung jedes inhaltliche Feld, das auch eine Trainer-Übung in der Bibliothek trägt, einschliesslich Bild und Diagramm.
3. Das SYSTEM stellt einen serverseitigen Erzeugungs-Mechanismus bereit, der aus einer Bibliotheks-Übung eine Fassung mit entkoppelter Bild- und Diagrammkopie erzeugt.
4. Das SYSTEM hält an jeder Fassung die Herkunftsangabe aus Name des Originals, Herkunftstyp und Übernahmezeitpunkt.
5. Das SYSTEM hält dieselbe Herkunftsstruktur für die späteren Abläufe auch an Bibliotheks-Übungen und an Diagramm-Kopien bereit.
6. Das SYSTEM weist jede tatsächliche Wertänderung an den Herkunftsfeldern einer bestehenden Fassung ab.
7. Das SYSTEM hält Fassungen aus dem Übungskatalog, der Suche und den Favoriten heraus.
8. Das SYSTEM wendet die Vollständigkeitsregel je Hauptteilkategorie auf Fassungen an.
9. Das SYSTEM erzwingt für den gesamten Bestand validiert, dass genau Hauptteil-Fassungen eine Hauptteilkategorie tragen.
10. Das SYSTEM erlaubt die freie Änderung der Einordnung einer Fassung in Trainingsteil und Hauptteilkategorie.
11. Das SYSTEM gewährt Lese- und Schreibzugriff auf eine Fassung ausschliesslich nach den Zugriffsregeln des zugehörigen Trainings.
12. Das SYSTEM prüft die Vollständigkeit eines Trainings für die Veröffentlichung anhand der Fassungs-Inhalte.
13. Das SYSTEM entfernt die kopierte Bilddatei einer Fassung auf jedem Löschweg, einschliesslich Trainings-Löschung und Konto-Löschung.
14. Der wiederholbare Ladevorgang des Manual-Bestands bleibt funktionsfähig und erzeugt keine Fassungen.

Postconditions
1. Das SYSTEM hält eine Fassung vollständig nutzbar, WENN ihr Original geändert, privat gestellt oder gelöscht wird oder das Konto seines Eigentümers entfernt wird.
2. Das SYSTEM hinterlässt nach einer fehlgeschlagenen Fassungs-Erzeugung keine Fassung; eine bereits kopierte Bilddatei bleibt folgenlos und wird beim nächsten Versuch überschrieben oder bereinigt.

Out of Scope
1. Die nutzerseitigen Abläufe und Oberflächen für Übernehmen, Bearbeiten und Herkunfts-Anzeige sind nicht Teil dieses Enablers.
2. Die Überführung des Bestands ist nicht Teil dieser Story; der bisherige Übungs-Verweis der Zuordnungen bleibt bestehen, bis die Überführung ihn nicht mehr benötigt.
3. Die Trainings-Suche indexiert die Inhalte von Fassungen nicht.

Non-Functional Requirements
1. Die Zugriffsregeln für Fassungen sind serverseitig durchgesetzt und nicht allein in der Anwendungsschicht abgesichert.
2. Der Erzeugungs-Mechanismus antwortet einschliesslich Bild- und Diagrammkopie in unter einer Sekunde.
3. Bestehende Trainings, Übungen und Favoriten bleiben von der Einführung des Datenmodells unberührt.
4. Die Story wird erst zusammen mit dem neuen Übernehmen und der Bestand-Überführung nutzerwirksam ausgeliefert, damit nie zwei Verhaltensweisen nebeneinander bestehen.

Offene Fragen
Keine — die Struktur folgt vollständig dem abgenommenen Spike-Entscheidungsdokument.

---

## Story 4 (Business, Paths) — Übung als Fassung ins Training übernehmen

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Übung als Fassung ins Training übernehmen

Als Trainer
möchte ich eine Übung aus der Bibliothek in mein Training übernehmen und dabei eine eigene, unabhängige Fassung erhalten
damit mein Training vollständig mir gehört und sich nie durch Handlungen anderer verändert

Preconditions
1. Das Fassungs-Datenmodell mit serverseitigem Erzeugungs-Mechanismus ist wirksam.

Acceptance Criteria
1. Der USER kann im Übungs-Picker eines Trainingsteils jede dazu passende, für ihn sichtbare Bibliotheks-Übung übernehmen: eigene, öffentliche anderer Trainer und Manual-Übungen.
2. Der USER erhält mit der Übernahme eine eigenständige Fassung im Training.
3. Das SYSTEM ordnet die Fassung dem Trainingsteil und bei Hauptteil der Kategorie zu, in der der USER den Picker geöffnet hat.
4. Das SYSTEM reiht die neue Fassung am Ende ihres Abschnitts ein.
5. Der USER kann dieselbe Vorlage mehrfach in dasselbe Training übernehmen und erhält jedes Mal eine eigene Fassung.
6. Der USER kann eine Fassung im Trainings-Editor entfernen.
7. Der Übungs-Picker bietet kein Entfernen an.
8. Das SYSTEM informiert den USER, wenn eine Übernahme fehlschlägt.

Postconditions
1. Das SYSTEM erzeugt die Fassung mit sämtlichen Inhalten der Vorlage zum Übernahmezeitpunkt, einschliesslich eigenständiger Bild- und Diagrammkopie, WENN der USER die Übernahme auslöst; massgeblich ist die Feldmenge des Fassungs-Datenmodells.
2. Das SYSTEM stempelt die Herkunftsangabe der Fassung zum Übernahmezeitpunkt.
3. Das SYSTEM lässt die Vorlage bei der Übernahme unverändert.
4. Das SYSTEM bricht die Übernahme folgenlos ab, WENN die Vorlage im Moment der Übernahme nicht mehr sichtbar oder nicht mehr vorhanden ist.

Out of Scope
1. Das Bearbeiten der Fassung ist nicht Teil dieser Story.
2. Eine Wahl eines anderen Trainingsteils im Übernahme-Moment gibt es nicht; verschoben wird danach im Trainings-Editor.
3. Eine Passungsprüfung zwischen Vorlage und Training über die bestehende Alterskategorien-Warnung hinaus findet nicht statt.

Non-Functional Requirements
1. Das Übernehmen antwortet einschliesslich Bild- und Diagrammkopie in unter einer Sekunde.
2. Die Story wird erst zusammen mit der Bestand-Überführung nutzerwirksam ausgeliefert, damit nie zwei Verhaltensweisen nebeneinander bestehen.

Getroffene Entscheide (PO 2026-08-22)
1. Der Übungs-Picker bleibt wie heute je Trainingsteil (bei Hauptteil je Kategorie) gebunden; die Fassung landet genau dort. Die heutige harte Zurückweisung unpassender Übungen wird gegenstandslos, weil der Picker nur Passendes anbietet.
2. Mehrfach-Übernahme derselben Vorlage ins selbe Training ist erlaubt.

Offene Fragen
1. @UX Designer: Wie erfährt der Trainer nach der Übernahme, dass die Fassung angelegt ist, und bleibt der Picker für weitere Übernahmen offen?
