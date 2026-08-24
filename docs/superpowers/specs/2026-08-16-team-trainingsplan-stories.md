# Stories: Team-Trainingsplan

**Datum:** 2026-08-16
**Epic:** `2026-08-16-team-trainingsplan-epic.md`
**Status:** wächst Story für Story

---

## Story 1 (Enabler) — Datenmodell für Team, Mitgliedschaft, Team-Eigentum und Trainingstermine

Status: ausgearbeitet, revidiert 2026-08-24 (Kopie-Modell), perspektivenbasiertes Review durchlaufen

Datenmodell für Team, Mitgliedschaft, Team-Eigentum und Trainingstermine

Als Entwicklungsteam
möchte ich ein Datenmodell, das Teams mit gleichberechtigten Mitgliedern, Trainings im Eigentum einer Person oder eines Teams sowie datierte Trainingstermine trägt
damit die Business-Stories des Team-Trainingsplans auf einer konsistenten und serverseitig abgesicherten Datengrundlage aufsetzen können

Preconditions
1. Die Anwendung wird produktiv genutzt, sodass bestehende Trainings, Übungen und Nutzerkonten von der Einführung unberührt bleiben müssen.
2. Ein Training trägt heute einen persönlichen Eigentümer und eine Sichtbarkeit mit den Stufen privat und öffentlich.

Acceptance Criteria
1. Das SYSTEM speichert ein Team mit einem frei wählbaren Namen und lässt gleichlautende Namen verschiedener Teams zu.
2. Das SYSTEM lässt den Namen eines Teams durch jedes seiner Mitglieder ändern.
3. Das SYSTEM führt zu jedem Team eine Mitgliedschaft mehrerer Trainer, die untereinander keine Rangfolge kennt.
4. Das SYSTEM nimmt einen registrierten Trainer mit bestätigtem Konto anhand seiner E-Mail-Adresse unmittelbar als Mitglied auf.
5. Das SYSTEM lässt einen Trainer gleichzeitig in mehreren Teams Mitglied sein.
6. Das SYSTEM löst ein Team auf, sobald es kein Mitglied mehr hat.
7. Das SYSTEM ordnet jedes Training genau einem Eigentümer zu: einer Person oder einem Team.
8. Das SYSTEM gewährt jedem Mitglied eines Teams Lese- und Schreibrecht auf die Trainings dieses Teams und deren Übungs-Fassungen, einschliesslich des Ablegens, Ersetzens und Entfernens der zugehörigen Bild-Dateien.
9. Das SYSTEM führt Team-Trainings ohne öffentliche Sichtbarkeit; öffentlich sind ausschliesslich Vorlagen.
10. Das SYSTEM hält eine veröffentlichte Vorlage als eigenständiges Training und lässt sie in keinem Teil ändern; ihr Urheber kann sie als Ganzes durch eine neue Veröffentlichung ersetzen oder sie zurückziehen.
11. Das SYSTEM stempelt jeder Team-Kopie eine Herkunft aus dem Namen des Ursprungs-Trainings und dem Übernahmezeitpunkt, ohne Personenbezug.
12. Das SYSTEM speichert einen Trainingstermin, der ein Team-Training mit einem Datum verbindet.
13. Das SYSTEM speichert zu einem Trainingstermin wahlweise einen Beginn, einen Ort und eine Bemerkung.
14. Das SYSTEM lässt mehrere Trainingstermine desselben Teams am selben Datum zu.
15. Das SYSTEM verbindet jeden Trainingstermin mit genau einem Team-Training und hält je Team-Training höchstens einen Termin; das Ansetzen an einem weiteren Termin erzeugt eine eigene Kopie des Trainings.
16. Das SYSTEM lässt einen Trainingstermin mit einem Datum in der Vergangenheit zu.
17. Das SYSTEM behandelt Datum und Beginn eines Trainingstermins als die am Trainingsort geltende Zeit, unabhängig vom Standort des Betrachters.
18. Das SYSTEM ordnet die Trainingstermine eines Teams nach Datum und innerhalb desselben Datums nach Beginn, wobei Termine ohne Beginn zuletzt erscheinen.
19. Das SYSTEM ermittelt zu einem Team-Training, ob und welcher Termin daran hängt.
20. Das SYSTEM hält zu jedem persönlichen Training fest, welche aktuell veröffentlichte Vorlage aus ihm stammt; je Training gibt es höchstens eine.

Postconditions
1. Das SYSTEM entfernt den zugehörigen Trainingstermin, vergangen wie künftig, WENN ein Team-Training entfernt wird; andere Trainings bleiben unverändert.
2. Das SYSTEM entfernt alle Team-Trainings und Trainingstermine eines Teams, WENN das Team aufgelöst wird.
3. Das SYSTEM lässt Team-Trainings und deren Termine unberührt, WENN ein Mitglied das Team verlässt oder sein Konto löscht; persönliche Trainings folgen bei der Konto-Löschung dem bestehenden Verhalten (öffentliche Vorlagen anonymisiert, private gelöscht).
4. Das SYSTEM hinterlässt nach einer abgebrochenen oder fehlgeschlagenen mehrstufigen Schreibaktion an Teams, Mitgliedschaften, Trainings oder Trainingsterminen keinen teilweise veränderten Zustand.
5. Das SYSTEM hält bestehende Inhalte unverändert, WENN die neuen Strukturen eingeführt werden; bestehende öffentliche Trainings gelten fortan als eingefrorene Vorlagen und sind nicht mehr direkt bearbeitbar (bewusster Entscheid vom 2026-08-24; weiterarbeiten heisst: zurückziehen oder Kopie bearbeiten und neu veröffentlichen).

Out of Scope
1. Der Anzeigename eines Trainers ist nicht Teil dieses Enablers.
2. Die nutzerseitigen Abläufe und Oberflächen sind nicht Teil dieses Enablers.
3. Ein Teilen ohne Kopie — die Zugriffs-Erweiterung auf ein fremdes Training — ist nicht Teil des Modells.
4. Das SYSTEM führt keinen Zustand für eine ausgesprochene, noch nicht angenommene Aufnahme in ein Team.
5. Das SYSTEM erkennt nicht, wenn mehrere Mitglieder dasselbe Training gleichzeitig bearbeiten; die zuletzt gespeicherte Fassung gilt.
6. Das SYSTEM führt keine Historie darüber, wer ein Team-Training zuletzt geändert hat.
7. Das SYSTEM benachrichtigt niemanden über Aufnahme, Entfernung oder Änderungen an Trainingsterminen.
8. Das SYSTEM durchsucht Ort und Bemerkung eines Trainingstermins nicht über die Trainingssuche.
9. Das SYSTEM erzeugt keine Trainingstermine aus einem wiederkehrenden Rhythmus.
10. Das SYSTEM begrenzt die Anzahl Mitglieder eines Teams nicht.

Non-Functional Requirements
1. Die Zugriffsregeln für Teams, Mitgliedschaften, Trainings und Trainingstermine sind serverseitig durchgesetzt und nicht allein in der Anwendungsschicht abgesichert.
2. Das Lesen der Trainingstermine eines Teams antwortet bei bis zu 100 Terminen in unter einer Sekunde.
3. Bestehende Inhalte bleiben nach der Einführung ohne Zutun der Nutzer erhalten und sichtbar; die einzige Verhaltensänderung ist das Einfrieren bestehender öffentlicher Trainings als Vorlagen.
4. Die E-Mail-Adresse eines Mitglieds ist für die übrigen Mitglieder nicht auslesbar.

Offene Fragen
1. @Product Owner: Bis zu welcher Anzahl Trainingstermine muss der Team-Trainingsplan die Antwortzeit einhalten? Die genannten 100 sind eine Annahme.

Mögliche Lösungsansätze (Kontext, keine Empfehlung)
1. Für Kopien mit Herkunfts-Stempel und eigenen Bild-/Diagrammkopien besteht mit dem Fassungs-Modell der Übungsbibliothek ein vollständiges Vorbild.
2. Jede bisherige Zugriffsprüfung ist strikt personen-eigentümerbasiert; für «Mitglied eines Teams darf mitschreiben» besteht im Bestand kein Vorbild.
3. Ein fachliches Datums- oder Zeitfeld existiert im Bestand nirgends; Zeitstempel sind ausschliesslich technische Metadaten.

---

## Story 2 (Business, Data) — Anzeigename setzen

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Anzeigename setzen

Als Trainer
möchte ich einen Anzeigenamen führen, unter dem mich Team-Mitglieder und Besucher erkennen
damit ich in Teams und an meinen öffentlichen Trainings als Person erkennbar bin, ohne meine E-Mail-Adresse preiszugeben

Preconditions
1. Keine über die Anmeldung hinaus.

Acceptance Criteria
1. Der USER kann in seinem Konto einen Anzeigenamen wählen.
2. Der USER kann seinen Anzeigenamen jederzeit ändern.
3. Der USER sieht in seinem Konto, unter welchem Namen er derzeit für andere erscheint, auch wenn er selbst noch keinen gewählt hat.
4. Das SYSTEM vergibt jedem Konto ohne eigene Wahl automatisch einen neutralen, je Konto verschiedenen Anzeigenamen, der keine Rückschlüsse auf die E-Mail-Adresse zulässt.
5. Das SYSTEM lässt gleichlautende selbst gewählte Anzeigenamen zu, auch innerhalb desselben Teams.
6. Das SYSTEM nimmt Anzeigenamen von 1 bis 40 Zeichen an, ohne den Zeichensatz einzuschränken; Leerraum an den Rändern zählt nicht.
7. Das SYSTEM weist einen leeren Anzeigenamen ab; ein einmal gewählter Name lässt sich ändern, aber nicht entfernen.
8. Das SYSTEM zeigt anderen Personen, angemeldet oder nicht, ausschliesslich den Anzeigenamen, nie die E-Mail-Adresse.

Postconditions
1. Das SYSTEM zeigt an allen Stellen den aktuellen Anzeigenamen, WENN der USER ihn geändert hat, auch an bereits veröffentlichten Trainings.

Out of Scope
1. Der Anzeigename ist kein Anmeldename; die Anmeldung erfolgt weiterhin mit der E-Mail-Adresse.
2. Ein Profilbild oder weitere Profilangaben sind nicht Teil dieser Story.
3. Das SYSTEM prüft den Anzeigenamen nicht auf Echtheit oder Angemessenheit; eine Klarnamens-Pflicht besteht nicht. Der offizielle J+S-Nachweis über Leiterpersonen läuft ausserhalb der Anwendung.
4. Die Anzeigeflächen des Namens (Mitgliederlisten, Urheber-Angabe an öffentlichen Trainings) entstehen mit späteren Stories; diese Story liefert das Führen des Namens und die Namensregeln.
5. Eine Historie früherer Anzeigenamen wird nicht geführt; eine Änderung wirkt rückwirkend und spurlos.

Non-Functional Requirements
1. Der automatisch vergebene Anzeigename lässt keine Rückschlüsse auf die E-Mail-Adresse zu.

Offene Fragen
Keine.

---

## Story 3 (Business, Paths) — Team erstellen, benennen und umbenennen

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Team erstellen, benennen und umbenennen

Als Trainer eines Trainerteams
möchte ich unser Trainerteam in der Anwendung als Team anlegen und benennen
damit wir einen gemeinsamen Ort haben, an dem wir Trainings teilen und terminieren können

Preconditions
1. Das SYSTEM trägt Teams mit gleichberechtigter Mitgliedschaft (Datenmodell-Enabler ist wirksam).

Acceptance Criteria
1. Der USER kann ein Team anlegen und dabei einen Namen vergeben; der Name ist die einzige Angabe eines Teams.
2. Der USER ist nach dem Anlegen das erste und einzige Mitglied des Teams.
3. Der USER kann die Teams, denen er angehört, jederzeit einsehen.
4. Der USER kann den Namen jedes Teams ändern, dem er angehört.
5. Das SYSTEM nimmt Teamnamen von 1 bis 60 Zeichen an, ohne den Zeichensatz einzuschränken; Leerraum an den Rändern zählt nicht.
6. Das SYSTEM weist einen leeren oder nur aus Leerraum bestehenden Teamnamen ab.
7. Das SYSTEM lässt gleichlautende Namen zu, auch unter Teams desselben Trainers; die Unterscheidung liegt beim Team selbst.
8. Das SYSTEM macht ein Team ausschliesslich seinen Mitgliedern zugänglich.

Postconditions
1. Das SYSTEM zeigt allen Mitgliedern den neuen Namen, WENN ein Mitglied das Team umbenannt hat; offene Ansichten anderer Mitglieder aktualisieren sich beim nächsten Laden.
2. Ein Team ohne Mitglied entsteht nicht, auch nicht bei einem abgebrochenen oder fehlgeschlagenen Anlege-Vorgang.

Out of Scope
1. Das Aufnehmen weiterer Mitglieder ist Gegenstand von Story 4; Verlassen, Entfernen und Auflösen sind Gegenstand von Story 13.
2. Ein Team trägt keine Alterskategorie, keine Saison und keine Vereinszuordnung; solche Angaben leitet das SYSTEM auch nicht aus dem Namen ab. Ein Team besteht über Saison- und Kategorienwechsel hinweg fort und wird nicht pro Saison neu angelegt.
3. Ein Team ist nicht öffentlich auffindbar; es gibt keinen Beitritt aus eigenem Antrieb.
4. Eine Obergrenze für die Anzahl Teams eines Trainers besteht nicht.
5. Das SYSTEM prüft Teamnamen nicht auf Angemessenheit oder Namensrechte.
6. Eine Historie der Umbenennungen oder ihres Urhebers wird nicht geführt; gleichzeitige Umbenennungen behandelt das SYSTEM nicht gesondert, der zuletzt gespeicherte Name gilt.

Non-Functional Requirements
1. Die Zugänglichkeitsregel für Teams ist serverseitig durchgesetzt und nicht allein in der Oberfläche abgesichert.

Offene Fragen
Keine.

---

## Story 4 (Business, Paths) — Trainer ins Team aufnehmen

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Trainer ins Team aufnehmen

Als Mitglied eines Trainerteams
möchte ich meine Trainerkollegen über ihre E-Mail-Adresse ins Team aufnehmen
damit sie unmittelbar Zugriff auf die geteilten Inhalte des Teams erhalten und wir gemeinsam planen können

Preconditions
1. Der USER ist Mitglied des Teams.
2. Die aufzunehmende Person besitzt ein bestätigtes Konto in der Anwendung.
3. Jedes Konto führt einen Anzeigenamen, gewählt oder automatisch vergeben.

Acceptance Criteria
1. Der USER kann eine Person über deren E-Mail-Adresse suchen; Leerraum an den Rändern und Gross-/Kleinschreibung spielen keine Rolle.
2. Der USER sieht vor der Aufnahme den Anzeigenamen der gefundenen Person und bestätigt die Aufnahme; so erkennt er vorab, ob er die richtige Person getroffen hat.
3. Der USER sieht eine klare Rückmeldung, wenn unter der Adresse kein bestätigtes Konto besteht; ein unbestätigtes Konto ist davon nicht unterscheidbar.
4. Der USER sieht eine davon unterscheidbare Rückmeldung, wenn die Person bereits Mitglied ist; die eigene Adresse fällt unter diesen Fall.
5. Der USER kann die Mitglieder seines Teams mit ihren Anzeigenamen einsehen.
6. Das SYSTEM nimmt die Person nach der Bestätigung sofort und ohne deren Zustimmung auf; einen Einladungs-Zwischenzustand gibt es nicht.
7. Das SYSTEM zeigt den Mitgliedern eines Teams gegenseitig nie die E-Mail-Adresse, nur den Anzeigenamen.
8. Das SYSTEM erlaubt Suche und Aufnahme ausschliesslich Mitgliedern des Teams.

Postconditions
1. Das SYSTEM gewährt dem neuen Mitglied sofort denselben Zugriff wie allen übrigen Mitgliedern, WENN die Aufnahme bestätigt ist; es sieht die geteilten Trainings und Termine ohne weiteres Zutun.
2. Das SYSTEM zeigt das neue Mitglied allen Mitgliedern in der Mitgliederliste.
3. Das SYSTEM behandelt die gleichzeitige Aufnahme derselben Person durch zwei Mitglieder wie eine einmalige Aufnahme.

Out of Scope
1. Eine Aufnahme von E-Mail-Adressen ohne bestehendes bestätigtes Konto ist nicht möglich; es wird keine Einladungs-E-Mail versendet.
2. Eine Benachrichtigung der aufgenommenen Person erfolgt nicht (bewusster Epic-Entscheid); wer die Aufnahme nicht will, verlässt das Team wieder. Das Entfernen eines fälschlich aufgenommenen Mitglieds leistet Story 13.
3. Die Rückmeldung, ob eine E-Mail-Adresse registriert ist, ist eine bewusste, auf den Aufnahme-Fluss begrenzte Ausnahme von der sonst neutralen Auskunftslinie der Anwendung.
4. Rollen oder abgestufte Rechte gibt es nicht; jedes Mitglied ist gleichberechtigt und kann Mitglied mehrerer Teams sein.

Non-Functional Requirements
1. Die E-Mail-Adresse eines Mitglieds ist für die übrigen Mitglieder zu keinem Zeitpunkt auslesbar, auch nicht über technische Schnittstellen.
2. Wiederholte erfolglose Suchversuche desselben Kontos werden gebremst, damit sich registrierte Adressen nicht systematisch durchprobieren lassen.

Offene Fragen
Keine.

---

## Story 5 (Business, Paths) — Training ins Team stellen und Team-Training entfernen

Status: ausgearbeitet, revidiert 2026-08-24 (Kopie-Modell), perspektivenbasiertes Review durchlaufen

Training ins Team stellen und Team-Training entfernen

Als Trainer in einem Trainerteam
möchte ich Trainings ins Team stellen und nicht mehr passende Team-Trainings entfernen
damit wir intern mit den passenden Trainings planen können, ohne sie zu veröffentlichen

Preconditions
1. Der USER ist Mitglied mindestens eines Teams.
2. Das SYSTEM trägt Trainings im Eigentum einer Person oder eines Teams (Datenmodell-Enabler ist wirksam).

Acceptance Criteria
1. Der USER kann jedes seiner persönlichen Trainings in jedes seiner Teams stellen; dabei entsteht eine eigenständige Kopie, die dem Team gehört. Auch unvollständige Entwürfe lassen sich stellen.
2. Der USER kann dasselbe Training in mehrere Teams und mehrfach ins selbe Team stellen; jedes Stellen erzeugt eine weitere, unabhängige Kopie.
3. Der USER kann in jedem seiner Teams ein Training direkt neu erstellen; es gehört von Beginn an diesem Team.
4. Der USER sieht vor dem Entfernen eines Team-Trainings, ob und welcher Termin dadurch entfällt, auch ein vergangener.
5. Der USER muss das Entfernen ausdrücklich bestätigen.
6. Der USER erkennt an einem Team-Training, worauf es basiert und seit wann es im Team ist.
7. Das SYSTEM erzeugt die Team-Kopie vollständig eigenständig, einschliesslich der Übungs-Fassungen mit eigenen Bild- und Diagrammkopien; spätere Änderungen wirken in keine Richtung zwischen Original und Kopie.
8. Das SYSTEM belässt das persönliche Original beim Stellen und beim Entfernen unverändert bei seinem Eigentümer.
9. Der USER kann jedes Team-Training als persönliche Kopie zu sich übernehmen; die Kopie gehört ihm, das Team-Training bleibt unverändert.

Postconditions
1. Das SYSTEM macht die Team-Kopie sofort allen Mitgliedern sichtbar und bearbeitbar, WENN sie ins Team gestellt ist.
2. Das SYSTEM entfernt das Team-Training samt seinem Termin, WENN ein Mitglied das Entfernen bestätigt hat; andere Team-Trainings und das persönliche Original bleiben bestehen.

Out of Scope
1. Das gemeinsame Bearbeiten leistet Story 6, das Terminieren Story 7, die Übernahme öffentlicher Vorlagen Story 11, das Veröffentlichen als Vorlage Story 14.
2. Ein Teilen ohne Kopie — die Zugriffs-Erweiterung auf ein fremdes Training — gibt es nicht.
3. Ein Zusammenführen oder Synchronisieren von Original und Team-Kopie gibt es nicht; erneutes Stellen erzeugt eine zusätzliche Kopie, die alte bleibt bestehen.
4. Eine Vollständigkeitsprüfung beim Stellen gibt es nicht.
7. Ein Team-Training lässt sich nicht direkt veröffentlichen; Vorlagen entstehen ausschliesslich aus persönlichen Trainings (wer eine Team-Arbeit veröffentlichen will, übernimmt sie zuerst zu sich).
5. Eine Benachrichtigung der Mitglieder über neue oder entfernte Team-Trainings erfolgt nicht.
6. Vergangene Termine überleben das Entfernen ihres Team-Trainings nicht; der Trainingsplan taugt als Nachweis nur für bestehende Team-Trainings (bewusster Entscheid vom 2026-08-24; die ausdrückliche Bestätigung mit Termin-Anzahl schützt vor Versehen).

Non-Functional Requirements
1. Die Eigentums- und Zugriffs-Regeln sind serverseitig durchgesetzt und nicht allein in der Oberfläche abgesichert.
2. Das Stellen ins Team ist auch bei Trainings mit vielen Übungen und Bildern in wenigen Sekunden abgeschlossen.

Offene Fragen
Keine.

---

## Story 6 (Business, Rules) — Team-Trainings gemeinsam bearbeiten

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Team-Trainings gemeinsam bearbeiten

Als Trainer in einem Trainerteam
möchte ich die Trainings unseres Teams gleichberechtigt mit meinen Kollegen bearbeiten
damit wir sie gemeinsam weiterentwickeln, statt jede Änderung über eine einzelne Person laufen zu lassen

Preconditions
1. Der USER ist Mitglied des Teams, dem das Training gehört.

Acceptance Criteria
1. Der USER hat an jedem Training seiner Teams dieselben Bearbeitungsmöglichkeiten wie an einem persönlichen Training, namentlich Name, Stufen, Übungen übernehmen und entfernen, Fassungen samt Inhalt, Foto und Diagramm sowie Reihenfolge und Dauer.
2. Der USER erkennt beim Bearbeiten jederzeit, dass er an einem Team-Training arbeitet und welchem Team es gehört.
3. Das SYSTEM gewährt jedem Mitglied dieselben Bearbeitungsmöglichkeiten.
4. Das SYSTEM verwehrt Personen ausserhalb des Teams jeden Zugriff auf Team-Trainings.

Postconditions
1. Das SYSTEM zeigt jedem Mitglied spätestens beim nächsten Öffnen den neuen Stand, WENN ein anderes Mitglied gespeichert hat; ein sofortiges Mitverfolgen laufender Änderungen ist nicht zugesichert.

Out of Scope
1. Gleichzeitiges Bearbeiten wird nicht erkannt; je bearbeitetem Teil gilt die zuletzt gespeicherte Fassung. Ein Speichervorgang betrifft nur den bearbeiteten Teil, parallele Änderungen an anderen Teilen desselben Trainings gehen dadurch nicht verloren. Ein Hinweis auf zwischenzeitliche Änderungen anderer erfolgt nicht.
2. Eine Historie, wer was geändert hat, wird nicht geführt.
3. Persönliche Trainings anderer Mitglieder bleiben unzugänglich; gemeinsam bearbeitet wird ausschliesslich Team-Eigentum.
4. Die Herkunftsangabe eines Team-Trainings ist keine Bearbeitungsmöglichkeit; sie bleibt unveränderlich.
5. Rollen oder Vorbehaltsbereiche gibt es bewusst nicht (Epic-Entscheid Gleichberechtigung); auch eine Cheftrainer-Sonderstellung bildet die Anwendung nicht ab.
6. Verliert ein Mitglied während einer offenen Bearbeitung die Mitgliedschaft, lehnt das SYSTEM den nächsten Speicherversuch ab; eine besondere Behandlung offener Sitzungen gibt es nicht.
7. Das Veröffentlichen einer Vorlage aus einem Team-Training leistet Story 14, das Entfernen aus dem Team Story 5, das Terminieren Story 7.

Non-Functional Requirements
1. Die Zugriffs-Regeln sind serverseitig durchgesetzt und nicht allein in der Oberfläche abgesichert.
2. Das Ersetzen von Fotos durch verschiedene Mitglieder hinterlässt keine verwaisten Bild-Dateien.

Offene Fragen
Keine.

---

## Story 7 (Business, Data) — Training terminieren und Team-Trainingsplan chronologisch sehen

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Training terminieren und Team-Trainingsplan chronologisch sehen

Als Trainer in einem Trainerteam
möchte ich unsere Team-Trainings auf Termine legen und den Team-Trainingsplan chronologisch sehen
damit jederzeit klar ist, was wann und wo trainiert wird, ohne dass Datum und Ort im Trainingstitel stehen

Preconditions
1. Der USER ist Mitglied des Teams.
2. Das Team besitzt mindestens ein Team-Training.

Acceptance Criteria
1. Der USER kann jedes noch nicht angesetzte Team-Training seines Teams auf ein Datum ansetzen; das Datum ist die einzige Pflichtangabe.
2. Der USER kann zu einem Termin wahlweise einen Beginn, einen Ort und eine Bemerkung erfassen.
3. Der USER kann alle Angaben eines Termins nachträglich ändern.
4. Der USER kann Termine mit einem Datum in der Vergangenheit erfassen.
5. Der USER sieht je Team dessen Termine als chronologisch aufsteigenden Team-Trainingsplan, vergangene wie künftige; auch ein noch terminloser Plan ist zugänglich.
6. Der USER erkennt an jedem Termin das angesetzte Training und gelangt von dort zu dessen Ansicht und Durchführung.
7. Der USER sieht bei der Durchführung eines Trainings die Angaben des betreffenden Termins, wenn er es über einen Termin geöffnet hat; öffnet er das Training ohne Termin-Bezug, bleibt die Ansicht termin-los.
8. Der USER unterscheidet im Team-Trainingsplan vergangene von künftigen Terminen; als vergangen gilt ein Termin, sobald sein Datum vor dem heutigen Tag liegt.
9. Das SYSTEM ordnet die Termine nach Datum, innerhalb desselben Datums nach Beginn (ohne Beginn zuletzt); bei gleichen Angaben bleibt die Reihenfolge stabil.
10. Das SYSTEM lässt mehrere Termine des Teams am selben Datum zu.

Postconditions
1. Das SYSTEM zeigt jedem Mitglied spätestens beim nächsten Öffnen des Team-Trainingsplans den neuen oder geänderten Termin, WENN ein Mitglied ihn gespeichert hat.

Out of Scope
1. Das Ansetzen an weiteren Terminen (mit automatischer Kopie) behandelt Story 8, das Entfernen eines Termins Story 9, das Entfernen eines Team-Trainings samt Termin Story 5.
2. Serientermine aus einem wiederkehrenden Rhythmus gibt es nicht (bewusster Epic-Entscheid; der feste Wochenrhythmus wird je Termin einzeln erfasst).
3. Einen Abgesagt-Zustand gibt es nicht; Ausfälle werden in der Bemerkung festgehalten oder der Termin wird entfernt (bewusster Entscheid vom 2026-08-24).
4. Erinnerungen, Benachrichtigungen und Kalender-Export gibt es nicht.
5. Die Trainingssuche durchsucht Ort und Bemerkung eines Termins nicht.
6. Termine für persönliche Trainings gibt es nicht; terminiert wird ausschliesslich im Team.
7. Wer an einem Termin im Einsatz ist und ob er tatsächlich stattgefunden hat, hält die Anwendung nicht fest; eine Dauer trägt ein Termin nicht.

Non-Functional Requirements
1. Der Team-Trainingsplan lädt bei bis zu 100 Terminen in unter einer Sekunde.
2. Der Team-Trainingsplan ist auf mobilen Geräten wie am Desktop bedienbar.

Offene Fragen
Keine.

---

## Story 8 (Business, Rules) — Training an weiteren Terminen ansetzen

Status: ausgearbeitet, revidiert 2026-08-24 (je Termin eine Kopie), perspektivenbasiertes Review durchlaufen

Training an weiteren Terminen ansetzen

Als Trainer in einem Trainerteam
möchte ich ein bereits angesetztes Training an einem weiteren Termin ansetzen, ohne dessen Inhalt neu zu erfassen
damit wiederkehrende Trainings schnell im Plan stehen und eine Änderung nie ungewollt andere Termine trifft

Preconditions
1. Der USER ist Mitglied des Teams.
2. Das Team besitzt ein bereits angesetztes Team-Training.

Acceptance Criteria
1. Der USER kann ein bereits angesetztes Team-Training an einem weiteren Termin ansetzen, ohne dessen Inhalt neu zu erfassen.
2. Der USER erhält Beginn, Ort und Bemerkung des bisherigen Termins als Vorschlag und kann sie ändern; das Datum wählt er neu.
3. Das SYSTEM legt automatisch eine eigene, vollständige Kopie des Trainings an und verbindet den neuen Termin mit ihr; jeder Termin trägt sein eigenes Training.
4. Der USER erkennt die Kopie als eigenständiges Team-Training; ihre Herkunftsangabe nennt den Ursprung, Zwischenkopien einer Kette erscheinen nicht.
5. Das SYSTEM lässt eine Änderung an einem dieser Trainings nie auf die anderen wirken.

Postconditions
1. Das SYSTEM erzeugt die Kopie vollständig eigenständig, einschliesslich der Übungs-Fassungen mit eigenen Bild- und Diagrammkopien, WENN der USER das Training erneut ansetzt; ein Fehlschlag hinterlässt weder einen teilweise angesetzten Termin noch ein unvollständiges Training.

Out of Scope
1. Ein Zusammenführen oder gleichzeitiges Ändern mehrerer solcher Kopien gibt es nicht; jede wird für sich bearbeitet (bewusste Folge des Kopie-Entscheids vom 2026-08-24; der Team-Bestand wächst je Termin um eine Kopie samt Bildern).
2. Serientermine gibt es weiterhin nicht; jedes erneute Ansetzen ist ein bewusster Einzelschritt — bei zwei Wochenterminen über eine Saison bewusst in Kauf genommene Wiederholung.
3. Gleichzeitige Ansetz-Aktionen werden nicht dedupliziert; jeder bestätigte Vorgang erzeugt seine Kopie.
4. Eine terminlos gewordene Kopie (ihr Termin wurde entfernt) wird über den Erst-Ansetzen-Weg erneut angesetzt (Story 7).

Non-Functional Requirements
1. Das erneute Ansetzen ist auch bei Trainings mit vielen Übungen und Bildern in unter zehn Sekunden abgeschlossen.

Offene Fragen
Keine.

## Story 9 (Business, Paths) — Einzelnen Termin entfernen

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Einzelnen Termin entfernen

Als Trainer in einem Trainerteam
möchte ich einen einzelnen Termin entfernen können
damit ein ausgefallenes oder falsch angesetztes Training aus dem Plan verschwindet, ohne das Training anzutasten

Preconditions
1. Der USER ist Mitglied des Teams, dem der Termin gehört.

Acceptance Criteria
1. Der USER kann jeden Termin seines Teams entfernen, vergangene wie künftige.
2. Der USER muss das Entfernen bestätigen; die Bestätigung ist für vergangene und künftige Termine gleich.
3. Das SYSTEM lässt das angesetzte Training und alle anderen Termine unverändert; das Training bleibt terminlos im Team.
4. Das SYSTEM behandelt das Bestätigen eines inzwischen schon entfernten Termins als erledigt, ohne Fehler.

Postconditions
1. Das SYSTEM entfernt ausschliesslich den bestätigten Termin; jedes Mitglied sieht den aktualisierten Team-Trainingsplan spätestens beim nächsten Öffnen.

Out of Scope
1. Einen Abgesagt-Zustand gibt es nicht; wer einen Ausfall dokumentieren will, nutzt die Bemerkung statt zu entfernen, und wer verschiebt, ändert den Termin (Story 7).
2. Ein Wiederherstellen entfernter Termine gibt es nicht.
3. Eine Benachrichtigung der Mitglieder erfolgt nicht.

Non-Functional Requirements
Keine über die epicweiten hinaus.

Offene Fragen
Keine.

---

## Story 11 (Business, Paths) — Öffentliche Trainings-Vorlage übernehmen

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Öffentliche Trainings-Vorlage übernehmen

Als Trainer
möchte ich eine öffentliche Trainings-Vorlage als eigene Kopie übernehmen — für mich oder direkt für eines meiner Teams
damit ich bewährte Trainings der Community nutzen kann, ohne sie neu zu erfassen

Preconditions
1. Eine öffentliche Trainings-Vorlage ist vorhanden.
2. Für die Übernahme in ein Team ist der USER Mitglied des Ziel-Teams.

Acceptance Criteria
1. Der USER kann jede öffentliche Vorlage als persönliches Training übernehmen; die Kopie gehört ihm.
2. Der USER kann jede öffentliche Vorlage direkt in eines seiner Teams übernehmen; die Kopie gehört dem Team. Jedes Mitglied darf das (Gleichberechtigung).
3. Der USER erkennt an der Kopie, worauf sie basiert und — sofern die Vorlage einen Urheber trägt — von wem sie stammt; anonymisierte Vorlagen erscheinen ohne Urheber-Angabe.
4. Das SYSTEM erzeugt die Kopie vollständig eigenständig, einschliesslich aller Angaben wie Stufen und Trainingsziel sowie der Übungs-Fassungen mit eigenen Bild- und Diagrammkopien; spätere Änderungen wirken in keine Richtung zwischen Vorlage und Kopie.
5. Das SYSTEM lässt die Vorlage und ihren Urheber unberührt.
6. Das SYSTEM erlaubt die Übernahme derselben Vorlage mehrfach.

Postconditions
1. Das SYSTEM legt die Kopie als privates persönliches Training bzw. als Team-Training an, WENN der USER die Übernahme ausgelöst hat; sie ist sofort bearbeitbar.
2. Das SYSTEM schliesst eine laufende Übernahme mit dem beim Auslösen gültigen Stand vollständig ab oder weist sie ganz ab, WENN die Vorlage währenddessen ersetzt oder zurückgezogen wird; eine Teilkopie entsteht nie.

Out of Scope
1. Eine Verknüpfung oder Aktualisierung zwischen Vorlage und Kopie gibt es nicht; wer den neuen Stand einer Vorlage will, übernimmt sie erneut.
2. Die Übernahme einzelner Übungen aus einer Vorlage leistet die bestehende Übungs-Übernahme.
3. Eine Bewertung oder Kommentierung von Vorlagen gibt es nicht.
4. Eine Stufen-Passungs-Prüfung zum Ziel-Team gibt es bei der Übernahme nicht; die bestehende Stufen-Abweichungs-Anzeige im Editor greift danach.

Non-Functional Requirements
1. Die Übernahme ist auch bei Vorlagen mit vielen Übungen und Bildern in unter zehn Sekunden abgeschlossen.

Offene Fragen
Keine.

## Story 12 (Business, Interface) — Vorlagen und persönliche Trainings auffinden; Team-Bestand im Team-Bereich

Status: ausgearbeitet, revidiert 2026-08-24 (Teams als eigener Bereich), perspektivenbasiertes Review durchlaufen

Vorlagen und persönliche Trainings auffinden; Team-Bestand im Team-Bereich

Als Trainer
möchte ich Vorlagen und meine persönlichen Trainings in der Übersicht gezielt finden und die Trainings meiner Teams an einem eigenen Ort
damit jede der drei Welten dort liegt, wo ich sie erwarte, statt in einer vermischten Liste

Preconditions
1. Keine; für Besucher ohne Anmeldung gilt Kriterium 3.

Acceptance Criteria
1. Der USER sieht in der Trainingsübersicht standardmässig die öffentlichen Vorlagen der Community.
2. Der USER kann die Übersicht auf seine persönlichen Trainings eingrenzen und erkennt an jedem Eintrag, ob es eine Vorlage oder ein persönliches Training ist.
3. Besucher ohne Anmeldung sehen ausschliesslich die öffentlichen Vorlagen.
4. Der USER findet die Trainings jedes seiner Teams in einem eigenen Team-Bereich je Team, getrennt von der allgemeinen Übersicht.
5. Das SYSTEM zeigt Team-Trainings und private persönliche Trainings nie in der Vorlagen-Ansicht.
6. Das SYSTEM kombiniert die Eingrenzung mit den bestehenden Filtern der Übersicht wie Suche und Stufen.

Postconditions
Keine über die Anzeige hinaus.

Out of Scope
1. Der Team-Trainingsplan (Termine) und der Team-Trainings-Bestand liegen im Team-Bereich (bewusster Entscheid 2026-08-24: Teams als eigener Navigationspunkt); die Trainingsübersicht zeigt keine Team-Trainings.
2. Eine teamübergreifende Sammelansicht aller Team-Trainings gibt es nicht.

Non-Functional Requirements
Keine über die epicweiten hinaus.

Offene Fragen
Keine.

## Story 13 (Business, Paths) — Team verlassen, Mitglied entfernen, Team auflösen

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Team verlassen, Mitglied entfernen, Team auflösen

Als Trainer in einem Trainerteam
möchte ich die Zusammensetzung unseres Teams verwalten und es bei Bedarf auflösen
damit das Team der tatsächlichen Trainergruppe entspricht und Verwaistes nicht bestehen bleibt

Preconditions
1. Der USER ist Mitglied des Teams.

Acceptance Criteria
1. Der USER kann das Team jederzeit verlassen.
2. Der USER kann jedes andere Mitglied aus dem Team entfernen.
3. Der USER kann das Team auflösen; vorher sieht er, wie viele Team-Trainings und Termine dadurch entfallen, und muss die Auflösung bestätigen.
4. Der USER muss jede Aktion, die das Team leeren würde, mit derselben Anzeige und Bestätigung wie eine Auflösung abschliessen; das SYSTEM prüft das im Moment der Ausführung.
5. Das SYSTEM belässt beim Verlassen, beim Entfernen und bei der Konto-Löschung eines Mitglieds alle Team-Trainings und Termine unverändert beim Team, solange Mitglieder verbleiben.
6. Das SYSTEM entzieht der verlassenden oder entfernten Person sofort jeden Zugriff auf das Team und seine Inhalte.

Postconditions
1. Das SYSTEM entfernt das Team samt allen Team-Trainings und Terminen, WENN ein Mitglied die Auflösung bestätigt hat; persönliche Trainings und veröffentlichte Vorlagen der Mitglieder bleiben unberührt.
2. Das SYSTEM löst ein Team ohne weitere Rückfrage auf, WENN das letzte Mitglied sein Konto löscht; der Konto-Lösch-Dialog nennt betroffene Teams nicht (bewusster Entscheid vom 2026-08-24).

Out of Scope
1. Eine Benachrichtigung verlassener, entfernter oder übriger Mitglieder erfolgt nicht; ein entferntes Mitglied verliert den Zugriff kommentarlos (bewusster Entscheid Gleichberechtigung).
2. Ein Wiederherstellen aufgelöster Teams gibt es nicht; wer Team-Trainings behalten will, übernimmt sie vor der Auflösung als persönliche Kopie (Story 5). Auch vergangene Termine entfallen mit der Auflösung.
3. Rollen gibt es nicht; jedes Mitglied kann jedes entfernen und das Team auflösen (bewusster Epic-Entscheid Gleichberechtigung).

Non-Functional Requirements
1. Die Zugriffs-Regeln sind serverseitig durchgesetzt; ein entferntes Mitglied kann auch über technische Schnittstellen nicht mehr zugreifen.

Offene Fragen
Keine.

## Story 14 (Business, Rules) — Training als Vorlage veröffentlichen, ersetzen und zurückziehen

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Training als Vorlage veröffentlichen, ersetzen und zurückziehen

Als Trainer
möchte ich ein persönliches Training als Vorlage in der Trainingsbibliothek veröffentlichen, sie später ersetzen oder zurückziehen
damit die Community von meinen Trainings profitieren kann, ohne dass meine Weiterarbeit die veröffentlichte Fassung verändert

Preconditions
1. Der USER besitzt ein persönliches Training mit mindestens einer Stufe sowie belegter Einleitung und belegtem Hauptteil (bestehende Vollständigkeitsregel).

Acceptance Criteria
1. Der USER kann ein persönliches Training veröffentlichen; dabei entsteht eine eigenständige, öffentliche Vorlagen-Kopie, und sein Training bleibt privat und frei bearbeitbar.
2. Der USER muss die Tragweite bei jedem Veröffentlichen bestätigen; die Bestätigung benennt auch, dass sein Anzeigename öffentlich sichtbar wird.
3. Der USER kann dasselbe Training erneut veröffentlichen und ersetzt damit dessen bestehende Vorlage; das Veröffentlichen eines anderen Trainings erzeugt eine weitere, eigene Vorlage.
4. Der USER kann eine eigene Vorlage zurückziehen; sie verschwindet aus der Trainingsbibliothek.
5. Das SYSTEM lässt eine Vorlage in keinem Teil ändern; auch ihr Urheber bearbeitet sie nicht direkt.
6. Das SYSTEM lässt Ersetzen und Zurückziehen ausschliesslich den Urheber der Vorlage zu.
7. Das SYSTEM verweigert das Veröffentlichen von Team-Trainings; wer eine Team-Arbeit veröffentlichen will, übernimmt sie zuerst als persönliche Kopie und erscheint dann allein als Urheber (bewusste Folge der Gleichberechtigung).

Postconditions
1. Das SYSTEM zeigt die Vorlage allen, auch nicht angemeldeten Besuchern, WENN sie veröffentlicht ist.
2. Das SYSTEM lässt bereits übernommene Kopien einer Vorlage unberührt, WENN die Vorlage ersetzt oder zurückgezogen wird; laufende Übernahmen schliessen mit dem beim Auslösen gültigen Stand ab oder werden ganz abgewiesen.

Out of Scope
1. Eine Versionierung oder Historie von Vorlagen gibt es nicht; Ersetzen tauscht die Vorlage als Ganzes.
2. Team-Vorlagen gibt es nicht; Vorlagen stammen immer von einer Person (bewusster Entscheid vom 2026-08-24).
3. Die bestehenden öffentlichen Trainings gelten seit der Modell-Umstellung als Vorlagen (Bestandsregel des Datenmodell-Enablers).
4. Die Vorlage eines gelöschten Kontos bleibt anonymisiert dauerhaft bestehen und ist weder ersetzbar noch zurückziehbar (bewusste Folge des bestehenden Anonymisierungs-Verhaltens).

Non-Functional Requirements
1. Das Veröffentlichen ist auch bei Trainings mit vielen Übungen und Bildern in unter zehn Sekunden abgeschlossen.

Offene Fragen
Keine.

## Story 15 (Business, Rules) — Urheber einer öffentlichen Vorlage anzeigen

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Urheber einer öffentlichen Vorlage anzeigen

Als Besucher der Trainingsbibliothek
möchte ich erkennen, von wem eine Vorlage stammt
damit ich einschätzen kann, wessen Arbeit ich übernehme

Preconditions
1. Eine öffentliche Trainings-Vorlage ist vorhanden.

Acceptance Criteria
1. Der USER sieht an jeder Vorlage den Anzeigenamen ihres Urhebers, in der Übersicht wie in der Detailansicht; das gilt auch für nicht angemeldete Besucher.
2. Der USER sieht stets den aktuellen Anzeigenamen; eine Namensänderung wirkt auch auf bestehende Vorlagen.
3. Das SYSTEM zeigt bei anonymisierten Vorlagen ohne Urheber keine Urheber-Angabe.
4. Das SYSTEM zeigt nie die E-Mail-Adresse des Urhebers.

Postconditions
Keine über die Anzeige hinaus.

Out of Scope
1. Ein öffentliches Profil oder eine Übersicht aller Vorlagen eines Urhebers gibt es nicht.
2. Urheber-Angaben an öffentlichen Übungs-Vorlagen sind nicht Teil dieser Story (bewusster Entscheid: nur Trainings-Vorlagen).

Non-Functional Requirements
Keine über die epicweiten hinaus.

Offene Fragen
Keine.
