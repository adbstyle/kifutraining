# Training veröffentlichen: Umschalten statt Einfrieren

Stand 2026-08-26, berichtigt am 2026-08-26. Zwei Business-Stories. Sie lösen das
Vorlagen-Modell aus dem Team-Trainingsplan-Epic (Stories 12 und 14) ab.

Das abgelöste Modell ist in Produktion: die Migration lief am 2026-08-26 um
05:31 UTC, der Code ging mit demselben Release live. Es gibt dort also echte
Vorlagen-Paare und echte öffentliche Trainings. Der Umbau ist damit
forward-only und braucht eine Datenmigration — eine frühere Fassung dieses
Dokuments behauptete das Gegenteil, sie beruhte auf einem veralteten lokalen
Stand von `main`.

## Warum

Das Veröffentlichen erzeugt eine eingefrorene Kopie: Das persönliche Training
bleibt privat und bearbeitbar, daneben steht eine unveränderliche Vorlage.
Daraus folgen zwei Trennungen, die im Alltag stören — zwei Zeilen gleichen
Namens für den Urheber, und eine Trainingsübersicht, die eigene und öffentliche
Trainings in getrennte Ansichten zwingt. Die zweite ist der Auslöser dieses
Dokuments: sie wurde als Fehler gemeldet.

Die dokumentierte Hauptbegründung des Einfrierens vom 2026-08-24 —
Sichtbarkeitskonflikte beim gemeinsamen Bearbeiten öffentlicher Trainings —
bezog sich auf das Teilen-Modell, das mit demselben Entscheid abgeschafft wurde.
Sie ist mit ihrem Gegenstand entfallen; das Einfrieren blieb ohne sie stehen.
Diese Begründung trägt unabhängig davon, wo das Modell ausgerollt ist.

Der verbleibende Schutz ist zudem geringer als angenommen: Wer ein öffentliches
Training übernimmt, erhält ohnehin eine Kopie. Ungeschützt bleibt allein, wer
ein fremdes Training direkt durchführt oder druckt — derselbe Fall existiert bei
den Übungen und wird dort akzeptiert.

Was vom Kopie-Paradigma unbestritten richtig bleibt, ist das Fassungs-Modell
eine Ebene tiefer: Übungen werden beim Einbau ins Training kopiert. Das ist eine
Entscheidung über Übungen im Training, nicht über die Sichtbarkeit des Trainings
selbst; beide wurden am 2026-08-24 zusammen entschieden, hängen aber nicht
zusammen.

## Begriffe

Der Begriff „Vorlage" entfällt. Er bezeichnete die eingefrorene Kopie und wäre
ohne sie irreführend. Ein Training ist entweder ein Entwurf oder ein
öffentliches Training — sprachlich gleichgezogen mit den Übungen.

---

## Story A (Business, Rules) — Training veröffentlichen und zurückziehen

Status: UMGESETZT 2026-08-28 — ausgearbeitet, perspektivenbasiertes Review durchlaufen

Training veröffentlichen und zurückziehen

Als Trainer
möchte ich mein Training öffentlich schalten und jederzeit wieder auf Entwurf zurücknehmen
damit die Community jeweils meinen aktuellen Stand nutzen kann und ich bestimme, wann sie ihn überhaupt sieht

Preconditions
1. Das Training gehört dem USER persönlich.

Acceptance Criteria
1. Der USER kann sein Training öffentlich schalten.
2. Der USER muss das Veröffentlichen bestätigen; die Bestätigung benennt, dass sein Anzeigename öffentlich sichtbar wird.
3. Der USER kann sein öffentliches Training jederzeit auf Entwurf zurücknehmen.
4. Der USER kann sein Training auch im öffentlichen Zustand weiterbearbeiten, ohne es dafür zurückzunehmen.
5. Das SYSTEM verweigert das Veröffentlichen, solange das Training keine Alterskategorie, keine Übung in der Einleitung oder keine Übung im freien Spiel trägt, und benennt das Fehlende.
6. Das SYSTEM verweigert jede Änderung, die ein öffentliches Training unter diese Bedingungen bringen würde.
7. Der USER erfährt bei einer verweigerten Änderung, dass er das Training dafür zuerst auf Entwurf setzen muss.
8. Der USER erfährt beim Löschen eines öffentlichen Trainings, dass es damit auch aus dem öffentlichen Bestand verschwindet.
9. Das SYSTEM lässt ein Team-Training nicht öffentlich schalten.

Postconditions
1. Das SYSTEM zeigt das Training allen Besuchern, auch ohne Konto, WENN der USER es öffentlich geschaltet hat.
2. Das SYSTEM gibt jede spätere Änderung des USERs unmittelbar an alle weiter, die das Training sehen.
3. Das SYSTEM entzieht das Training ohne Inhaltsverlust der Öffentlichkeit WENN der USER es auf Entwurf zurücknimmt.
4. Das SYSTEM lässt Kopien unberührt, die andere USER bereits übernommen haben.
5. Das SYSTEM ergänzt jedes öffentliche Training ohne Übung im freien Spiel um die Manual-Übung des freien Spiels WENN die erweiterte Veröffentlichungsbedingung eingeführt wird.
6. Das SYSTEM überträgt die Sichtbarkeit auf das persönliche Original und entfernt die eingefrorene Kopie WENN das bisherige Vorlagen-Modell abgelöst wird.
7. Das SYSTEM behält den bisherigen Änderungszeitpunkt jedes betroffenen Trainings WENN es die Ablösung vornimmt.

Out of Scope
1. Das SYSTEM hält keine zweite, eingefrorene Fassung eines veröffentlichten Trainings vor.
2. Das SYSTEM benachrichtigt niemanden, wenn ein öffentliches Training geändert, zurückgezogen oder gelöscht wird.
3. Das SYSTEM führt keine Historie früherer öffentlicher Stände.
4. Das SYSTEM ändert das Verhalten bei Konto-Löschung nicht.

Non-Functional Requirements
1. Ein öffentliches Training ist zu keinem Zeitpunkt in einem Zustand sichtbar, der die Veröffentlichungsbedingungen verletzt, auch nicht kurzzeitig während einer Bearbeitung.
2. Die Veröffentlichungsbedingungen sind serverseitig durchgesetzt und nicht allein in der Oberfläche abgesichert.

Offene Fragen
Keine.

Anmerkungen
1. Die Bedingung „mindestens eine Übung im Hauptteil" entfällt als eigene Prüfung: Das freie Spiel liegt im Hauptteil, die neue Bedingung deckt sie zwingend ab.
2. Ein öffentliches Training enthält Übungs-Fassungen, deren Inhalt damit öffentlich lesbar wird — auch dann, wenn die Fassung aus einer noch privaten eigenen Bibliotheks-Übung entstanden ist. Die Bibliotheks-Übung selbst bleibt privat. Das ist ein bewusster Entscheid und braucht keinen gesonderten Hinweis: Wer ein Training veröffentlicht, veröffentlicht dessen Inhalt.
3. Team-Trainings bleiben nicht direkt veröffentlichbar, weil ein Team bewusst nicht öffentlich auffindbar ist. Wer eine Team-Arbeit veröffentlichen will, übernimmt sie zuerst in seinen persönlichen Bestand.
4. Beim Ablösen des Vorlagen-Modells kann das Original inhaltlich von seiner eingefrorenen Kopie abweichen — es durfte nach dem Veröffentlichen weiterbearbeitet werden. Dass die Community dabei auf den aktuellen Stand des Urhebers springt und der eingefrorene Stand verloren geht, ist ein bewusster Entscheid (PO, 2026-08-26) zugunsten eines Objekts je Training.
5. Die Bilddateien der entfernten Kopien bleiben im Ablagespeicher zurück. Verwaiste Dateien sind im Projekt bereits toleriert; sie aufzuräumen ist nicht Teil dieser Story.

---

## Story B (Business, Interface) — Öffentliche und eigene Trainings gemeinsam finden

Status: UMGESETZT 2026-08-28 — ausgearbeitet, perspektivenbasiertes Review durchlaufen

Öffentliche und eigene Trainings gemeinsam finden

Als Trainer
möchte ich in der Trainingsübersicht die öffentlichen Trainings der Community und meine eigenen zusammen sehen und bei Bedarf auf meine eingrenzen
damit ich meinen Bestand dort finde, wo ich ihn suche, statt zwischen zwei getrennten Listen zu wechseln

Preconditions
1. Ein Training ist ein einziger Datensatz, dessen Sichtbarkeit zwischen Entwurf und öffentlich umgeschaltet wird.

Acceptance Criteria
1. Der USER sieht in der Trainingsübersicht die öffentlichen Trainings der Community und seine eigenen gemeinsam.
2. Der USER kann die Übersicht auf seine eigenen Trainings eingrenzen.
3. Der USER erkennt an jedem Eintrag, ob es sein eigenes ist.
4. Der USER erkennt an jedem eigenen Eintrag, ob es ein Entwurf oder öffentlich ist.
5. Der USER kann sein eigenes Training direkt aus der Übersicht heraus bearbeiten.
6. Besucher ohne Anmeldung sehen ausschliesslich die öffentlichen Trainings.
7. Das SYSTEM kombiniert die Eingrenzung mit der Suche und dem Alterskategorie-Filter.
8. Das SYSTEM zeigt Team-Trainings in der Trainingsübersicht nicht.

Postconditions
Keine über die Anzeige hinaus.

Out of Scope
1. Der USER kann die Übersicht nicht auf fremde Trainings allein eingrenzen.
2. Das SYSTEM sortiert die gemeinsame Liste nicht nach Eigentum.

Non-Functional Requirements
1. Die Zugriffsregel ist serverseitig durchgesetzt; ein fremdes Training im Entwurfszustand erscheint unter keinen Umständen.
2. Die Übersicht antwortet bei gemeinsamer Anzeige beider Bestände so schnell wie bei der bisherigen getrennten.

Offene Fragen
Keine.

Anmerkungen
1. Dieses Verhalten entspricht dem, was der Übungsbestand durchgängig tut. Die Trainingsübersicht leistete es bis zum Team-Trainingsplan-Epic ebenfalls; die getrennten Ansichten kamen mit diesem Epic und sind seit dem Release vom 2026-08-26 in Produktion.

---

## Auswirkungen auf bestehende Anforderungen

Umgesetzte Stories werden nicht nachkorrigiert. Die folgenden Anforderungen aus
dem Team-Trainingsplan-Epic werden durch die beiden Stories oben abgelöst; ihr
dokumentierter Stand bleibt als erteilter Auftrag bestehen.

1. Story 12 (Vorlagen und persönliche Trainings auffinden) wird vollständig durch Story B abgelöst.
2. Story 14 (Training als Vorlage veröffentlichen, ersetzen und zurückziehen) wird vollständig durch Story A abgelöst; das Konzept „Ersetzen" entfällt ersatzlos.
3. Story 15 (Urheber einer öffentlichen Vorlage anzeigen) bleibt inhaltlich gültig und bezieht sich künftig auf öffentliche Trainings statt auf Vorlagen.
4. Die Epic-Erfolgskriterien zur Sichtbarkeitssteuerung und zum Vorlagen-Publish sind mit dem Umschalt-Modell neu zu fassen.
5. Die Produktdokumentation zu Trainings, zum Team-Bereich und zu Konto und Zugang beschreibt das Vorlagen-Modell und ist vor dem nächsten Produktions-Release nachzuführen.
6. Die Spiegelung der Produktionsdaten nach Staging ist gesperrt, solange `develop` den Spaltenabbau trägt und `main` nicht.
