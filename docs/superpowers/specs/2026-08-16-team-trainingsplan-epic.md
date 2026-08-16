# Epic: Team-Trainingsplan — Trainings im Trainerteam teilen und terminieren

**Datum:** 2026-08-16
**Ebene:** Epic (Business) — mehrere Workflows, mehrere Rollen, mehrere Sprints
**Status:** Anforderungen mit dem Product Owner abgestimmt, perspektivenbasiertes Review durchlaufen; Stories noch nicht ausgearbeitet
**Reihenfolge:** Das Epic Übungsbibliothek (`2026-08-16-uebungsbibliothek-epic.md`) geht diesem Epic voraus; es beseitigt die Abhängigkeit geteilter Trainings von fremden Übungen und vereinfacht mehrere Stories dieses Epics.

## 1. Problem & Wert

Ein Trainerteam betreut eine Mannschaft gemeinsam. Beim FC Wyler sind es fünf Trainer für 33 Juniorinnen; an einem einzelnen Training sind zwei bis drei davon im Einsatz. Die Anwendung kennt heute jedoch nur den einzelnen Eigentümer eines Trainings: Wer ein Training mit den Kolleginnen und Kollegen teilen will, muss es öffentlich schalten und damit der gesamten Community zeigen. Datum und Mannschaft schreiben die Trainer behelfsmässig in den Trainingstitel, weil es weder ein Terminfeld noch eine Mannschafts-Zuordnung gibt. Die Abfolge der Trainings über eine Saison hinweg existiert nirgends — sie steckt in Titel-Konventionen und in den Köpfen der Beteiligten.

Das kostet die Trainer doppelt: Sie geben Trainingsinhalte öffentlich preis, um sie intern zu teilen, und sie verlieren trotzdem den Überblick, welches Training wann und wo stattfindet.

Der Team-Trainingsplan löst beides. Ein Trainerteam bildet in der Anwendung ein Team, jedes Mitglied teilt seine Trainings mit diesem Team, alle Mitglieder bearbeiten sie gleichberechtigt, und die geteilten Trainings werden terminiert und erscheinen als chronologischer Trainingsplan. Dasselbe Training kann an mehreren Terminen angesetzt werden, ohne dass es ein zweites Mal erfasst wird.

Ein Training gehört dabei immer genau einer Person, nie dem Team. Das Teilen erweitert den Zugriff, es verschiebt nicht die Verantwortung — passend dazu, dass hinter einer J+S-Planung stets eine benannte Leiterin oder ein benannter Leiter steht.

Damit wird die Anwendung erstmals von einem Einzelplatz-Werkzeug zu einem Werkzeug für ein Trainerkollegium — der Weg, auf dem Amateurvereine tatsächlich arbeiten.

## 2. Stakeholder & Personas

- **Trainer im Trainerteam** — plant Trainings für eine Mannschaft gemeinsam mit zwei bis vier weiteren Trainern, terminiert sie und ruft sie am Spielfeldrand ab. Will Inhalte intern teilen, ohne sie zu veröffentlichen, und den Saisonverlauf überblicken.
- **Trainer ohne Team** — nutzt die Anwendung allein wie bisher. Darf durch die Erweiterung nicht eingeschränkt werden.
- **Anonymer Besucher** — sieht öffentlich geteilte Trainings und künftig auch deren Urheber.
- **Product Owner** — verantwortet, dass das Teilen im Team das bestehende Eigentümer- und Sichtbarkeitsmodell nicht aufweicht und dass keine personenbezogenen Daten von Kindern in die Anwendung gelangen.

## 3. Epic-Beschreibung

Als Trainer in einem Trainerteam
will ich meine Trainings mit meinen Trainerkollegen teilen, sie gemeinsam bearbeiten und als chronologischen Trainingsplan mit Datum, Zeit und Ort führen
damit wir Trainings intern austauschen können, ohne sie zu veröffentlichen, und jederzeit sehen, was wann und wo trainiert wird.

## 4. Preconditions

1. Die Anwendung hat echte Nutzer, deren bestehende Trainings und Übungen die Erweiterung unverändert überstehen müssen.
2. Die Authentifizierung mit E-Mail-Adresse ist im System vorhanden, sodass ein bereits registrierter Trainer über seine E-Mail-Adresse eingeladen werden kann.
3. Das Eigentümer- und Sichtbarkeitsmodell für Trainings mit den Stufen privat und öffentlich ist im System vorhanden.

## 5. Erfolgskriterien

1. Ein Training ist mit einem Team teilbar und danach für alle Mitglieder sichtbar und bearbeitbar, ohne öffentlich geschaltet zu werden.
2. Ein Training bleibt jederzeit genau einer Person zugeordnet, die dafür verantwortlich ist.
3. Ein Training ist mit mehreren Teams gleichzeitig teilbar.
4. Ein bereits registrierter Trainer wird über seine E-Mail-Adresse unmittelbar Mitglied eines Teams.
5. Jedes Mitglied eines Teams verfügt über dieselben Rechte, einschliesslich Umbenennen des Teams, Aufnehmen und Entfernen von Mitgliedern sowie Auflösen des Teams.
6. Das Veröffentlichen eines Trainings und jede Änderung, die es aus der Öffentlichkeit nehmen würde, bleiben seinem Eigentümer vorbehalten.
7. Ein Team ohne Mitglieder besteht nicht fort.
8. Jedes Mitglied ist für die übrigen an einem Namen erkennbar, auch wenn es selbst keinen gewählt hat.
9. Ein Trainer kann mehreren Teams angehören und erkennt jederzeit, für welches Team er gerade plant.
10. Der zeitliche Ablauf der Trainings eines Teams ist chronologisch erkennbar, ohne dass Datum oder Mannschaft im Trainingstitel stehen.
11. Ein Mitglied erkennt aus dem Trainingsplan, wann und wo ein Training stattfindet, ohne bei den Kollegen nachfragen zu müssen.
12. Dasselbe Training ist an mehreren Terminen ansetzbar, ohne es ein zweites Mal zu erfassen.
13. Vor einer Änderung an einem mehrfach angesetzten Training ist erkennbar, welche weiteren Termine die Änderung ebenfalls betrifft.
14. Ein einzelner Termin ist entfernbar, ohne das Training und seine übrigen Termine zu verändern.
15. Vor dem Aufheben einer Teilung und vor dem Löschen eines Trainings ist erkennbar, wie viele Termine dadurch entfallen, und beides erfordert eine Bestätigung.
16. Ein vergangener Termin bleibt im Trainingsplan erhalten und belegt, welches Training stattgefunden hat.
17. Ein fremdes öffentliches Training ist als eigenständige Fassung übernehmbar, die von späteren Änderungen am Ursprung unberührt bleibt.
18. Ein geteiltes Training ist zusätzlich öffentlich teilbar und bleibt dabei für die Mitglieder unverändert bearbeitbar.
19. Ein öffentliches Training ist seinem Urheber zuordenbar.
20. Die geteilten Trainings eines Teams bleiben für die übrigen Mitglieder vollständig nutzbar, wenn ein Mitglied austritt oder sein Konto löscht.
21. Wird ein Team aufgelöst, bleiben die geteilten Trainings bei ihren Eigentümern erhalten.
22. Ein Trainer unterscheidet in seiner Trainingsübersicht zwischen seinen eigenen und den mit ihm geteilten Trainings.
23. Ein Trainer ohne Team nutzt die Anwendung unverändert weiter.

## 6. Story-Zerlegung (SPIDR, vertikal)

Jede Story liefert End-to-End-Wert. Reihenfolge grob abhängigkeitssortiert.

1. **Enabler (Data) — Datenmodell für Team, Mitgliedschaft, Teilung und Trainingstermine:** Das Datenmodell trägt ein Team mit Namen, eine gleichberechtigte Mitgliedschaft mehrerer Nutzer, die Teilung eines Trainings mit einem oder mehreren Teams sowie datierte Trainingstermine. Der Zugriff ist serverseitig durchgesetzt; bestehende ungeteilte Trainings bleiben unverändert.
2. **Business (Data) — Anzeigename setzen:** Ein Trainer hinterlegt einen selbst gewählten Anzeigenamen; ohne eigene Wahl erhält er automatisch einen.
3. **Business (Paths) — Team erstellen, benennen und umbenennen:** Ein Trainer legt ein Team mit freiem Namen an und wird dessen erstes Mitglied; jedes Mitglied kann den Namen später ändern.
4. **Business (Paths) — Trainer ins Team aufnehmen:** Ein Mitglied nimmt einen registrierten Trainer über dessen E-Mail-Adresse auf; dieser sieht danach unmittelbar die geteilten Inhalte des Teams.
5. **Business (Rules) — Eigenes Training mit einem Team teilen und Teilung aufheben:** Ein Trainer gibt eines seiner Trainings für ein Team frei und nimmt die Freigabe wieder zurück, wobei er vorher erkennt, wie viele Termine dadurch entfallen.
6. **Business (Rules) — Geteilte Trainings gemeinsam bearbeiten:** Alle Mitglieder bearbeiten ein geteiltes Training gleichberechtigt, ohne dass es öffentlich ist; die Sichtbarkeit steuert allein der Eigentümer.
7. **Business (Data) — Training terminieren und Trainingsplan chronologisch sehen:** Ein Mitglied setzt ein geteiltes Training auf ein Datum und ergänzt wahlweise Beginn, Ort und Bemerkung; die Termine des Teams erscheinen chronologisch, vergangene wie künftige.
8. **Business (Rules) — Training an weiteren Terminen ansetzen:** Ein Mitglied setzt dasselbe Training zusätzlich an, ohne es zu duplizieren, und erkennt vor einer Änderung dessen Mehrfachverwendung.
9. **Business (Paths) — Einzelnen Termin entfernen:** Ein Mitglied entfernt einen ausgefallenen Termin, ohne das Training und die übrigen Termine anzutasten.
10. **Business (Rules) — Auswirkungen einer Löschung erkennen und bestätigen:** Ein Trainer sieht vor dem Löschen eines Trainings, wie viele Termine entfallen, und bestätigt ausdrücklich.
11. **Business (Paths) — Fremdes öffentliches Training als Kopie übernehmen:** Ein Trainer übernimmt ein Community-Training als eigenständige Fassung und teilt sie mit seinem Team.
12. **Business (Interface) — Eigene und geteilte Trainings getrennt auffinden:** Ein Trainer unterscheidet in seiner Übersicht zwischen Trainings, die ihm gehören, und solchen, die mit ihm geteilt sind.
13. **Business (Paths) — Team verlassen, Mitglied entfernen, Team auflösen:** Mitglieder verwalten die Zusammensetzung des Teams; die Trainings bleiben bei ihren Eigentümern, die Termine entfallen mit dem Team.
14. **Business (Rules) — Eigentum bei Konto-Löschung übertragen:** Löscht ein Trainer sein Konto, gehen seine geteilten Trainings samt der darin verwendeten privaten Übungen an ein verbleibendes Mitglied über und bleiben nutzbar.
15. **Business (Rules) — Urheber eines öffentlichen Trainings anzeigen:** Ein Besucher erkennt bei einem öffentlichen Training, von wem es stammt.

## 7. Non-Functional Requirements

1. Der Zugriff auf geteilte Trainings, Termine und Mitgliederlisten ist serverseitig durchgesetzt und nicht allein in der Oberfläche abgesichert.
2. Die E-Mail-Adresse eines Mitglieds ist für die übrigen Mitglieder nicht sichtbar.
3. Der Trainingsplan eines Teams lädt bei bis zu 100 Terminen in unter einer Sekunde.
4. Bestehende Trainings und Übungen bleiben nach der Erweiterung unverändert nutzbar, ohne dass ein Nutzer eingreifen muss.
5. Oberfläche und Inhalte sind auf Deutsch und auf mobilen Geräten wie am Desktop bedienbar.

## 8. Out of Scope

1. Die Anwendung hält nicht fest, welche Trainer an einem einzelnen Termin im Einsatz sind.
2. Die Anwendung speichert keine personenbezogenen Daten von Juniorinnen und Junioren, weder als Kader noch als Anwesenheit noch als Aufgebot.
3. Ein Trainingstermin ohne Team ist nicht vorgesehen.
4. Die Anwendung erzeugt keine Serientermine aus einem wiederkehrenden Trainingsrhythmus.
5. Die Anwendung erinnert nicht an bevorstehende Trainings und benachrichtigt nicht über Änderungen am Trainingsplan.
6. Ein Export der Termine in einen externen Kalender ist nicht enthalten.
7. Die Anwendung bildet keine Vereinsstruktur ab, unter der mehrere Teams zusammengefasst sind.
8. Abgestufte Rollen mit eingeschränkten Rechten innerhalb eines Teams sind nicht vorgesehen.
9. Ein Team ist nicht öffentlich auffindbar, und ein Beitritt aus eigenem Antrieb ist nicht möglich.
10. Die Aufnahme einer E-Mail-Adresse ohne bestehendes Konto ist nicht möglich.
11. Ein aufgenommener Trainer muss der Aufnahme nicht zustimmen; wer sie nicht will, verlässt das Team wieder.
12. Die Anwendung leitet aus dem Teamnamen keine Alterskategorie ab; Alterskategorien bleiben am einzelnen Training.
13. Die Anwendung führt kein Saison-Konzept; ein Team besteht über einen Kategoriewechsel der Mannschaft hinweg fort.
14. Die Anwendung schreibt bestehende Trainingstitel nicht um, wenn ein Training geteilt wird.
15. Die Anwendung erkennt nicht, wenn mehrere Mitglieder dasselbe Training gleichzeitig bearbeiten oder dessen Übungen gleichzeitig umsortieren; die zuletzt gespeicherte Fassung gilt.
16. Die Anwendung führt keine Historie darüber, wer ein geteiltes Training zuletzt geändert hat.

## 9. Getroffene Entscheide

| Thema | Entscheid | Datum |
|---|---|---|
| Ebene | Epic mit nachgelagerter Story-Zerlegung | 2026-08-16 |
| Begriff | Die Sammlung datierter Trainings eines Teams heisst „Team-Trainingsplan"; „Training" bleibt die einzelne Einheit | 2026-08-16 |
| Eigentum | Ein Training gehört immer einer Person; ein Team wird nie Eigentümer, sondern erhält Zugriff durch Teilen | 2026-08-16 |
| Rechte | Alle Mitglieder sind vollständig gleichberechtigt, einschliesslich Umbenennen, Aufnehmen, Entfernen und Auflösen des Teams | 2026-08-16 |
| Sichtbarkeit steuern | Veröffentlichen und jede Änderung, die ein Training aus der Öffentlichkeit nehmen würde, bleiben dem Eigentümer vorbehalten — die einzige Ausnahme von der Gleichberechtigung | 2026-08-16 |
| Aufnahme | Die Aufnahme wirkt sofort; es gibt keinen Einladungs-Zwischenzustand und keine Zustimmung des Aufgenommenen | 2026-08-16 |
| Teamname | Frei wählbar, nicht eindeutig, jederzeit durch jedes Mitglied änderbar | 2026-08-16 |
| Leeres Team | Ein Team wird aufgelöst, sobald es kein Mitglied mehr hat | 2026-08-16 |
| Termin-Pflichtfeld | Nur das Datum ist Pflicht; Beginn, Ort und Bemerkung sind freiwillig | 2026-08-16 |
| Teilung aufheben | Die abhängigen Termine entfallen, nach vorheriger Anzeige ihrer Anzahl | 2026-08-16 |
| Übertragung ohne Nachfolger | Steht kein verbleibendes Mitglied bereit, gilt das bisherige Verhalten: öffentlich anonymisiert, privat gelöscht | 2026-08-16 |
| Private Übungen | Sie gehen bei der Konto-Löschung zusammen mit dem geteilten Training an dasselbe Mitglied über | 2026-08-16 |
| Trainingsübersicht | Eigene und mit mir geteilte Trainings sind getrennt wählbar | 2026-08-16 |
| Wiederverwendung | Ein Training wird für mehrere Termine nicht dupliziert; die Mehrfachverwendung muss vor Änderungen sichtbar sein | 2026-08-16 |
| Mehrfachteilung | Ein Training ist gleichzeitig mit mehreren Teams teilbar | 2026-08-16 |
| Reihenfolge | Die Reihenfolge ergibt sich aus dem Datum; keine freie Sortierung | 2026-08-16 |
| Termin-Angaben | Ein Termin trägt Datum, Beginn, Ort als Freitext und eine Bemerkung | 2026-08-16 |
| Vergangenheit | Vergangene Termine sind erfassbar und bleiben erhalten, damit der Trainingsplan als J+S-Nachweis taugt | 2026-08-16 |
| Doppelbelegung | Mehrere Termine desselben Teams am selben Tag sind ohne Einschränkung erlaubt | 2026-08-16 |
| Beitritt | Einladung über die E-Mail-Adresse eines bereits registrierten Trainers | 2026-08-16 |
| Identität | Selbst gewählter Anzeigename am Konto; ohne eigene Wahl wird automatisch einer vergeben | 2026-08-16 |
| Öffentliche Urheberschaft | Der Anzeigename erscheint auch an öffentlichen Trainings; damit wird der Anzeigename zu einem öffentlich sichtbaren Personendatum | 2026-08-16 |
| Mehrfachzugehörigkeit | Ein Trainer kann mehreren Teams angehören | 2026-08-16 |
| Sichtbarkeit | Alles Geteilte ist für alle Mitglieder sichtbar und bearbeitbar; öffentlich schalten bleibt zusätzlich möglich | 2026-08-16 |
| Konto-Löschung | Geteilte Trainings gehen automatisch an ein verbleibendes Mitglied über, statt anonymisiert und eingefroren zu werden | 2026-08-16 |
| Team-Auflösung | Die Trainings bleiben bei ihren Eigentümern, die Termine des Teams entfallen | 2026-08-16 |
| Fremde Trainings | Übernahme ausschliesslich als Kopie; die Herkunft bleibt sichtbar (revidiert im Zuge des Übungsbibliothek-Epics, ursprünglich „ohne festgehaltene Herkunft") | 2026-08-16 |
| Gleichzeitiges Bearbeiten | Bewusst nicht behandelt; die zuletzt gespeicherte Fassung gilt | 2026-08-16 |
| Saison | Kein Saison-Konzept; das Team besteht dauerhaft, die Alterskategorie bleibt am Training | 2026-08-16 |
| Kinderdaten | Bleiben ausserhalb der Anwendung | 2026-08-16 |
| Bestand | Bestehende Behelfs-Trainings werden manuell geteilt und terminiert, Titel nicht automatisch bereinigt | 2026-08-16 |

## 10. Aufgehobene Abgrenzungen und geänderte Festlegungen

Dieses Epic hebt mehrere bewusst getroffene Abgrenzungen früherer Epics auf. Die Aufhebung ist beabsichtigt und am 2026-08-16 mit dem Product Owner abgestimmt.

Aus dem Epic Trainingsplaner (#8):
1. Out of Scope 3 „Eine Kalender- oder Terminplanung, die Pläne konkreten Trainingsterminen zuordnet, ist nicht enthalten" gilt nicht mehr.
2. Out of Scope 4 „Ein gezieltes Teilen mit einzelnen Trainern oder Teams über die Stufen öffentlich und privat hinaus ist nicht enthalten" gilt nicht mehr.
3. Erfolgskriterium 10 „Ein Trainer kann ausschliesslich seine eigenen Pläne bearbeiten" gilt nicht mehr für geteilte Trainings.
4. Erfolgskriterium 17, wonach öffentliche Pläne bei Konto-Löschung anonymisiert und unveränderlich erhalten bleiben, gilt nicht mehr für geteilte Trainings; diese werden übertragen.

Aus Story 1 Enabler (#9):
5. Acceptance Criterion 13 „schreibende Zugriffe ausschliesslich durch dessen Eigentümer" gilt nicht mehr für geteilte Trainings.

Aus Story 7 (#15) und Story 8 (#16):
6. Out of Scope „Eine Anzeige des Erstellers oder von Profildaten ist nicht enthalten" gilt nicht mehr; öffentliche Trainings zeigen künftig den Anzeigenamen des Urhebers.

Aus dem Juniorenfussball-Epic (Spec vom 2026-08-14):
7. Out of Scope „keine Trainingsgruppen-Organisation" gilt nicht mehr.

Aus der Architektur-Spec (2026-05-31):
8. Der Zugriffsgrundsatz „jeder bearbeitet nur eigene Inhalte" aus §3 gilt nicht mehr uneingeschränkt.
9. Das Verhalten der Konto-Löschung aus §9.4 ändert sich für geteilte Trainings von Anonymisieren zu Übertragen.

## 11. Offene Fragen

1. @Product Owner: Ist der Bedarf über den Fall FC Wyler hinaus validiert, oder trägt das Epic bisher einen Einzelfall?
2. @Product Owner: Bis zu welcher Anzahl Termine muss der Trainingsplan die Antwortzeit einhalten? Die genannten 100 sind eine Annahme.
3. @UX Designer: Wie erkennt ein Mitglied vor einer Änderung, dass ein Training an weiteren Terminen angesetzt ist, ohne dass der Hinweis bei jeder Bearbeitung stört?
4. @UX Designer: Wie wechselt ein Trainer zwischen mehreren Teams, ohne den Bezug zum aktuell bearbeiteten Team zu verlieren?
5. @UX Designer: Wie wird ein automatisch vergebener Anzeigename gebildet, damit er innerhalb eines Teams unterscheidbar bleibt?
