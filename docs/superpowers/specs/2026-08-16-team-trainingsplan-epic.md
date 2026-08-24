# Epic: Team-Trainingsplan — Trainings im Trainerteam teilen und terminieren

**Datum:** 2026-08-16
**Ebene:** Epic (Business) — mehrere Workflows, mehrere Rollen, mehrere Sprints
**Status:** Anforderungen mit dem Product Owner abgestimmt, perspektivenbasiertes Review durchlaufen; Stories in Ausarbeitung. **Revision 2026-08-24 (§9/§10):** Kopie-Modell — Trainings gehören einer Person ODER einem Team, ins Team kommt eine Kopie, Veröffentlichen erzeugt eine eingefrorene Vorlagen-Kopie.
**Reihenfolge:** Das Epic Übungsbibliothek (`2026-08-16-uebungsbibliothek-epic.md`) geht diesem Epic voraus; es beseitigt die Abhängigkeit geteilter Trainings von fremden Übungen und vereinfacht mehrere Stories dieses Epics.

## 1. Problem & Wert

Ein Trainerteam betreut eine Mannschaft gemeinsam. Beim FC Wyler sind es fünf Trainer für 33 Juniorinnen; an einem einzelnen Training sind zwei bis drei davon im Einsatz. Die Anwendung kennt heute jedoch nur den einzelnen Eigentümer eines Trainings: Wer ein Training mit den Kolleginnen und Kollegen teilen will, muss es öffentlich schalten und damit der gesamten Community zeigen. Datum und Mannschaft schreiben die Trainer behelfsmässig in den Trainingstitel, weil es weder ein Terminfeld noch eine Mannschafts-Zuordnung gibt. Die Abfolge der Trainings über eine Saison hinweg existiert nirgends — sie steckt in Titel-Konventionen und in den Köpfen der Beteiligten.

Das kostet die Trainer doppelt: Sie geben Trainingsinhalte öffentlich preis, um sie intern zu teilen, und sie verlieren trotzdem den Überblick, welches Training wann und wo stattfindet.

Der Team-Trainingsplan löst beides. Ein Trainerteam bildet in der Anwendung ein Team, jedes Mitglied teilt seine Trainings mit diesem Team, alle Mitglieder bearbeiten sie gleichberechtigt, und die geteilten Trainings werden terminiert und erscheinen als chronologischer Trainingsplan. Dasselbe Training kann an mehreren Terminen angesetzt werden, ohne dass es ein zweites Mal erfasst wird.

Ein Training gehört dabei jederzeit genau einem Eigentümer — einer Person oder einem Team (revidiert 2026-08-24; ursprünglich «immer genau einer Person»). In den Team-Trainingsplan gelangt ein Training als eigenständige Kopie, die dem Team gehört; das persönliche Original bleibt unangetastet. Damit gilt durchgängig dasselbe Kopie-Paradigma wie in der Übungsbibliothek.

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

1. Ein Training lässt sich als Kopie in ein Team stellen und ist dort für alle Mitglieder sichtbar und bearbeitbar, ohne öffentlich zu sein.
2. Ein Training gehört jederzeit genau einem Eigentümer — einer Person oder einem Team.
3. Ein Training lässt sich in mehrere Teams stellen; jedes Team erhält seine eigene, unabhängige Kopie.
4. Ein bereits registrierter Trainer wird über seine E-Mail-Adresse unmittelbar Mitglied eines Teams.
5. Jedes Mitglied eines Teams verfügt über dieselben Rechte, einschliesslich Umbenennen des Teams, Aufnehmen und Entfernen von Mitgliedern sowie Auflösen des Teams.
6. Das Veröffentlichen erzeugt eine eingefrorene öffentliche Vorlagen-Kopie in der Trainingsbibliothek; nur ihr Urheber kann sie ersetzen oder zurückziehen. Persönliche und Team-Trainings sind nie selbst öffentlich.
7. Ein Team ohne Mitglieder besteht nicht fort.
8. Jedes Mitglied ist für die übrigen an einem Namen erkennbar, auch wenn es selbst keinen gewählt hat.
9. Ein Trainer kann mehreren Teams angehören und erkennt jederzeit, für welches Team er gerade plant.
10. Der zeitliche Ablauf der Trainings eines Teams ist chronologisch erkennbar, ohne dass Datum oder Mannschaft im Trainingstitel stehen.
11. Ein Mitglied erkennt aus dem Trainingsplan, wann und wo ein Training stattfindet, ohne bei den Kollegen nachfragen zu müssen.
12. Dasselbe Training ist an mehreren Terminen ansetzbar, ohne es ein zweites Mal zu erfassen; das SYSTEM legt dafür je Termin eine eigene Kopie an (revidiert 2026-08-24).
13. ENTFALLEN 2026-08-24: Da jeder Termin seine eigene Trainings-Kopie trägt, kann eine Änderung nie weitere Termine betreffen; ein Hinweis erübrigt sich konstruktiv.
14. Ein einzelner Termin ist entfernbar, ohne das Training und seine übrigen Termine zu verändern.
15. Vor dem Entfernen eines Team-Trainings ist erkennbar, wie viele Termine dadurch entfallen, und das Entfernen erfordert eine Bestätigung.
16. Ein vergangener Termin bleibt im Trainingsplan erhalten und belegt, welches Training stattgefunden hat, solange sein Team-Training im Team bleibt; das Entfernen eines Team-Trainings entfernt nach ausdrücklicher Bestätigung auch dessen vergangene Termine.
17. Ein fremdes öffentliches Training ist als eigenständige Fassung übernehmbar, die von späteren Änderungen am Ursprung unberührt bleibt.
18. Vorlagen entstehen ausschliesslich aus persönlichen Trainings; ein Team-Training wird dafür zuerst als persönliche Kopie übernommen (revidiert 2026-08-24 — Vorlagen kommen immer von einer Person).
19. Ein öffentliches Training ist seinem Urheber zuordenbar.
20. Die Trainings eines Teams bleiben für die übrigen Mitglieder vollständig nutzbar, wenn ein Mitglied austritt oder sein Konto löscht; sie gehören dem Team und wechseln nie den Eigentümer.
21. Wird ein Team aufgelöst, entfallen seine Team-Trainings samt Terminen; die Auflösung erfordert eine Bestätigung, die deren Anzahl nennt (entschieden 2026-08-24).
22. Ein Trainer unterscheidet in der Trainingsübersicht zwischen öffentlichen Vorlagen und seinen persönlichen Trainings; die Trainings seiner Teams findet er in einem eigenen Team-Bereich je Team.
23. Ein Trainer ohne Team nutzt die Anwendung unverändert weiter.

## 6. Story-Zerlegung (SPIDR, vertikal) — revidiert 2026-08-24

Jede Story liefert End-to-End-Wert. Reihenfolge grob abhängigkeitssortiert.

1. **Enabler (Data) — Datenmodell für Team, Mitgliedschaft, Team-Eigentum und Trainingstermine:** Teams mit gleichberechtigter Mitgliedschaft; ein Training gehört einer Person oder einem Team; datierte Trainingstermine an Team-Trainings. Zugriff serverseitig durchgesetzt; Bestand unverändert.
2. **Business (Data) — Anzeigename setzen** (unverändert, ausgearbeitet).
3. **Business (Paths) — Team erstellen, benennen und umbenennen** (unverändert, ausgearbeitet).
4. **Business (Paths) — Trainer ins Team aufnehmen** (unverändert, ausgearbeitet).
5. **Business (Paths) — Training ins Team stellen und Team-Training entfernen:** Ein Mitglied stellt ein Training als Team-Kopie ins Team (aus persönlichem Bestand oder direkt im Team erstellt) und entfernt Team-Trainings; vorher ist die Zahl der entfallenden Termine erkennbar.
6. **Business (Rules) — Team-Trainings gemeinsam bearbeiten:** Alle Mitglieder bearbeiten die Trainings ihres Teams gleichberechtigt und vollständig.
7. **Business (Data) — Training terminieren und Trainingsplan chronologisch sehen** (Termine an Team-Trainings).
8. **Business (Rules) — Training an weiteren Terminen ansetzen:** Das erneute Ansetzen erzeugt automatisch eine eigene Trainings-Kopie je Termin, ohne Neuerfassung.
9. **Business (Paths) — Einzelnen Termin entfernen** (unverändert).
10. **Entfallen (2026-08-24):** «Auswirkungen einer Löschung erkennen und bestätigen» ist in Story 5 aufgegangen (Entfernen eines Team-Trainings mit Termin-Anzahl und Bestätigung); persönliche Trainings tragen keine Termine.
11. **Business (Paths) — Öffentliche Trainings-Vorlage übernehmen:** Ein Trainer übernimmt eine Vorlage als Kopie — in seinen persönlichen Bestand oder direkt in ein Team.
12. **Business (Interface) — Vorlagen und persönliche Trainings auffinden; Team-Bestand im Team-Bereich.**
13. **Business (Paths) — Team verlassen, Mitglied entfernen, Team auflösen** (inkl. Entscheid, was mit Team-Trainings bei Auflösung geschieht).
14. **Business (Rules) — Training als Vorlage veröffentlichen, ersetzen und zurückziehen:** Aus einem persönlichen Training entsteht eine eingefrorene öffentliche Vorlagen-Kopie; Team-Trainings werden dafür zuerst zu sich übernommen.
15. **Business (Rules) — Urheber einer öffentlichen Vorlage anzeigen** (unverändert sinngemäss).

Die frühere Story «Eigentum bei Konto-Löschung übertragen» entfällt: Team-Trainings gehören dem Team und sind von einer Konto-Löschung konstruktiv unberührt; persönliche Trainings folgen dem bestehenden Verhalten (öffentliche Vorlagen anonymisiert, private gelöscht).

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
| Eigentum | REVIDIERT 2026-08-24: Ein Training gehört genau einem Eigentümer — einer Person oder einem Team. Ursprünglich: «immer einer Person, Team erhält Zugriff durch Teilen» | 2026-08-24 |
| Rechte | Alle Mitglieder sind vollständig gleichberechtigt, einschliesslich Umbenennen, Aufnehmen, Entfernen und Auflösen des Teams | 2026-08-16 |
| Sichtbarkeit steuern | REVIDIERT 2026-08-24: Persönliche und Team-Trainings sind nie selbst öffentlich; Veröffentlichen erzeugt eine eingefrorene Vorlagen-Kopie, die nur ihr Urheber ersetzt oder zurückzieht | 2026-08-24 |
| Aufnahme | Die Aufnahme wirkt sofort; es gibt keinen Einladungs-Zwischenzustand und keine Zustimmung des Aufgenommenen | 2026-08-16 |
| Teamname | Frei wählbar, nicht eindeutig, jederzeit durch jedes Mitglied änderbar | 2026-08-16 |
| Leeres Team | Ein Team wird aufgelöst, sobald es kein Mitglied mehr hat | 2026-08-16 |
| Termin-Pflichtfeld | Nur das Datum ist Pflicht; Beginn, Ort und Bemerkung sind freiwillig | 2026-08-16 |
| Team-Training entfernen | Ersetzt «Teilung aufheben»: Jedes Mitglied kann ein Team-Training entfernen; die abhängigen Termine entfallen, nach vorheriger Anzeige ihrer Anzahl. Das persönliche Original eines anderen bleibt unberührt | 2026-08-24 |
| Übertragung ohne Nachfolger | GEGENSTANDSLOS 2026-08-24: Es gibt keine Übertragung mehr; Team-Trainings gehören dem Team | 2026-08-24 |
| Private Übungen | GEGENSTANDSLOS 2026-08-24: bereits durch das Fassungs-Modell (Epic Übungsbibliothek) überholt; Trainings enthalten eigenständige Fassungen | 2026-08-24 |
| Trainingsübersicht | Persönliche, Team- und Vorlagen-Trainings sind getrennt wählbar | 2026-08-24 |
| Wiederverwendung | REVIDIERT 2026-08-24: Je Termin trägt das Team eine eigene Trainings-Kopie; das erneute Ansetzen erzeugt sie automatisch, ohne Neuerfassung. Eine Änderung wirkt dadurch nie auf andere Termine. Bewusste Folgen: der Team-Bestand wächst je Termin um eine Kopie (inkl. Bilder), und Sammel-Änderungen über mehrere Termine gibt es nicht | 2026-08-24 |
| Mehrfachteilung | REVIDIERT 2026-08-24: Je Team eine eigene, unabhängige Kopie; Änderungen synchronisieren nicht über Teams hinweg | 2026-08-24 |
| Reihenfolge | Die Reihenfolge ergibt sich aus dem Datum; keine freie Sortierung | 2026-08-16 |
| Termin-Angaben | Ein Termin trägt Datum, Beginn, Ort als Freitext und eine Bemerkung | 2026-08-16 |
| Vergangenheit | PRÄZISIERT 2026-08-24: Vergangene Termine sind erfassbar und bleiben erhalten, solange ihr Team-Training im Team bleibt; das Entfernen eines Team-Trainings entfernt nach ausdrücklicher Bestätigung auch vergangene Termine | 2026-08-24 |
| Doppelbelegung | Mehrere Termine desselben Teams am selben Tag sind ohne Einschränkung erlaubt | 2026-08-16 |
| Beitritt | Einladung über die E-Mail-Adresse eines bereits registrierten Trainers | 2026-08-16 |
| Identität | Selbst gewählter Anzeigename am Konto; ohne eigene Wahl wird automatisch einer vergeben | 2026-08-16 |
| Öffentliche Urheberschaft | Der Anzeigename erscheint auch an öffentlichen Trainings; damit wird der Anzeigename zu einem öffentlich sichtbaren Personendatum | 2026-08-16 |
| Mehrfachzugehörigkeit | Ein Trainer kann mehreren Teams angehören | 2026-08-16 |
| Sichtbarkeit | Team-Trainings sind für alle Mitglieder sichtbar und vollständig bearbeitbar; eine Vorlagen-Kopie lässt sich zusätzlich veröffentlichen | 2026-08-24 |
| Konto-Löschung | REVIDIERT 2026-08-24: Team-Trainings sind konstruktiv unberührt (sie gehören dem Team); persönliche folgen dem bestehenden Verhalten (öffentliche Vorlagen anonymisiert, private gelöscht) | 2026-08-24 |
| Team-Auflösung | Team-Trainings samt Terminen (auch vergangenen) entfallen; die Auflösung erfordert eine Bestätigung mit deren Anzahl. Die Konto-Löschung des letzten Mitglieds löst still auf, der Konto-Lösch-Dialog nennt Teams nicht | 2026-08-24 |
| Team-Kopie | «Ins Team stellen» erzeugt eine eigenständige Kopie, die dem Team gehört — kein Teilungs-Zustand, dasselbe Kopie-Paradigma wie in der Übungsbibliothek; Divergenz zwischen Original und Team-Kopie ist akzeptiert | 2026-08-24 |
| Vorlagen-Publish | Veröffentlichen legt eine inhaltlich eingefrorene öffentliche Kopie in der Trainingsbibliothek ab; Aktualisieren = erneut veröffentlichen (ersetzt), Zurückziehen entfernt die Vorlage | 2026-08-24 |
| Aufnahme-Vorschau | Vor der Aufnahme wird der Anzeigename der gefundenen Person gezeigt und bestätigt; erfolglose Suchversuche werden gebremst (Enumerations-Schutz) | 2026-08-24 |
| Team-Vorlagen | Vorlagen kommen immer von einer Person; Team-Trainings sind nicht direkt veröffentlichbar, jedes Mitglied kann ein Team-Training als persönliche Kopie zu sich übernehmen | 2026-08-24 |
| Absage | Einen Abgesagt-Zustand für Termine gibt es nicht; Ausfälle stehen in der Bemerkung oder der Termin wird entfernt | 2026-08-24 |
| Termin-Vorschlag | Beim erneuten Ansetzen sind Beginn, Ort und Bemerkung des bisherigen Termins vorgeschlagen; nur das Datum wird neu gewählt | 2026-08-24 |
| Navigation | Die Trainingsübersicht zeigt standardmässig die Vorlagen; persönliche Trainings sind eingrenzbar; die Trainings der Teams liegen in einem eigenen Team-Bereich je Team | 2026-08-24 |
| Vorlagen-Ersetzen | Je persönlichem Training höchstens eine aktive Vorlage; erneutes Veröffentlichen desselben Trainings ersetzt sie, ein anderes Training erzeugt eine weitere | 2026-08-24 |
| Fremde Trainings | Übernahme ausschliesslich als Kopie; die Herkunft bleibt sichtbar (revidiert im Zuge des Übungsbibliothek-Epics, ursprünglich „ohne festgehaltene Herkunft"). Nachtrag 2026-08-17: Das Trainingsziel (Junioren-Epic, Story 10) wird in die Kopie übernommen und ist dort unabhängig änderbar | 2026-08-16 |
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

### Eigene Revision (2026-08-24)

10. Der ursprüngliche Kernentscheid «Ein Training gehört immer genau einer Person, nie dem Team» ist aufgehoben; ebenso das Teilen-Modell (Zugriffs-Erweiterung ohne Kopie) und die Eigentums-Übertragung bei Konto-Löschung. Begründung: Die Story-Reviews zeigten strukturelle Reibungen des Teilen-Modells (einseitiges Aufheben ohne Benachrichtigung, Termin-Kaskade gegen den J+S-Nachweis, Sichtbarkeits-Konflikte beim gemeinsamen Bearbeiten öffentlicher Trainings); der PO entschied, durchgängig das Kopie-Paradigma der Übungsbibliothek anzuwenden.

## 11. Offene Fragen

1. @Product Owner: Ist der Bedarf über den Fall FC Wyler hinaus validiert, oder trägt das Epic bisher einen Einzelfall?
2. @Product Owner: Bis zu welcher Anzahl Termine muss der Trainingsplan die Antwortzeit einhalten? Die genannten 100 sind eine Annahme.
5. @UX Designer: Wie wechselt ein Trainer zwischen mehreren Teams, ohne den Bezug zum aktuell bearbeiteten Team zu verlieren?
