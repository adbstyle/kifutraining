# Stories: Juniorenfussball-Trainingsschema

Stand 2026-08-16. Story-Ausarbeitung zum Epic «Juniorenfussball-Trainingsschema» (`2026-08-14-juniorenfussball-epic.md`). Die Stories werden einzeln analysiert, diskutiert und validiert; dieses Dokument wächst Story für Story. Release-Entscheid: Das gesamte Epic wird als Ganzes released (PO, 2026-08-16); die Story-Reihenfolge ist reine Entwicklungs-Reihenfolge.

Faktenlage für Story 1 (aus Quellen- und Bestandsanalyse):

- Bestand: 75 Manual-Übungen — 55 Hauptteil (davon 50 Fussball spielen lernen, 4 Vielseitigkeit erleben, 1 Fussball spielen), 12 Einleitung, 4 Auffangen, 4 Ausklang. Die Pflichtattribute (Trainingsteil, bei Hauptteil die Hauptteilkategorie) sind bei allen 75 gesetzt; optionale Attribute sind lückenhaft (Feldtyp 33 von 75, Material 8 von 75, Varianten 0 von 75, Erscheinungsform nur bei Hauptteil-Übungen).
- Als Eingangsgrössen einer Abbildungsregel trennscharf belegt sind damit nur Trainingsteil und Hauptteilkategorie.
- Das Juniorenschema hat fünf befüllbare Stellen: Aufwärmen und Explosivität im Einstieg, Spielformen und unterstützende Übungen sowie Spiel im Hauptteil, Ausklang im Abschluss. Für Explosivität und Körperstabilität/Prävention (laut J+S Teil des Aufwärmens, Phase 1) gibt es im Kinderfussball-Modell keine Entsprechung.
- Der J+S-Lernbaustein «Der Einstieg» gliedert den Einstieg in drei Phasen mit eigenen Zeitangaben: Aktivierung und Körperstabilität 10–12 Minuten, Spielform zum Trainingsziel 6–8 Minuten, Explosivität 8–10 Minuten.
- Das Manual Fussball Jugendliche kennt keine Kategorien-Differenzierung D/C/B/A; es beschreibt eine einzige Struktur für die FTEM-Stufe Foundation 3.
- Quellen im Projekt: sources/junioren/ (Manual Fussball Jugendliche als PDF, FVBJ-Broschüre, FF14-Ausführungsbestimmungen, zehn J+S-Einstiegs-Übungsblätter). Precondition 1 von Story 1 ist damit erfüllt.
- Am PDF verifiziert: Abbildung 17 beschriftet die Trainingsteile doppelt als EINLEITUNG/EINSTIEG und AUSKLANG/ABSCHLUSS — das Junioren-Manual verwendet die Begriffe synonym. Abbildung 19 bestätigt Einstieg 20–30, Spielformen und unterstützende Übungen 30–45, Spiel 15–20, Ausklang 5–10 Minuten bei Gesamtdauer 90 Minuten; der Broschüren-Wert 45–65 für Spielformen bleibt als PO-Entscheid bestehen.
- Das Manual stellt Übungen nicht in einem einheitlichen Raster dar: Die Spielphasen-Kapitel führen Erscheinungsformen, taktische Prinzipien, Ziele, Coachingpunkte und Entwicklungsfragen auf Kapitel-Ebene und darunter Basisspielform, Spielformen und Übungen nur mit Name, Ablauftext und Spielfeldgrösse. Ein Dauer-Feld gibt es nur im Persönlichkeits-Kapitel, ein Material-Feld nirgends.

Vorgaben des Product Owners an den Spike (entschieden am 2026-08-14):

- Die vier Auffangen-Übungen enden in der Abbildungsregel als «ohne Entsprechung»; sie sind in Junioren-Trainings nicht zuweisbar.
- Der Unterblock Spiel kann Übungen tragen; bleibt er leer, erzeugt das Speichern einen Hinweis, blockiert aber nichts.
- Die Unterblöcke Explosivität und Aufwärmen (inklusive Körperstabilität) müssen über Trainer-Übungen befüllbar sein; der Spike legt fest, wie das ohne Doppelpflege einer Übung geht.
- Zeitbandbreiten gemäss FVBJ-Broschüre (Spielformen und unterstützende Übungen 45–65 Minuten); für die Einstiegs-Phasen gelten die J+S-Werte.

---

## Story 1 (Enabler, Spike): Junioren-Schema und Abbildungsregel klären

Status: Umgesetzt und abgeschlossen am 2026-08-15. Ergebnis: `2026-08-15-junioren-abbildungsregel.md`, vom Product Owner mit datiertem Vermerk abgenommen. Alle zehn Acceptance Criteria sind erfüllt (adversarial gegen Bestand und Quellen-PDFs geprüft).

Als Entwicklungsteam
möchte ich zusammen mit dem Product Owner die Übungs- und Trainingsschemata des Juniorenfussballs sichten und die Abbildungsregel von den Kinderfussball-Attributen einer Übung auf ihre Einordnung im Juniorenschema festlegen
damit die nachfolgenden Modellierungs- und Planer-Stories auf einer abgestimmten fachlichen Grundlage aufbauen

Preconditions

1. Die SFV- und J+S-Quellen zum Juniorenfussball liegen im Projekt vor, einschliesslich des Manuals Fussball Jugendliche als PDF
2. Die Bestandsübungen tragen die Pflichtattribute vollständig

Acceptance Criteria

1. Das TEAM hat die Abbildungsregel dokumentiert, die jeder Übung aus ihren Kinderfussball-Attributen genau eine Einordnung im Juniorenschema zuweist oder sie als ohne Entsprechung ausweist
2. Die Abbildungsregel benennt ihre Eingangsattribute und deren Wertebereiche ausdrücklich, nicht gesetzte Werte eingeschlossen
3. Die Abbildungsregel liefert für jede Kombination dieser Eingangswerte genau ein Ergebnis, ohne Lücke und ohne Überlappung
4. Die Abbildungsregel weist für jeden Unterblock des Juniorenschemas aus, wie er über Übungen befüllbar ist, oder hält mit Verweis auf die Attributlage oder die Quelle fest, warum er über den heutigen Bestand nicht erreichbar ist
5. Das TEAM hat festgelegt, wie ein Trainer eigene Übungen erfasst, die in den Unterblöcken Aufwärmen und Explosivität eingeordnet werden, ohne dass eine Übung doppelt gepflegt wird
6. Das TEAM hat dokumentiert, mit welchen der bestehenden Kinderfussball-Angaben ein Trainer steuert, wo seine Übung im Juniorenschema eingeordnet wird
7. Das TEAM hat die Zeitbandbreiten je Trainingsteil und Unterblock mit Quellenbeleg als Orientierungswerte festgehalten
8. Das TEAM hat den Quellenbeleg für die Einheitlichkeit des Schemas für die Kategorien D bis A im Entscheidungsdokument festgehalten
9. Falls sich keine fachlich tragfähige Abbildungsregel definieren lässt, hat das TEAM die Konsequenzen für das Epic samt Alternativen dokumentiert
10. Der Product Owner hat die Abbildungsregel mit datiertem Vermerk im Entscheidungsdokument abgenommen

Postconditions

1. Das TEAM hat ein Entscheidungsdokument im Projekt abgelegt, das als fachliche Grundlage für die nachfolgenden Stories dient
2. Das TEAM hat offene Punkte dokumentiert, die erst in den Umsetzungs-Stories klärbar sind, einschliesslich der Fragen an die UX-Konzeption
3. Das Entscheidungsdokument benennt, welche bestehenden Architektur- und Dokumentationsaussagen des Projekts durch die Abbildungsregel überholt sind

Out of Scope

1. Das TEAM ändert weder Datenmodell noch Oberfläche, der Spike liefert ausschliesslich Dokumentation und Entscheide
2. Das TEAM baut keinen kuratierten Übungsbestand aus einer Junioren-Quelle auf, auch nicht aus den J+S-Einstiegs-Übungsblättern

Offene Fragen

Keine.

---

Faktenlage für Story 2 (aus der Codebase-Analyse dieser Session):

- Die Alterskategorien G, F, E sind heute an mehreren Stellen unabhängig voneinander hartkodiert: im JSON-Schema der Übungen, in zwei Datenbank-Constraints (Übungen und Trainings), im generierten Vokabular-Modul, in den Klartext-Labels, in der Sortierreihenfolge, in den Farbzuordnungen der Oberfläche und in den Python-Werkzeugen.
- Die Alterskategorien fehlen in der kontrollierten Vokabularquelle `data/vokabular.yaml` — im Widerspruch zum dokumentierten Prinzip der einen Quelle.
- Übungen tragen Alterskategorien als Mehrfachwert; im Bestand kommen die Kombinationen G+F+E (32), F+E (28), nur E (11) und G+F (4) vor. Trainings tragen Alterskategorien ebenfalls als Mehrfachwert.
- Es gibt echte Nutzer; Migrationen sind forward-only, bestehende Zeilen müssen jede Änderung unverändert überstehen.

## Story 2 (Business): Übungen und Trainings mit Alterskategorien D bis A auszeichnen und filtern

Status: Final ausgearbeitet und validiert am 2026-08-16.

Anmerkung: Eine Übung darf Alterskategorien beider Schemata gleichzeitig tragen (z.B. E und D) — das ist gewollt, weil eine Übung beiden Schemata dienen kann. Das Mischverbot gilt ausschliesslich für Trainings und liegt in der Schema-Story.

Als Trainer:in im Juniorenfussball
möchte ich Übungen und Trainings mit den Alterskategorien D bis A auszeichnen und danach filtern
damit ich meine Inhalte der richtigen Stufe zuordnen und passende Übungen finden kann

Preconditions

1. Das Entscheidungsdokument des Spikes liegt abgenommen vor

Acceptance Criteria

1. Der USER kann einer Übung jede Teilmenge der Alterskategorien G, F, E, D, C, B und A zuweisen
2. Der USER kann einem Training Alterskategorien aus dem gesamten Bereich G bis A zuweisen
3. Der USER kann den Übungskatalog nach den neuen Alterskategorien gleichwertig mit den bestehenden filtern
4. Der USER kann die Trainings-Übersichten nach den neuen Alterskategorien filtern
5. Das SYSTEM zeigt bei Mehrfachauswahl im Kategorien-Filter alle Einträge, die mindestens eine der gewählten Kategorien tragen
6. Das SYSTEM ordnet die Alterskategorien überall in der fachlichen Reihenfolge G, F, E, D, C, B, A
7. Das SYSTEM bezieht die Alterskategorien in allen Bestandteilen der Applikation aus der einen kontrollierten Vokabularquelle, und die Übereinstimmung ist automatisiert nachgewiesen

Postconditions

1. Das SYSTEM lässt alle bestehenden Übungen und Trainings unverändert und gültig: identische Feldwerte, alle Invarianten weiterhin erfüllt, nachgewiesen gegen eine Kopie des Produktionsbestands
2. Das SYSTEM lässt die Zuordnung einer Übung ohne Stufen-Überlappung weiterhin zu und markiert sie nur mit dem bestehenden Hinweis

Out of Scope

1. Das SYSTEM leitet in dieser Story aus den Alterskategorien noch kein Trainingsschema ab und prüft keine Schema-Mischung; diese Regeln liegen in der Schema-Story desselben Releases

Offene Fragen

1. @UX Designer: Welche Farbe und welches Kurzlabel erhält jede der neuen Alterskategorien in der Oberfläche?
2. @UX Designer: Wie skaliert der Kategorien-Filter von drei auf sieben Werte, als gemeinsamer Block oder nach Schema gruppiert?

---

Faktenlage für Story 3 (aus der Codebase-Analyse dieser Session):

- Eine Stufen-Änderung am Training speichert heute sofort und ohne Rückfrage; erst danach zeigt ein Dialog die Übungen ohne Stufen-Überlappung mit den Optionen Behalten oder Entfernen. Ein Konzept von Übertragung oder Nacharbeit existiert nicht.
- Die Zuordnung einer Übung ist heute nie durch Stufen blockiert; die einzige Markierung ist ein Warnsymbol pro Zeile, berechnet, nicht gespeichert.
- Eine Datenbank-Invariante setzt ein veröffentlichtes Training automatisch auf privat, sobald es die Veröffentlichungsbedingungen verletzt; der Trainer wird nachträglich per Meldung informiert.
- Die Abbildungsregel des Spikes definiert die Übertragung: 12 Einleitungs-Übungen nach Aufwärmen, 54 nach Spielformen und unterstützende Übungen, 1 nach Spiel, 4 nach Ausklang, 4 Auffangen-Übungen ohne Entsprechung. Rückrichtung: Aufwärmen nach Einleitung, Explosivität ohne Entsprechung.

## Story 3 (Business): Trainingsschema aus den Alterskategorien bestimmen

Status: Final ausgearbeitet und validiert am 2026-08-16.

Als Trainer:in im Juniorenfussball
möchte ich, dass sich mein Training nach dem Schema der gewählten Alterskategorien richtet
damit ein D-Training die Junioren-Struktur erhält und nicht die Struktur des Kinderfussballs

Preconditions

1. Die Alterskategorien D bis A sind im Übungs- und Trainingsmodell verfügbar
2. Die Abbildungsregel für die Übertragung zwischen den Schemata ist als Entscheidungsdokument abgenommen

Acceptance Criteria

1. Das SYSTEM bestimmt das Schema eines Trainings aus seinen Alterskategorien: G, F und E ergeben das Kinderfussball-Schema, D, C, B und A das Juniorenschema
2. Das SYSTEM behandelt ein Training ohne Alterskategorie nach dem Kinderfussball-Schema
3. Das SYSTEM wertet jede Kategorie-Änderung als Schema-Wechsel, durch die sich das massgebliche Schema ändert, einschliesslich des Entfernens der letzten Alterskategorie eines Junioren-Trainings
4. Das SYSTEM verhindert, dass ein Training gleichzeitig Alterskategorien beider Schemata trägt
5. Der USER muss einen Schema-Wechsel bestätigen, wenn dem Training Übungen zugeordnet sind
6. Der USER erkennt vor der Bestätigung, welche zugeordneten Übungen im neuen Schema keine Entsprechung haben
7. Das SYSTEM vollzieht einen Schema-Wechsel an einem Training ohne zugeordnete Übungen ohne Bestätigung

Postconditions

1. Das SYSTEM übernimmt die neuen Alterskategorien und überträgt die zugeordneten Übungen anhand der Abbildungsregel in die Struktur des neuen Schemas WENN der USER den Wechsel bestätigt
2. Das SYSTEM lässt das Training vollständig unverändert WENN der USER den Wechsel abbricht
3. Das SYSTEM behält übertragene Übungen ohne Entsprechung im Training, markiert sie als Nacharbeit und setzt das Training auf privat, solange die Nacharbeit offen ist
4. Das SYSTEM löst die Nacharbeits-Markierung von selbst auf, WENN der USER die betroffene Zuordnung entfernt oder ersetzt
5. Das SYSTEM setzt ein veröffentlichtes Training auf privat und informiert den USER, WENN es nach dem Wechsel die Veröffentlichungsbedingungen seines neuen Schemas nicht mehr erfüllt

Out of Scope

1. Das SYSTEM ändert beim Schema-Wechsel eines Trainings nicht die gepflegte Heimat der betroffenen Übungen; die Übertragung betrifft ausschliesslich die Zuordnungen im Training
2. Das SYSTEM prüft innerhalb eines Schemas weiterhin nicht, ob die Alterskategorien einer Übung mit den Stufen des Trainings überlappen
3. Der USER kann eine Nacharbeits-Markierung nicht manuell als erledigt abhaken; sie löst sich ausschliesslich über das Entfernen oder Ersetzen der Zuordnung

Offene Fragen

1. @UX Designer: Wie werden der Bestätigungsdialog vor dem Schema-Wechsel und die Nacharbeits-Markierung an übertragenen Übungen gestaltet, auch im Zusammenspiel mit dem bestehenden Dialog für Übungen ausserhalb der Stufen?

---

Faktenlage für Story 4 (aus den Codebase-Analysen dieser Session, keine neuen Agenten nötig):

- Der Trainings-Editor rendert heute fest die vier Kinderfussball-Teile in fixer Reihenfolge; Gruppierung, Positions-Eindeutigkeit und die Verschiebe-Logik kennen nur diese Struktur. Übungen mit fremden Werten verschwinden in Durchführung und Druck stillschweigend; bis die Durchführungs-Story greift, ist das ein reiner Entwicklungs-Zwischenstand, der wegen des Ganzes-Epic-Releases nie Nutzer erreicht.
- Die bestehende Gleichheits-Invariante zwischen Übungs- und Zuordnungs-Trainingsteil (App und Datenbank) muss der abgeleiteten Einordnung weichen; ebenso brauchen die neuen Teile eine Positions-Eindeutigkeit. Beides ist als Ist-Zustands-Konflikt im Epic dokumentiert.
- Der Übungs-Picker bietet je Trainingsteil exakt die Übungen mit passendem Kinderfussball-Trainingsteil an. Im Junioren-Hauptteil führt die Abbildungsregel drei Kinderfussball-Kategorien zusammen: 54 Übungen aus Fussball spielen lernen und Vielseitigkeit erleben sowie 1 aus Fussball spielen.
- Jede Zuordnung trägt eine frei wählbare Dauer in Fünf-Minuten-Schritten; je Trainingsteil wird die Summe angezeigt. Diese Mechanik gilt unverändert auch für die Junioren-Teile.
- PO-Entscheide 2026-08-16: Im Juniorenschema gibt es keine Anzahl-Hinweise (die Orientierung übernimmt die Zeitbandbreiten-Anzeige, dauerhaft). Alle drei Junioren-Trainingsteile tragen eine Dauer; ein Pendant zum dauerlosen Auffangen existiert nicht. Nacharbeits-Zuordnungen erscheinen in einem eigenen Bereich gesondert von den drei Trainingsteilen.

## Story 4 (Business): Junioren-Training nach Einstieg, Hauptteil und Abschluss gliedern

Status: Final ausgearbeitet und validiert am 2026-08-16.

Als Trainer:in im Juniorenfussball
möchte ich mein Junioren-Training entlang der drei Trainingsteile Einstieg, Hauptteil und Abschluss zusammenstellen
damit mein Training der SFV-Struktur des Juniorenfussballs folgt

Preconditions

1. Das Training trägt eine Junioren-Alterskategorie und sein Schema ist daraus bestimmt
2. Die Abbildungsregel für die Einordnung von Übungen ist als Entscheidungsdokument abgenommen

Acceptance Criteria

1. Der USER sieht sein Junioren-Training nach den drei Trainingsteilen Einstieg, Hauptteil und Abschluss in dieser festen Reihenfolge gegliedert
2. Der USER erkennt im Editor jederzeit, dass sein Training dem Juniorenschema folgt
3. Der USER kann jedem der drei Trainingsteile Übungen zuordnen und je Zuordnung eine Dauer erfassen
4. Das SYSTEM bietet zur Zuordnung ausschliesslich Übungen an, deren Einordnung gemäss Abbildungsregel im gewählten Trainingsteil liegt
5. Der USER kann die Reihenfolge der Übungen innerhalb eines Trainingsteils ändern
6. Der USER kann eine zugeordnete Übung wieder entfernen
7. Der USER sieht je Trainingsteil die Summe der erfassten Übungsdauern
8. Der USER sieht Nacharbeits-Zuordnungen in einem eigenen Bereich gesondert von den drei Trainingsteilen

Postconditions

1. Das SYSTEM stellt die Gliederung und die Reihenfolge der Zuordnungen beim erneuten Öffnen des Trainings unverändert dar

Out of Scope

1. Die Unterblöcke von Einstieg und Hauptteil sind nicht Teil dieser Story; die Trainingsteile erscheinen als flache Listen, bis die Unterblock-Story greift. Dieser Entwicklungs-Zwischenstand erreicht wegen des Ganzes-Epic-Releases nie Nutzer
2. Das SYSTEM zeigt in dieser Story noch keine Soll-Zeitbandbreiten an; Anzahl-Hinweise gibt es im Juniorenschema dauerhaft nicht
3. Die Veröffentlichung eines Junioren-Trainings ist nicht Teil dieser Story

Offene Fragen

1. @UX Designer: Woran erkennt der Trainer im Übungs-Picker, warum eine Übung im gewählten Trainingsteil angeboten wird, wenn dort Übungen unterschiedlicher Herkunft zusammenkommen?

---

Faktenlage für die Stories 5a und 5b (aus der Übungs-Editor-Analyse dieser Session):

- Die frühere Story 5 wurde getrennt: 5a gliedert Einstieg und Hauptteil im Trainings-Editor in Unterblöcke, 5b bringt die Heimat-Wahl in den Übungs-Editor (PO-Entscheid 2026-08-16).
- Der bestehende Hauptteil-Mechanismus ist das Vorbild für 5a: Der Unterblock folgt zwingend aus einem Attribut der Übung, Positionen sind je Unterblock eindeutig, ein direktes Verschieben zwischen Unterblöcken existiert nicht.
- Der Übungs-Editor schaltet heute die Pflichtfelder am Trainingsteil um: methodischer Fahrplan bei Einleitung und Hauptteil (bei Trainer-Übungen alle drei Stufen Pflicht), Aufbau-Text bei Auffangen und Ausklang, Erscheinungsform nur bei Einleitung und Hauptteil, Hauptteilkategorie genau bei Hauptteil.
- Es existiert keine Sicht, in welchen Trainings eine Übung verwendet wird; Trainingsteil-Änderungen laufen heute ohne Warnung. Die daraus folgende Bestands-Inkonsistenz wird ausserhalb dieses Epics behandelt.
- Das Aufwärmen umfasst fachlich auch Körperstabilität und Prävention (Manual S. 72); solche Drills haben keinen natürlichen Wettkampf-Abschluss.
- Der Einstieg hat drei Unterblöcke: Aufwärmen, Spielform zum Trainingsziel und Explosivität (PO-Entscheid 2026-08-16, ersetzt die frühere Zweiteilung). Die Spielform zum Trainingsziel ist eine eigenständige Übungsart, die den Trainingsschwerpunkt einführt und den roten Faden zum Hauptteil herstellt.
- PO-Entscheide 2026-08-16: Der Unterblock folgt zwingend aus der Übung (kein freies Wählen). Leere Unterblöcke Spiel, Spielform zum Trainingsziel und Explosivität erzeugen einen Hinweis. Übungen mit Heimat Aufwärmen oder Spielform zum Trainingsziel tragen den Fahrplan, wobei nur die Stufe Offen starten Pflicht ist, und dürfen eine Erscheinungsform tragen; Explosivitäts-Übungen tragen einen Aufbau-Text ohne Erscheinungsform. Jede Heimat-Änderung einer in Trainings verwendeten Übung warnt vor dem Speichern, unabhängig davon, wem das Training gehört.

## Story 5a (Business): Einstieg und Hauptteil eines Junioren-Trainings in Unterblöcke gliedern

Status: Final ausgearbeitet und validiert am 2026-08-16.

Als Trainer:in im Juniorenfussball
möchte ich Einstieg und Hauptteil meines Junioren-Trainings in ihre Unterblöcke gegliedert planen
damit ich Aufwärmen, Zieleinführung, Explosivität, Spielformen und freies Spiel gezielt und in der richtigen Balance zusammenstelle

Preconditions

1. Das Training folgt dem Juniorenschema und ist nach den drei Trainingsteilen gegliedert

Acceptance Criteria

1. Der USER sieht den Einstieg in die Unterblöcke Aufwärmen, Spielform zum Trainingsziel und Explosivität gegliedert
2. Der USER sieht den Hauptteil in die Unterblöcke Spielformen und unterstützende Übungen sowie Spiel gegliedert
3. Der USER erkennt die Unterblock-Struktur auch dann, wenn ein Unterblock keine Übungen enthält
4. Der USER kann einem Unterblock Übungen zuordnen
5. Der USER kann die Reihenfolge der Übungen innerhalb eines Unterblocks ändern
6. Das SYSTEM bietet je Unterblock ausschliesslich Übungen an, deren Einordnung gemäss Abbildungsregel in diesem Unterblock liegt
7. Der USER wird auf leere Unterblöcke Spiel, Spielform zum Trainingsziel und Explosivität hingewiesen
8. Das SYSTEM blockiert das Speichern wegen eines leeren Unterblocks nicht; die Bedingungen der Veröffentlichung regelt die Veröffentlichungs-Story

Postconditions

1. Das SYSTEM stellt Gliederung und Reihenfolge je Unterblock beim erneuten Öffnen des Trainings unverändert dar

Out of Scope

1. Das SYSTEM bietet kein direktes Verschieben einer Übung zwischen Unterblöcken an; ein Wechsel erfolgt über Entfernen und erneutes Zuordnen
2. Das SYSTEM zeigt in dieser Story keine Zeitbandbreiten je Unterblock an

Offene Fragen

1. @UX Designer: Woran erkennt der Trainer die Herkunft der Übungen innerhalb eines Unterblocks, wenn dort abgeleitete Kinderfussball-Übungen und Übungen mit Junioren-Heimat zusammenkommen?

## Story 5b (Business): Übungen mit Junioren-Heimat in einem Einstiegs-Unterblock erfassen

Status: Final ausgearbeitet und validiert am 2026-08-16.

Als Trainer:in im Juniorenfussball
möchte ich eigene Übungen erfassen, die in einem Einstiegs-Unterblock des Juniorenschemas zuhause sind
damit ich die Einstiegs-Unterblöcke meines Junioren-Trainings mit passenden Übungen befüllen kann

Preconditions

1. Der Heimat-Mechanismus ist als Entscheidungsdokument abgenommen

Acceptance Criteria

1. Der USER wählt beim Erfassen einer eigenen Übung als Heimat entweder einen Kinderfussball-Trainingsteil oder einen der drei Einstiegs-Unterblöcke Aufwärmen, Spielform zum Trainingsziel oder Explosivität
2. Das SYSTEM verhindert, dass eine Übung gleichzeitig einen Kinderfussball-Trainingsteil und eine Junioren-Heimat trägt
3. Der USER erfasst bei einer Übung mit Heimat Aufwärmen oder Spielform zum Trainingsziel mindestens die Fahrplan-Stufe Offen starten
4. Der USER kann bei diesen Übungen die Fahrplan-Stufen Üben und Wetteifern ergänzen
5. Der USER erfasst bei einer Übung mit Heimat Explosivität einen Aufbau-Text
6. Der USER kann bei einer Übung mit Heimat Aufwärmen oder Spielform zum Trainingsziel eine Erscheinungsform wählen
7. Das SYSTEM lässt bei einer Übung mit Heimat Explosivität keine Erscheinungsform zu
8. Der USER kann die Heimat einer bestehenden eigenen Übung ändern und muss dabei die Pflichtangaben der neuen Heimat vervollständigen
9. Der USER wird bei jeder Heimat-Änderung einer Übung gewarnt, die in mindestens einem Training verwendet wird, unabhängig davon, wem das Training gehört

Postconditions

1. Das SYSTEM ordnet eine Übung mit Junioren-Heimat in Junioren-Trainings dem gewählten Unterblock zu
2. Das SYSTEM stellt eine Übung mit Heimat Aufwärmen oder Spielform zum Trainingsziel in Kinderfussball-Trainings als Einleitungs-Übung bereit
3. Das SYSTEM bietet eine Übung mit Heimat Explosivität in Kinderfussball-Trainings nicht an
4. Das SYSTEM übernimmt die Heimat-Änderung einer in Trainings verwendeten Übung erst, WENN der USER die Warnung bestätigt hat
5. Das SYSTEM entfernt beim gespeicherten Heimat-Wechsel die Angaben, die für die neue Heimat nicht zulässig sind

Out of Scope

1. Die Manual-Übungen behalten ihre Kinderfussball-Heimat; eine Nachpflege des Bestands findet nicht statt
2. Das SYSTEM ändert bestehende Zuordnungen in Trainings bei einer Heimat-Änderung nicht automatisch
3. Das SYSTEM erfasst keine strukturierten Belastungsparameter für Explosivitäts-Übungen; Serien, Distanzen und Pausen stehen frei im Aufbau-Text

Offene Fragen

1. @UX Designer: Wie werden die Heimat-Wahl im Übungs-Editor und die Verwendungs-Warnung gestaltet, insbesondere für Trainer, die nur eine der beiden Welten kennen?

---

Faktenlage für Story 6 (aus der Dauer-Analyse dieser Session):

- Dauern werden je Zuordnung in Fünf-Minuten-Schritten erfasst, sind optional und haben keine Obergrenze. Fehlende Dauern zählen nicht zur Summe.
- Summen zeigt die App bereits auf drei Ebenen: je Unterblock, je Trainingsteil und für das ganze Training. Sie erscheinen im Editor, im Druck, in der mobilen Durchführung und auf den Übersichtskarten; die Durchführungsansicht zeigt als einzige keine Unterblock-Summen.
- Alle bestehenden Hinweise im Editor sind rein informativ und dauerhaft sichtbar, nie an ein Speichern gebunden. Sie prüfen ausschliesslich Anzahl oder Vorhandensein, nie eine Zeitsumme.
- Einen Soll-Ist-Vergleich gibt es im gesamten Produkt bisher nicht; es existiert kein Muster, an dem sich eine Bandbreiten-Anzeige orientieren könnte.
- PO-Entscheide 2026-08-16: Die App gleicht die erfassten Dauern gegen die Bandbreiten ab, statt sie nur als Referenz anzuzeigen. Die Orientierung gilt ausschliesslich im Juniorenschema, weil das Kinderfussball-Manual bewusst keine Zeiten vorgibt.
- Konsistenz der Ebenen: Die Summe der drei Einstiegs-Unterblöcke (24–30 Minuten) und die Manual-Bandbreite des Trainingsteils Einstieg (20–30 Minuten) gelten je für sich; das System verlangt keine Konsistenz zwischen den Ebenen, weil alle Werte unverbindlich sind. Werte exakt auf einer Bandbreiten-Grenze zählen als innerhalb.
- Der J+S-Lernbaustein «Der Einstieg» ist als Textauszug unter sources/junioren/ archiviert; er ist die Quelle der Phasen-Namen und -Zeitwerte.

## Story 6 (Business): Zeitbandbreiten und Gesamtdauer als Orientierung anzeigen

Status: Final ausgearbeitet und validiert am 2026-08-16.

Als Trainer:in im Juniorenfussball
möchte ich beim Planen erkennen, wie meine erfassten Dauern zu den Richtwerten des Trainingsschemas stehen
damit ich mein Training auf die vorgesehenen 90 Minuten ausbalanciere, ohne selbst rechnen zu müssen

Preconditions

1. Das Training folgt dem Juniorenschema und ist nach Trainingsteilen und Unterblöcken gegliedert

Acceptance Criteria

1. Der USER erkennt je Trainingsteil und je Unterblock die Zeitbandbreite des Trainingsschemas
2. Der USER erkennt, ob seine erfasste Summe je Trainingsteil und je Unterblock innerhalb der jeweiligen Bandbreite liegt und in welche Richtung sie gegebenenfalls abweicht
3. Das SYSTEM zeigt für Trainingsteile und Unterblöcke ohne erfasste Dauer nur die Bandbreite, ohne Bewertung
4. Der USER erkennt, wie die Gesamtdauer seines Trainings zur vorgesehenen Gesamtdauer von 90 Minuten steht
5. Das SYSTEM zeigt die Zeit-Orientierung ausschliesslich bei Trainings des Juniorenschemas
6. Das SYSTEM lässt sich vom Abgleich weder beim Speichern noch beim Veröffentlichen beeinflussen

Postconditions

1. Das SYSTEM aktualisiert den Abgleich, sobald der USER eine Dauer erfasst, ändert oder eine Zuordnung entfernt
2. Das SYSTEM lässt Zuordnungen ohne erfasste Dauer im Abgleich unberücksichtigt

Out of Scope

1. Das SYSTEM zeigt keine Zeit-Orientierung bei Kinderfussball-Trainings; deren Lehrmittel gibt bewusst keine Zeiten vor
2. Das SYSTEM begrenzt die erfassbare Dauer einer Zuordnung nicht und erzwingt keine Gesamtdauer
3. Das SYSTEM schlägt keine Dauern vor und verteilt die Gesamtdauer nicht automatisch auf die Trainingsteile

Offene Fragen

1. @UX Designer: Wie wird der Abgleich dargestellt, und erscheint er ausser im Editor auch in der Durchführungsansicht, im Druck und auf der Übersichtskarte?

---

Faktenlage für Story 7 (aus der Veröffentlichungs-Analyse dieser Session):

- Ein Trainer schaltet ein Training im Editor öffentlich. Sind die Bedingungen nicht erfüllt, nennt ihm ein Hinweis die fehlenden Punkte als Klartext-Liste; er springt jedoch nicht an die betroffene Stelle im Editor.
- Verwendet das Training eigene private Übungen, muss der Trainer deren Mitveröffentlichung bestätigen; diese Übungen bleiben danach dauerhaft öffentlich.
- Verletzt ein veröffentlichtes Training nachträglich eine Bedingung, setzt das System es selbsttätig auf privat und informiert den Trainer.
- Ein Zurücksetzen auf privat geschieht ohne Rückfrage. Andere Nutzer verlieren den Zugriff und sehen eine neutrale Meldung, die nicht verrät, ob das Training je existierte.
- Andere Nutzer können ein öffentliches Training ansehen, mobil durchführen und drucken; es gibt keine Kopier-Funktion und der Ersteller wird nirgends angezeigt.
- Die Vollständigkeitsprüfung zählt heute nur, ob eine Zuordnung existiert, nicht ob die referenzierte Übung noch sichtbar ist.
- Für die Unterblöcke Spielform zum Trainingsziel und Explosivität gibt es keine Bestandsübungen; sie sind nur über eigene Übungen befüllbar.
- PO-Entscheide 2026-08-16: Pflicht für die Veröffentlichung sind die drei Einstiegs-Unterblöcke, der Unterblock Spielformen und unterstützende Übungen sowie der Abschluss; der Spiel-Block ist als freies Spiel bewusst ausgenommen und behält nur den Hinweis. Offene Nacharbeit blockiert die Veröffentlichung. Belegt heisst: mindestens eine Zuordnung, wobei Nacharbeits-Zuordnungen nicht zählen. Eine separate Alterskategorie-Bedingung braucht der Junioren-Zweig nicht, weil ein Junioren-Training per Schema-Definition mindestens eine Junioren-Kategorie trägt.
- Die hohe Erst-Hürde (Spielform zum Trainingsziel und Explosivität sind nur über eigene Übungen befüllbar) ist bewusst gewählt: Ein öffentliches Junioren-Training soll lehrmittelkonform sein; privates Planen und Durchführen geht jederzeit ohne diese Bedingungen. Der Product Owner plant, die Hürde später durch geseedete Community-Übungen zu senken.

## Story 7 (Business): Junioren-Training veröffentlichen

Status: Final ausgearbeitet und validiert am 2026-08-16.

Als Trainer:in im Juniorenfussball
möchte ich mein Junioren-Training öffentlich teilen können, sobald es dem Trainingsschema entspricht
damit andere Trainer:innen nur vollständige und lehrmittelkonforme Junioren-Trainings vorfinden

Preconditions

1. Das Training folgt dem Juniorenschema und ist nach Trainingsteilen und Unterblöcken gegliedert

Acceptance Criteria

1. Der USER kann sein Junioren-Training öffentlich schalten, sobald die drei Einstiegs-Unterblöcke, der Unterblock Spielformen und unterstützende Übungen sowie der Abschluss belegt sind und keine Nacharbeit offen ist
2. Der USER kann sein Junioren-Training ohne Zuordnung im Spiel-Block veröffentlichen
3. Der USER erkennt vor dem Veröffentlichen, welche Bedingungen sein Training noch nicht erfüllt
4. Das SYSTEM zählt einen Unterblock als belegt, sobald ihm mindestens eine Zuordnung zugewiesen ist; Nacharbeits-Zuordnungen zählen nicht
5. Der USER kann sein veröffentlichtes Junioren-Training jederzeit wieder auf privat setzen

Postconditions

1. Das SYSTEM macht das Training für alle Betrachtenden sichtbar WENN der USER es öffentlich schaltet und alle Bedingungen erfüllt sind
2. Das SYSTEM veröffentlicht die im Training verwendeten eigenen privaten Übungen mit WENN der USER dies beim jeweiligen Veröffentlichen bestätigt hat
3. Das SYSTEM setzt ein veröffentlichtes Junioren-Training selbsttätig auf privat und informiert den USER WENN es eine der Bedingungen nicht mehr erfüllt

Out of Scope

1. Das SYSTEM ändert die Veröffentlichungsbedingungen für Kinderfussball-Trainings nicht
2. Das SYSTEM prüft beim Veröffentlichen nicht, ob die zugeordneten Übungen für andere Betrachtende sichtbar sind
3. Das SYSTEM benachrichtigt niemanden, wenn ein Training wieder auf privat gesetzt wird

Offene Fragen

1. @UX Designer: Wie erfährt der Trainer, welche Bedingung er wo im Editor erfüllen muss, wenn die Anzahl der Bedingungen im Juniorenschema deutlich höher ist als im Kinderfussball, und wie unterscheidet sich die Meldung bei offener Nacharbeit von den übrigen Bedingungen?
