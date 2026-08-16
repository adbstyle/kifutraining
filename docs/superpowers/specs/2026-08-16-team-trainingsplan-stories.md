# Stories: Team-Trainingsplan

**Datum:** 2026-08-16
**Epic:** `2026-08-16-team-trainingsplan-epic.md`
**Status:** wächst Story für Story

---

## Story 1 (Enabler) — Datenmodell für Team, Mitgliedschaft, Teilung und Trainingstermine

Status: ausgearbeitet, perspektivenbasiertes Review durchlaufen

Datenmodell für Team, Mitgliedschaft, Teilung und Trainingstermine

Als Entwicklungsteam
möchte ich ein Datenmodell, das Teams mit gleichberechtigten Mitgliedern, die Teilung eines Trainings mit einem oder mehreren Teams und datierte Trainingstermine trägt
damit die Business-Stories des Team-Trainingsplans auf einer konsistenten und serverseitig abgesicherten Datengrundlage aufsetzen können

Preconditions
1. Die Anwendung wird produktiv genutzt, sodass bestehende Trainings, Übungen und Nutzerkonten von der Einführung unberührt bleiben müssen.
2. Ein Training trägt einen Eigentümer und eine Sichtbarkeit mit den Stufen privat und öffentlich.
3. Die Regel, dass ein öffentliches Training belegte Trainingsteile und mindestens eine Alterskategorie voraussetzt, ist im SYSTEM wirksam.

Acceptance Criteria
1. Das SYSTEM speichert ein Team mit einem frei wählbaren Namen und lässt gleichlautende Namen verschiedener Teams zu.
2. Das SYSTEM lässt den Namen eines Teams durch jedes seiner Mitglieder ändern.
3. Das SYSTEM führt zu jedem Team eine Mitgliedschaft mehrerer Trainer, die untereinander keine Rangfolge kennt.
4. Das SYSTEM nimmt einen bereits registrierten Trainer anhand seiner E-Mail-Adresse unmittelbar als Mitglied auf.
5. Das SYSTEM lässt einen Trainer gleichzeitig in mehreren Teams Mitglied sein.
6. Das SYSTEM löst ein Team auf, sobald es kein Mitglied mehr hat.
7. Das SYSTEM hält die Teilung eines Trainings mit einem Team als eigenen Zustand und lässt dasselbe Training gleichzeitig mit mehreren Teams teilen.
8. Das SYSTEM belässt den Eigentümer eines Trainings unverändert, wenn das Training geteilt wird.
9. Das SYSTEM gewährt jedem Mitglied eines Teams Lese- und Schreibrecht auf die mit diesem Team geteilten Trainings und deren Übungszuordnungen.
10. Das SYSTEM lässt ein Training ohne Eigentümer nicht teilen.
11. Das SYSTEM lässt das Umschalten der Sichtbarkeit eines Trainings ausschliesslich durch dessen Eigentümer zu.
12. Das SYSTEM lässt eine Änderung, die ein öffentliches Training auf privat zurückfallen liesse, ausschliesslich durch dessen Eigentümer zu.
13. Das SYSTEM speichert einen Trainingstermin, der ein Team mit einem daran geteilten Training verbindet und ein Datum trägt.
14. Das SYSTEM speichert zu einem Trainingstermin wahlweise einen Beginn, einen Ort und eine Bemerkung.
15. Das SYSTEM lässt mehrere Trainingstermine desselben Teams am selben Datum zu.
16. Das SYSTEM lässt dasselbe Training mehrfach terminieren, ohne dessen Inhalt zu vervielfachen.
17. Das SYSTEM lässt einen Trainingstermin mit einem Datum in der Vergangenheit zu.
18. Das SYSTEM behandelt Datum und Beginn eines Trainingstermins als die am Trainingsort geltende Zeit, unabhängig vom Standort des Betrachters.
19. Das SYSTEM ordnet die Trainingstermine eines Teams nach Datum und innerhalb desselben Datums nach Beginn, wobei Termine ohne Beginn zuletzt erscheinen.
20. Das SYSTEM ermittelt zu einem Training und zu einer Teilung die Anzahl der davon abhängigen Trainingstermine.

Postconditions
1. Das SYSTEM entfernt die abhängigen Trainingstermine und lässt das Training selbst unverändert, WENN die Teilung eines Trainings mit einem Team aufgehoben wird.
2. Das SYSTEM entfernt alle Teilungen und Trainingstermine eines Teams und belässt die betroffenen Trainings bei ihren Eigentümern, WENN das Team aufgelöst wird.
3. Das SYSTEM entfernt alle abhängigen Trainingstermine, WENN ein Training gelöscht wird.
4. Das SYSTEM überträgt die geteilten Trainings eines gelöschten Kontos samt der darin verwendeten privaten Übungen an ein verbleibendes Mitglied des jeweiligen Teams.
5. Das SYSTEM anonymisiert ein öffentliches und löscht ein privates Training eines gelöschten Kontos, WENN kein verbleibendes Mitglied für die Übertragung zur Verfügung steht.
6. Das SYSTEM hinterlässt nach einer abgebrochenen oder fehlgeschlagenen mehrstufigen Schreibaktion an Teams, Mitgliedschaften, Teilungen oder Trainingsterminen keinen teilweise veränderten Zustand.
7. Das SYSTEM hält bestehende Trainings, Übungen und Übungszuordnungen unverändert, WENN die neuen Strukturen eingeführt werden.

Out of Scope
1. Der Anzeigename eines Trainers ist nicht Teil dieses Enablers.
2. Die nutzerseitigen Abläufe und Oberflächen für Team, Mitgliedschaft, Teilung und Terminierung sind nicht Teil dieses Enablers.
3. Das SYSTEM führt keinen Zustand für eine ausgesprochene, noch nicht angenommene Aufnahme in ein Team.
4. Das SYSTEM erkennt nicht, wenn mehrere Mitglieder dasselbe Training gleichzeitig bearbeiten oder dessen Übungen gleichzeitig umsortieren.
5. Das SYSTEM führt keine Historie darüber, wer ein geteiltes Training zuletzt geändert hat.
6. Das SYSTEM benachrichtigt niemanden über Aufnahme, Entfernung, Teilung oder Änderungen an Trainingsterminen.
7. Das SYSTEM durchsucht Ort und Bemerkung eines Trainingstermins nicht über die Trainingssuche.
8. Das SYSTEM erzeugt keine Trainingstermine aus einem wiederkehrenden Rhythmus.
9. Das SYSTEM begrenzt die Anzahl Mitglieder eines Teams nicht.

Non-Functional Requirements
1. Die Zugriffsregeln für Teams, Mitgliedschaften, Teilungen und Trainingstermine sind serverseitig durchgesetzt und nicht allein in der Anwendungsschicht abgesichert.
2. Das Lesen der Trainingstermine eines Teams antwortet bei bis zu 100 Terminen in unter einer Sekunde.
3. Bestehende Trainings, Übungen und Nutzerkonten bleiben nach der Einführung ohne Zutun der Nutzer unverändert nutzbar.
4. Die E-Mail-Adresse eines Mitglieds ist für die übrigen Mitglieder nicht auslesbar.

Offene Fragen
1. @Product Owner: Bis zu welcher Anzahl Trainingstermine muss der Trainingsplan die Antwortzeit einhalten? Die genannten 100 sind eine Annahme.

Mögliche Lösungsansätze (Kontext, keine Empfehlung)
1. Für eine reine Zuordnungstabelle ohne eigene Attribute besteht bereits ein Vorbild in den Übungs-Favoriten; für eine Kind-Tabelle, die ihr Zugriffsrecht vom Elternobjekt erbt, in den Übungszuordnungen eines Trainings.
2. Jede bisherige Zugriffsprüfung ist strikt eigentümerbasiert; für „Mitglied einer Gruppe darf mitschreiben" besteht im Bestand kein Vorbild.
3. Der Editor eines Trainings beschränkt heute zusätzlich zur serverseitigen Regel auch im Lesezugriff auf den Eigentümer; eine Lockerung der Zugriffsregel allein genügt daher nicht, um Mitgliedern den Editor zu öffnen.
4. Die Konto-Löschung anonymisiert heute öffentliche und löscht private Inhalte; die Übertragung an ein verbleibendes Mitglied ist ein dritter Zweig, der dort noch nicht existiert.
5. Die allgemeine Trainings-Übersicht zeigt heute alles, was die Zugriffsregel sichtbar macht; eine Lockerung für Team-Mitglieder wirkt dort ohne weiteres Zutun mit und lässt privat geteilte Trainings in die Community-Ansicht rutschen.
6. Ein fachliches Datums- oder Zeitfeld existiert im Bestand nirgends; Zeitstempel sind ausschliesslich technische Metadaten.
