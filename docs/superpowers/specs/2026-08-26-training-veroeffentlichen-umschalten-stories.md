# Training veröffentlichen: Umschalten statt Einfrieren

Stand 2026-08-26. Zwei Business-Stories. Sie lösen das Vorlagen-Modell aus dem
Team-Trainingsplan-Epic (Stories 12 und 14) ab, das auf `develop` liegt und nie
in Produktion war.

## Warum

Das Veröffentlichen erzeugte bisher eine eingefrorene Kopie: Das persönliche
Training blieb privat und bearbeitbar, daneben stand eine unveränderliche
Vorlage. Daraus folgten zwei Trennungen, die im Alltag stören — zwei Zeilen
gleichen Namens für den Urheber, und eine Trainingsübersicht, die eigene und
öffentliche Trainings in getrennte Ansichten zwang.

Die dokumentierte Hauptbegründung des Einfrierens vom 2026-08-24 —
Sichtbarkeitskonflikte beim gemeinsamen Bearbeiten öffentlicher Trainings —
bezog sich auf das Teilen-Modell, das mit demselben Entscheid abgeschafft wurde.
Sie ist mit ihrem Gegenstand entfallen; das Einfrieren blieb ohne sie stehen.

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

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

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
5. Das SYSTEM nimmt jedes öffentliche Training ohne Übung im freien Spiel einmalig auf Entwurf zurück WENN die erweiterte Veröffentlichungsbedingung eingeführt wird.

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

---

## Story B (Business, Interface) — Öffentliche und eigene Trainings gemeinsam finden

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

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
1. Dieses Verhalten entspricht dem, was die Trainingsübersicht in Produktion bereits leistet und was der Übungsbestand durchgängig tut. Die getrennten Ansichten sind erst mit dem Team-Trainingsplan-Epic auf `develop` entstanden.

---

## Auswirkungen auf bestehende Anforderungen

Umgesetzte Stories werden nicht nachkorrigiert. Die folgenden Anforderungen aus
dem Team-Trainingsplan-Epic werden durch die beiden Stories oben abgelöst; ihr
dokumentierter Stand bleibt als erteilter Auftrag bestehen.

1. Story 12 (Vorlagen und persönliche Trainings auffinden) wird vollständig durch Story B abgelöst.
2. Story 14 (Training als Vorlage veröffentlichen, ersetzen und zurückziehen) wird vollständig durch Story A abgelöst; das Konzept „Ersetzen" entfällt ersatzlos.
3. Story 15 (Urheber einer öffentlichen Vorlage anzeigen) bleibt inhaltlich gültig und bezieht sich künftig auf öffentliche Trainings statt auf Vorlagen.
4. Die Epic-Erfolgskriterien zur Sichtbarkeitssteuerung und zum Vorlagen-Publish sind mit dem Umschalt-Modell neu zu fassen.
5. Die Produktdokumentation zu Trainings beschreibt das Vorlagen-Modell und ist vor dem nächsten Produktions-Release nachzuführen.
