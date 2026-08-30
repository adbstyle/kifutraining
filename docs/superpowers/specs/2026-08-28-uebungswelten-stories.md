# Stories: Übungen nach Altersstufe trennen

Stand 2026-08-30. Story-Zerlegung zum Epic `2026-08-28-uebungswelten-epic.md`.
Requirements-Dokumentation, keine Architektur- oder Lösungsspezifikation.

## Im Refinement getroffene Entscheide

Diese Entscheide sind am 2026-08-30 mit dem Product Owner gefallen. Wo sie das Epic
oder das Vorgänger-Epic verändern, ist das vermerkt.

| Frage | Entscheid |
|---|---|
| Altersstufe eines Trainings | Wird beim Anlegen gewählt und steht danach fest. Die Alterskategorien sind auf die Werte dieser Altersstufe beschränkt und bestimmen die Altersstufe nicht mehr |
| Altersstufen-Wechsel eines Trainings | Wird gar nicht angeboten. Wer für die andere Altersstufe plant, legt ein neues Training an. Begründung: Übungsbestand, Trainingsteile und Gliederung sind verschieden, fachlich ist ohnehin nichts übernehmbar. Hebt Erfolgskriterium 6 des Epics auf |
| Nacharbeit, automatische Umordnung, Einordnungs-Konserve am Training | Werden ersatzlos zurückgebaut. Ohne Altersstufen-Wechsel haben sie keinen Anwendungsfall mehr |
| Altersstufen-Wechsel einer Übung | Wird überführt, nicht aufbewahrt. Die verlassene Altersstufe behält nichts; eine Rückkehr beginnt dort von vorn. Der Anwendungsfall ist die einmalige Korrektur, nicht das Hin und Her: Auf Produktion sind Übungen als Kategorie E erfasst, die fachlich zu D gehören und später von Hand richtiggestellt werden sollen. Hebt Erfolgskriterium 4 des Epics auf |
| Rückrichtung der Abbildungsregel | Aufwärmen und Spielform zum Trainingsziel werden zur Einleitung, Spielformen und unterstützende Übungen zu «Fussball spielen lernen», Spiel zu «Fussball spielen», Ausklang zu Ausklang. Explosivität hat keine Entsprechung, weil der Kinderfussball diesen Trainingsinhalt nicht kennt; dort wählt der Trainer selbst |
| Wechsel der Einordnung innerhalb einer Altersstufe | Bleibt wie heute: der Ablauftext wird überführt, die verlassene Form geleert. Nur der Wechsel der Altersstufe bewahrt auf |
| Ablaufbeschreibung im Juniorenfussball | Durchgängig ein zusammenhängender Beschreibungstext, in allen sechs Blöcken, und Pflicht. Der methodische Fahrplan bleibt dem Kinderfussball vorbehalten. Ändert das Verhalten der Blöcke Aufwärmen und Spielform zum Trainingsziel gegenüber dem Vorgänger-Epic. Am Manual belegt: die Wörter «offen starten», «üben» und «wetteifern» kommen im Manual Fussball Jugendliche kein einziges Mal vor; eine Trainingsform steht dort als unbeschrifteter Fliesstext neben dem Diagramm (S. 58–83) |
| Spielfeldgrösse | Eine Junioren-Übung trägt statt des Feldtyps eine Spielfeldgrösse. Das Manual führt sie zu praktisch jeder Trainingsform als eigene Angabe ausserhalb des Beschreibungstexts |
| Erscheinungsformen im Juniorenfussball | Alle sechs Blöcke dürfen sie tragen, der Ausklang eingeschlossen. Er ist im Manual mehr als das Ausklingen des Kinderfussballs: Cool-down, Mobilität und Austausch — und der Austausch trifft die Erscheinungsform «Positiv miteinander umgehen» |
| Übungstyp je Block | Nur in Blöcken, in denen eine Spielform vorkommen kann: Aufwärmen, Spielform zum Trainingsziel, Spielformen und unterstützende Übungen sowie Spiel. Explosivität und Ausklang tragen keinen, weil die Typologie des Manuals spielnahe taktische Trainingsformen gliedert |
| Übernahme in den eigenen Bestand | Eine kuratierte oder fremde Übung lässt sich direkt aus dem Katalog übernehmen. Bisher führte der einzige Weg über ein Training |
| Übungs-Picker | Filtert ausschliesslich auf die Altersstufe des Trainings, nicht zusätzlich auf den Zielblock |
| Junioren-Testdaten auf der Testumgebung | Dürfen verworfen werden. Damit entfällt jede Migrationsregel für Übungen mit Werten beider Altersstufen |
| Stufenfremde Altwerte an einer Übung | Wo eine Übung einen Wert der anderen Altersstufe trägt, wird er beim Umstellen entfernt, unabhängig davon ob die Übung sonst als Testdatum gilt. Auf Produktion gibt es solche Werte nicht; der Eingriff trifft ausschliesslich die Testumgebung |
| Benennung der Altersstufe in der Oberfläche | Wird dort eingeführt, wo die Wahl entsteht: in der Junioren-Story. Solange nur eine Altersstufe existiert, sagt das Formular nichts darüber |
| Kategorie FF12 | Reine Mädchenteams arbeiten mit der Alterskategorie E, wie FF-14-Teams mit D. Das Vokabular bleibt bei G, F und E |
| Hauptteilkategorie | Bleibt beim Kinderfussball, obwohl Abbildung 19 des Junioren-Manuals zwei der drei Begriffe wörtlich führt. Der Juniorenfussball gliedert seinen Hauptteil bereits in die Blöcke Spielformen und unterstützende Übungen sowie Spiel; eine zweite Gliederungsebene wäre doppelt |
| Release | Gemeinsam mit dem Juniorenfussball-Epic als Ganzes nach Produktion. Einzelne Stories erreichen die Nutzer nie |

## Ausgangslage

Produktion trägt keine einzige Junioren-Migration: Der dortige Bestand kennt weder die
Alterskategorien D bis A noch den Übungstyp noch einen Junioren-Trainingsteil. Der
Juniorenfussball liegt ausschliesslich auf der Testumgebung. Dieses Epic korrigiert ihn,
bevor er je auf Produktion erscheint.

Ein Teil dieses Produktionsbestands ist fachlich falsch eingeordnet: Es gibt Übungen mit
der Alterskategorie E, die zum Juniorenfussball gehören. Sie sollen von Hand
richtiggestellt werden können — das ist der Anwendungsfall der Überführungs-Story.

Die Trennung hat einen Preis, der dem Product Owner bewusst ist: Heute sind 71 der 75
Manual-Übungen über die Abbildungsregel in Junioren-Trainings verwendbar. Danach sind es
keine mehr. Ein Junioren-Trainer legt fünf eigene Übungen an, bevor er sein erstes
Training veröffentlichen kann. Der Entscheid dazu ist am 2026-08-30 bestätigt worden:
Das ist die natürliche Reihenfolge, kein Mangel.

## Story-Übersicht

| # | Story | SPIDR | Typ | Hängt ab von |
|---|---|---|---|---|
| 1 | Altersstufe als geführte Angabe an Übung und Training | Data | Enabler | — |
| 2 | Kinderfussball-Übung ohne Junioren-Begriffe erfassen | Rules | Business | 1 |
| 3 | Junioren-Übung nach dem eigenen Lehrmittel erfassen | Rules | Business | 1, 2 |
| 4 | Übung in die andere Altersstufe überführen | Paths | Business | 2, 3 |
| 5 | Training in einer Altersstufe anlegen, die lebenslang gilt | Rules | Business | 1 |
| 6 | Übungs-Picker auf die Altersstufe des Trainings beschränken | Rules | Business | 1, 5 |
| 7 | Kuratierte oder fremde Übung direkt in den eigenen Bestand übernehmen | Paths | Business | — |

---

## Story 1 (Enabler): Altersstufe als geführte Angabe an Übung und Training

Als Entwicklungsteam
möchte ich die Altersstufe als eigene Angabe an Übungen und Trainings führen
damit die Felder, Auswahlmöglichkeiten und Pflichtangaben der folgenden Stories sich auf
eine eindeutige Zugehörigkeit stützen können statt sie aus dem Trainingsteil zu erraten

### Preconditions

1. Beide Trainingsschemata sind im System abgebildet
2. Der Produktionsbestand kennt ausschliesslich Kinderfussball-Übungen und -Trainings
3. Die Junioren-Testdaten der Testumgebung dürfen verworfen werden

### Acceptance Criteria

1. Das SYSTEM führt an jeder Übung genau eine Altersstufe als eigene Angabe
2. Das SYSTEM führt an jedem Training genau eine Altersstufe als eigene Angabe
3. Das SYSTEM bestimmt die Altersstufe ausschliesslich aus dieser Angabe, nicht aus den Alterskategorien und nicht aus dem Trainingsteil
4. Das SYSTEM lässt an einer Übung ausschliesslich Alterskategorien ihrer Altersstufe zu
5. Das SYSTEM lässt an einer Übung ausschliesslich einen Trainingsteil ihrer Altersstufe zu
6. Das SYSTEM lässt an einem Training ausschliesslich Alterskategorien seiner Altersstufe zu
7. Das SYSTEM stuft jede Übung und jedes Training des bestehenden Bestands als Kinderfussball ein, unabhängig von Sichtbarkeit und Eigentum
8. Das SYSTEM legt eine neue Übung und ein neues Training als Kinderfussball an, solange der Trainer die Altersstufe nicht selbst wählen kann
9. Das SYSTEM setzt die Altersstufe und die zu ihr passenden Werte auch dann durch, wenn eine Änderung die Oberfläche umgeht
10. Das TEAM hat die Altersstufe in dieselbe kontrollierte Vokabularquelle aufgenommen, aus der die übrigen Attribute stammen

### Postconditions

1. Das SYSTEM hält jede bestehende Kinderfussball-Übung und jedes bestehende Kinderfussball-Training unverändert lesbar, bearbeitbar und veröffentlichbar
2. Das SYSTEM führt keine Übung und kein Training mehr, deren Alterskategorien oder deren Trainingsteil einer anderen als der eigenen Altersstufe angehören
3. Das SYSTEM stellt eine Übung und ein Training unverändert dar

### Out of Scope

1. Der Trainer wählt die Altersstufe noch nicht selbst
2. Die Oberfläche zeigt die Altersstufe einer Übung oder eines Trainings nicht an
3. Das SYSTEM bindet Feldtyp, Übungstyp, Hauptteilkategorie und Erscheinungsformen noch nicht an eine Altersstufe
4. Das SYSTEM ordnet die Felder des Übungs-Formulars nicht nach Lehrmittel und benennt sie nicht um

### Offene Fragen

Keine.

---

## Story 2: Kinderfussball-Übung ohne Junioren-Begriffe erfassen

Als Trainer:in im Kinderfussball
möchte ich beim Erfassen und Bearbeiten einer Übung nur die Felder und Werte des Manuals
Fussball Kinder vor mir haben
damit ich nicht bei jedem Feld neu entscheiden muss, was für meine Altersstufe überhaupt gilt

### Preconditions

1. Jede Übung trägt eine geführte Altersstufe
2. Der gesamte Übungsbestand gehört der Altersstufe Kinderfussball an

### Acceptance Criteria

1. Der USER sieht beim Erfassen und Bearbeiten einer Übung ausschliesslich die Trainingsteile des Manuals Fussball Kinder
2. Der USER sieht ausschliesslich die Alterskategorien des Kinderfussballs
3. Der USER sieht ausschliesslich die Erscheinungsformen des Manuals Fussball Kinder
4. Der USER sieht kein Feld für den Übungstyp
5. Der USER bearbeitet auch eine Übung innerhalb eines Trainings nach denselben Regeln

### Postconditions

1. Das SYSTEM speichert eine Übung ausschliesslich mit Werten des Manuals Fussball Kinder WENN der USER sie erfasst oder bearbeitet
2. Das SYSTEM führt an keiner Kinderfussball-Übung mehr einen Übungstyp
3. Das SYSTEM führt an keiner Kinderfussball-Übung mehr eine Erscheinungsform des Manuals Fussball Jugendliche

### Out of Scope

1. Der USER kann eine Übung noch nicht dem Juniorenfussball zuordnen
2. Der Übungskatalog und die Suche bieten weiterhin die Werte beider Altersstufen zum Filtern an
3. Das SYSTEM ändert nichts daran, wann eine Übung den methodischen Fahrplan und wann einen Beschreibungstext trägt
4. Das SYSTEM ändert nichts an Feldtyp, Hauptteilkategorie, Anzahl Kinder, Material, Varianten, Bild und Diagramm
5. Die Oberfläche benennt die Altersstufe der Übung noch nicht

### Offene Fragen

Keine.

---

## Story 3: Junioren-Übung nach dem eigenen Lehrmittel erfassen

Als Trainer:in im Juniorenfussball
möchte ich beim Erfassen einer Übung den Juniorenfussball wählen und danach nur die Felder
und Werte des Manuals Fussball Jugendliche vor mir haben
damit ich meine Übungen nach meinem Lehrmittel führe, statt sie aus der
Kinderfussball-Didaktik zu übersetzen

### Preconditions

1. Jede Übung trägt eine geführte Altersstufe
2. Das Erfassen und Bearbeiten einer Übung folgt den Regeln des Manuals Fussball Kinder

### Acceptance Criteria

1. Der USER wählt beim Erfassen einer Übung deren Altersstufe
2. Der USER erkennt beim Erfassen und Bearbeiten, welcher Altersstufe die Übung folgt
3. Der USER erkennt beim Einordnen einer Junioren-Übung, zu welchem Trainingsteil ein Block gehört
4. Der USER kann jeden Block des Junioren-Trainingsschemas wählen, nicht nur die des Einstiegs
5. Der USER sieht an einer Junioren-Übung ausschliesslich die Alterskategorien des Juniorenfussballs
6. Der USER sieht an einer Junioren-Übung ausschliesslich die Erscheinungsformen des Manuals Fussball Jugendliche
7. Der USER muss den Ablauf einer Junioren-Übung als zusammenhängenden Beschreibungstext erfassen
8. Der USER erfasst an einer Junioren-Übung die Spielfeldgrösse
9. Der USER kann einer Junioren-Übung einen Übungstyp zuweisen, sofern sie in einem Block liegt, in dem eine Spielform vorkommen kann
10. Der USER sieht an einer Junioren-Übung kein Feld für den Feldtyp
11. Der USER sieht an einer Junioren-Übung kein Feld für die Hauptteilkategorie
12. Der USER bearbeitet auch eine Übung innerhalb eines Trainings nach denselben Regeln

### Postconditions

1. Das SYSTEM speichert eine Übung ausschliesslich mit Werten des Manuals Fussball Jugendliche WENN der USER sie im Juniorenfussball erfasst oder bearbeitet
2. Das SYSTEM führt an keiner Junioren-Übung einen Feldtyp, eine Hauptteilkategorie oder einen methodischen Fahrplan
3. Das SYSTEM weist das Speichern einer Junioren-Übung ohne Ablaufbeschreibung ab und benennt das Fehlende

### Out of Scope

1. Der USER kann eine bestehende Übung noch nicht in die andere Altersstufe überführen
2. Die Applikation führt keinen kuratierten Übungsbestand für den Juniorenfussball ein
3. Der Übungskatalog und die Suche bleiben unverändert
4. Die Applikation führt für den Juniorenfussball keine eigene Diagramm-Symbolik ein
5. Die Applikation ändert nichts an Anzahl Kinder, Material, Varianten, Bild und Diagramm
6. Die Applikation übernimmt die Schwierigkeitsangabe des Junioren-Manuals nicht
7. Der Übungskatalog filtert noch nicht nach der Spielfeldgrösse

### Offene Fragen

1. @UX Designer: Wie wird die Wahl der Altersstufe beim Erfassen dargestellt, und wie bleibt beim Einordnen einer Junioren-Übung erkennbar, zu welchem Trainingsteil ein Block gehört?
2. @Product Owner: In welcher Form erfasst der Trainer die Spielfeldgrösse — als freien Text, oder als zwei Masse in Metern?

---

## Story 4: Übung in die andere Altersstufe überführen

Als Trainer:in
möchte ich eine eigene Übung, die ich der falschen Altersstufe zugeordnet habe, in die
richtige überführen
damit ich sie dort richtigstellen kann, ohne Titel, Bild, Diagramm, Material und Ablauf
neu zu erfassen

Der Anwendungsfall ist die Korrektur, nicht der Wechsel hin und her. Auf Produktion sind
Übungen als Kategorie E erfasst, die fachlich zum Juniorenfussball gehören; sie sollen
von Hand richtiggestellt werden können.

### Preconditions

1. Die Übung gehört dem USER
2. Beide Altersstufen führen ihre eigenen Felder und Werte

### Acceptance Criteria

1. Der USER kann die Altersstufe einer eigenen Übung ändern
2. Der USER erfährt vor der Umwandlung, welche Angaben unverändert bleiben, welche überführt werden und welche wegfallen
3. Der USER muss die Umwandlung bestätigen
4. Der USER kann die Umwandlung abbrechen
5. Der USER wählt im selben Vorgang die Angaben der Zielstufe, für die es keine Entsprechung gibt
6. Das SYSTEM lässt die Umwandlung einer kuratierten oder einer fremden Übung nicht zu

### Postconditions

1. Das SYSTEM behält Titel, Bild und Diagramm, Anzahl Kinder, Material und Varianten unverändert WENN der USER die Umwandlung bestätigt
2. Das SYSTEM überführt die Ablaufbeschreibung in die Form der Zielstufe WENN der USER die Umwandlung bestätigt
3. Das SYSTEM schlägt eine Einordnung in der Zielstufe vor, soweit die Abbildungsregel für die bisherige Einordnung eine Entsprechung kennt
4. Das SYSTEM verwirft die Angaben der verlassenen Altersstufe WENN der USER die Umwandlung bestätigt
5. Das SYSTEM lässt die Übung unverändert WENN der USER die Umwandlung abbricht
6. Das SYSTEM lässt die Übungen in bestehenden Trainings unberührt; sie sind eigenständige Kopien und folgen der Umwandlung nicht

### Out of Scope

1. Die Applikation legt beim Überführen keine Kopie an; die Übung verlässt ihre bisherige Altersstufe
2. Die Applikation bewahrt die Angaben der verlassenen Altersstufe nicht auf; eine Rückkehr beginnt dort von vorn
3. Die Applikation überführt nicht mehrere Übungen auf einmal
4. Der Übungskatalog und die Suche bleiben unverändert
5. Die Applikation weist andere Trainer nicht darauf hin, dass eine öffentliche Übung die Altersstufe gewechselt hat
6. Die Applikation passt das Diagramm nicht an die Zielstufe an

### Offene Fragen

1. @UX Designer: Wie erfährt der Trainer vor der Umwandlung, was mit seinen Angaben geschieht — welche bleiben, welche werden überführt, welche fallen weg?
