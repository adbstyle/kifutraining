# Epic: Juniorenfussball-Trainingsschema

Stand 2026-08-14. Requirements-Dokumentation, keine Architektur- oder Lösungsspezifikation. Validiert durch perspektivenbasiertes Lesen (Kunde, Architektur, Test, Business-Analyse, Fachexperte, UX); alle blockierenden und wichtigen Findings wurden mit dem Product Owner geklärt und sind eingearbeitet.

## 1. Problem und Wert

Trainer:innen im Juniorenfussball (ab Kategorie D) können die Applikation heute nicht nutzen: Sie zwingt jedem Training die vier Trainingsteile des Kinderfussballs auf und kennt keine Alterskategorien oberhalb von E. Wer eine D-Juniorinnen-Mannschaft trainiert, muss auf andere Hilfsmittel ausweichen. Die Erweiterung öffnet die Applikation für den gesamten Juniorenfussball und bindet Trainer:innen über den Stufenübergang E→D hinaus, statt sie genau dann zu verlieren, wenn ihre Kinder in den Juniorenfussball wechseln.

## 2. Stakeholder

| Rolle | Bezug zum Vorhaben |
|---|---|
| Trainer:in Juniorenfussball (D bis A) | Neue Zielgruppe. Plant Trainings nach dem dreiteiligen Schema des SFV-Lehrmittels «Manual Fussball Jugendliche». |
| Trainer:in Kinderfussball (G, F, E) | Bestandsnutzer. Darf durch die Erweiterung keine Einschränkung erfahren. |
| Product Owner | Entscheidet Scope, Positionierung und Umgang mit dem Übungsbestand. |
| SFV als Quelle der Lehrmittel | Definiert Trainingsschema, Alterskategorien und Didaktik. Keine direkte Interaktion mit der Applikation. |

## 3. Fachlicher Ausgangspunkt

Der SFV führt zwei getrennte Lehrmittel mit zwei unterschiedlichen Trainingsschemata.

| | Kinderfussball (G, F, E) | Juniorenfussball (ab D) |
|---|---|---|
| Quelle | Manual Fussball Kinder, Abbildung 14 | Manual Fussball Jugendliche, Abbildung 19 |
| Trainingsteile | Auffangen, Einleitung, Hauptteil, Ausklang | Einstieg, Hauptteil, Abschluss |
| Untergliederung | Hauptteil in drei Unterblöcke: Fussball spielen lernen; Vielseitigkeit erleben; Fussball spielen | Einstieg in zwei Unterblöcke: Aufwärmen; Explosivität. Hauptteil in zwei Unterblöcke: Spielformen und unterstützende Übungen; Spiel |
| Zeitangaben | keine | Einstieg 20–30 Minuten, Spielformen und unterstützende Übungen 45–65 Minuten, Spiel 15–20 Minuten, Ausklang 5–10 Minuten, Gesamtdauer 90 Minuten (Werte gemäss FVBJ-Broschüre Abschnitt 5; das Manual Abb. 19 nennt für Spielformen 30–45 Minuten, der Widerspruch ist zugunsten der Broschüre entschieden) |
| Didaktik | sechs Erscheinungsformen, methodischer Fahrplan Offen starten – Üben – Wetteifern | eigene Erscheinungsformen nach Spielphasen, darunter die Entwicklungsdimensionen Taktik, Technik, Athletik, Persönlichkeit |

Anmerkungen aus der fachlichen Validierung:
- Das Manual Fussball Jugendliche verwendet die Begriffe synonym: Abbildung 19 nennt die Teile EINSTIEG/HAUPTTEIL/ABSCHLUSS, Abbildung 17 («roter Faden») beschriftet dieselben Teile doppelt als EINLEITUNG/EINSTIEG und AUSKLANG/ABSCHLUSS (am 2026-08-14 am PDF verifiziert, S. 41 und 43). «Einleitung» und «Ausklang» sind damit nicht exklusiv Kinderfussball-Begriffe; «Ausklang» ist im Juniorenschema zudem der Unterblock des Abschlusses. Eine deklarierte Brücke zum Kinderfussball existiert nicht, die Verwechslungsgefahr ist in der Quelle selbst angelegt.
- Das Manual differenziert das Trainingsschema nicht nach den Kategorien D, C, B, A. Es kennt eine einzige Struktur für die gesamte FTEM-Stufe Foundation 3; pädagogische Unterschiede laufen über Entwicklungsstufen (spätes Schulkindalter bis Adoleszenz), nicht über die Trainingsstruktur.
- Die Dreiphasen-Struktur des Einstiegs (Aktivierung und Körperstabilität, Spielform zum Trainingsziel, Explosivität) stammt aus dem J+S-Lernbaustein «Der Einstieg», nicht aus dem Manual selbst. Die Quellen liegen unter sources/junioren/ im Projekt.
- Im 7er-/9er-Fussball heissen die offiziellen Kategorien D (Knaben und gemischte Teams) und FF-14 (reine Mädchenteams). Entscheid: Die Applikation führt nur D; FF-14-Teams arbeiten mit der Kategorie D, weil Trainingsschema und Inhalte identisch sind.
- Die Junioren-Didaktik ist nicht ein Ersatz der Erscheinungsformen durch Entwicklungsdimensionen: Das Junioren-Manual hat eigene Erscheinungsformen (nach Spielphasen gegliedert), die Entwicklungsdimensionen liegen als Ebene darunter. Beides ist bewusst nicht Teil dieses Epics (siehe Out of Scope).
- Die SFV-Kategorienreform (verbindlich seit Saison 2025/26) unterteilt die Kategorie D in D-7 und D-9. Entscheid: Die Applikation führt eine einzige Kategorie D; das Trainingsschema ist für beide Spielformen dasselbe.

Die Applikation bildet heute ausschliesslich das Kinderfussball-Schema ab. Trainingsteile, Alterskategorien und die Hauptteil-Untergliederung sind nicht Konfiguration, sondern in Datenbank-Constraints, im JSON-Schema, im generierten Vokabular-Modul und in Domänen-Konstanten der Applikation verankert.

## 4. Epic

Juniorenfussball-Trainingsschema

Als Trainer:in im Juniorenfussball
möchte ich Trainings für die Alterskategorien D bis A nach dem Trainingsschema des Juniorenfussballs zusammenstellen
damit ich meine Mannschaft in derselben Applikation planen kann, ohne ihr die Struktur des Kinderfussballs überstülpen zu müssen

### Preconditions

1. Das Trainingsschema des Juniorenfussballs liegt mit Trainingsteilen, Unterblöcken und Zeitbandbreiten aus dem SFV-Lehrmittel belegt vor
2. Die Abbildungsregel von den Kinderfussball-Attributen einer Übung auf ihre Einordnung im Juniorenschema ist definiert (Ergebnis des Spikes)
3. Die Applikation hat echte Nutzer, Migrationen müssen bestehende Daten unverändert überstehen

### Erfolgskriterien

1. Ein Training ist genau einem der beiden Trainingsschemata zugeordnet; das Schema folgt aus den gewählten Alterskategorien, und Alterskategorien beider Schemata lassen sich nicht mischen
2. Ein Training ohne gewählte Alterskategorie verhält sich wie bisher nach dem Kinderfussball-Schema
3. Ein Junioren-Training ist nach den drei Trainingsteilen Einstieg, Hauptteil und Abschluss in fester, unveränderlicher Reihenfolge gegliedert
4. Die Unterblock-Struktur von Einstieg und Hauptteil ist beim Planen eines Junioren-Trainings erkennbar, auch bevor ihnen Übungen zugeordnet sind
5. Die Einordnung einer Übung in ein Junioren-Training folgt über die definierte Abbildungsregel aus ihren bestehenden Kinderfussball-Attributen, ohne dass eine Übung doppelt gepflegt wird
6. Eine Übung ist in Trainings beider Schemata verwendbar, sofern die Abbildungsregel für sie eine Entsprechung im jeweiligen Schema liefert
7. Wechselt ein befülltes Training durch Änderung seiner Alterskategorien das Schema, überträgt das System die zugeordneten Übungen anhand der Abbildungsregel in die Struktur des neuen Schemas; Übungen ohne Entsprechung sind für den Trainer als Nacharbeit erkennbar
8. Die Zeitbandbreite je Trainingsteil und die Gesamtdauer von 90 Minuten sind beim Planen eines Junioren-Trainings erkennbar, ohne dass eine Abweichung das Speichern oder Veröffentlichen verhindert
9. Der Übungskatalog ist nach den Alterskategorien D, C, B und A gleichwertig filterbar wie nach G, F und E
10. Ein Junioren-Training ist veröffentlichbar, sobald Einstieg und Hauptteil belegt sind und mindestens eine Alterskategorie gesetzt ist; der Abschluss ist keine Veröffentlichungsbedingung
11. Ein Junioren-Training zeigt in der mobilen Durchführungsansicht und im Druck dieselbe Gliederung nach Trainingsteilen und Unterblöcken wie im Editor
12. Kein nutzersichtbarer Text bezeichnet die Applikation als ausschliesslich für den Kinderfussball
13. Bestehende Kinderfussball-Trainings und -Übungen bleiben unverändert lesbar, bearbeitbar und veröffentlichbar

### Out of Scope

1. Die Applikation führt keinen kuratierten Übungsbestand aus dem Manual Fussball Jugendliche; der Product Owner sichtet die Junioren-Übungsschemata zuerst selbst, Trainer erfassen Junioren-Übungen als eigene Übungen
2. Die Junioren-Didaktik wird nicht abgebildet: weder die Erscheinungsformen des Junioren-Manuals nach Spielphasen noch die Entwicklungsdimensionen Taktik, Technik, Athletik und Persönlichkeit; die Kinderfussball-Attribute der Übungen bleiben unverändert
3. Die Applikation bildet kein Geschlecht ab; Juniorinnen und Junioren derselben Alterskategorie arbeiten mit derselben Struktur und demselben Übungsbestand
4. Die Applikation unterscheidet die Spielformen 7er, 9er und 11er nicht; die Kategorie D wird nicht in D-7 und D-9 aufgeteilt
5. Der Produktname und die Domain der Applikation werden nicht geändert
6. Die Applikation leitet aus der Alterskategorie keine Empfehlung ab, welche Übung fachlich geeignet ist

## 5. Story-Zerlegung nach SPIDR

Vertikal geschnitten, jede Story liefert für sich einen nachvollziehbaren Zustand. Reihenfolge ist die vorgeschlagene Umsetzungsreihenfolge.

| # | Story | SPIDR | Typ | Hängt ab von |
|---|---|---|---|---|
| 1 | Spike: Junioren-Übungsschemata sichten, Abbildungsregel definieren, Schema-Gültigkeit für C bis A prüfen | Spike | Enabler | — |
| 2 | Übungen und Trainings mit Alterskategorien D bis A auszeichnen und filtern | Data | Business | 1 |
| 3 | Trainingsschema aus den Alterskategorien bestimmen, inkl. Wechselverhalten mit Übertragung | Rules | Business | 1, 2 |
| 4 | Junioren-Training nach Einstieg, Hauptteil und Abschluss gliedern | Paths | Business | 3 |
| 5 | Einstieg und Hauptteil eines Junioren-Trainings in Unterblöcke gliedern | Rules | Business | 4 |
| 6 | Zeitbandbreiten und Gesamtdauer als Orientierung anzeigen | Rules | Business | 4 |
| 7 | Junioren-Training veröffentlichen | Rules | Business | 4 |
| 8 | Junioren-Training mobil durchführen und drucken | Interface | Business | 4, 5 |
| 9 | Nutzersichtbare Texte auf Kinder- und Juniorenfussball öffnen | Interface | Business | — |

Der Spike (Story 1) ist bewusst vorgeschaltet: Der Product Owner will die Übungsschemata des Juniorenfussballs sichten, bevor die Abbildungsregel und die Modellierung festgelegt werden. Der Spike prüft auch, ob das dreiteilige Schema mit identischen Unterblöcken unverändert für C, B und A gilt — das Manual differenziert die Entwicklungsstufen (spätes Schulkindalter bis Adoleszenz), die strukturelle Gleichheit des Schemas über alle Stufen ist eine Annahme, kein Beleg.

Die frühere Trennung in einen Modell-Enabler und eine Erfassen/Filtern-Story wurde aufgehoben: Die Oberfläche bietet neue Vokabularwerte automatisch an, ein reiner Modell-Schnitt hätte einen künstlichen Zwischenzustand erzeugt.

Vorgehensentscheid des Product Owners vom 2026-08-14: Zuerst wird der Spike umgesetzt, danach wird dieses Epic mit dem Fachwissen aus dem Manual Fussball Jugendliche erneut diskutiert, bevor die Stories 2 bis 8 verfeinert werden. In dieser Diskussion wird auch der Übergangszustand gemischter Alterskategorien vor Einführung der Schema-Regel entschieden.

Story 9 ist unabhängig und kann jederzeit gezogen werden.

## 6. Nicht-funktionale Anforderungen

1. Bestehende Kinderfussball-Daten überstehen die Erweiterung ohne manuellen Eingriff und ohne Datenverlust
2. Die Erweiterung fügt den bestehenden Invarianten nur zusätzlich erlaubte Werte hinzu und verschärft keine Regel, die auf bereits produktiv gespeicherten Zeilen gilt
3. Trainingsteile, Unterblöcke und Alterskategorien beider Schemata stammen aus einer einzigen kontrollierten Vokabularquelle
4. Ein Trainer erkennt an jeder Stelle der Oberfläche ohne Rückfrage, in welchem Trainingsschema er sich befindet
5. Die zwischen den Schemata gleichlautenden oder synonym verwendeten Begriffe, insbesondere Hauptteil, Einleitung und Einstieg sowie Ausklang und Abschluss, sind in der Oberfläche eindeutig ihrem Schema zuordenbar

## 7. Getroffene Entscheide

| Frage | Entscheid |
|---|---|
| Umfang der Alterskategorien | Gesamter Juniorenfussball, vier neue Kategorien D, C, B, A |
| D-7 / D-9 gemäss Kategorienreform | Eine einzige Kategorie D, keine Spielform-Unterscheidung |
| Geschlecht als Dimension | Nein, D-Juniorinnen sind die Alterskategorie D |
| Übungsbestand für den Juniorenfussball | Kein zweiter Manual-Bestand; PO sichtet die Junioren-Schemata zuerst, Trainer erfassen selbst |
| Verbindlichkeit der Zeitvorgaben | Orientierung, nicht bindend |
| Mischung der Schemata in einem Training | Nicht möglich, ein Training führt genau ein Schema |
| Schema-Bestimmung | Folgt aus den gewählten Alterskategorien; ohne Auswahl gilt das Kinderfussball-Schema |
| Schema-Wechsel eines befüllten Trainings | Automatische Übertragung anhand der Abbildungsregel, Übungen ohne Entsprechung als Nacharbeit markiert |
| Untergliederung im Juniorenschema | Einstieg und Hauptteil werden beide untergliedert |
| Junioren-Einordnung einer Übung | Wird aus den Kinderfussball-Attributen abgeleitet (Abbildungsregel definiert der Spike), keine Doppelpflege |
| Didaktik-Attribute für Junioren-Übungen | Vorerst unverändert, nur Alterskategorien kommen dazu; einzige Ausnahme: Der Spike darf eine minimale Ergänzung vorschlagen, damit Aufwärmen und Explosivität über Trainer-Übungen befüllbar sind |
| Pflichtteile für Veröffentlichung im Juniorenschema | Einstieg und Hauptteil, analog zu Einleitung und Hauptteil im Kinderfussball |
| Begriffsführung | Getrennte Begriffe je Schema, gemäss SFV-Lehrmittel |
| Positionierung | Sichtbare Texte werden geöffnet, Produktname und Domain bleiben |
| Lifecycle | Echte Nutzer vorhanden, Migrationen forward-only |
| Urheberrecht SFV/BASPO-Lehrmittel | Vom PO als unkritisch eingestuft (Struktur-Begriffe mit Quellenangabe) |
| FF-14 (reine Mädchenteams) | Keine eigene Kategorie, FF-14-Teams nutzen D |
| Quellenwiderspruch Zeitbandbreite Spielformen | Broschüren-Werte gelten: 45–65 Minuten |
| Leerer Unterblock Spiel im Junioren-Training | Hinweis beim Speichern, analog zum Kinderfussball-Hinweis bei leerem «Fussball spielen»; blockiert nichts |

## 8. Offene Fragen

1. @UX Designer: Soll die Zeitbandbreiten-Orientierung eine statische Referenzanzeige der SFV-Werte sein oder ein berechneter Abgleich der Summe der zugeordneten Übungsdauern gegen die Bandbreite?

Die frühere Frage zur Schema-Gültigkeit für C, B und A ist quellenseitig beantwortet: Das Manual kennt eine einzige Struktur für die gesamte Stufe Foundation 3 und differenziert nicht nach Kategorien. Der Spike (Story 1) hält das Ergebnis fest.

## 9. Requirements-Analyse: Konflikte gegenüber dem Ist-Zustand

Diese Befunde begründen, warum das Vorhaben Epic-Grösse hat. Sie sind Analyseergebnis, keine Anforderungen.

| Konflikt | Warum er entsteht |
|---|---|
| Eine Übung gehört heute genau einem Trainingsteil, soll aber beiden Schemata dienen | Die Bindung Übung zu Trainingsteil ist als Gleichheitsprüfung auf Datenbank- und Applikationsebene verankert und ausdrücklich als Architekturentscheid dokumentiert |
| Die Untergliederung existiert heute ausschliesslich für den Hauptteil | Der Einstieg des Juniorenschemas braucht dieselbe zweite Ebene, für die es heute keinen Mechanismus gibt |
| Die Regel «genau eine Hauptteilkategorie bei Hauptteil» ist bikonditional und vollvalidiert | Beide Schemata haben einen Trainingsteil namens Hauptteil, aber unterschiedliche Unterblöcke |
| Die Veröffentlichungsprüfung verlangt hart die Trainingsteile Einleitung und Hauptteil | Ein Junioren-Training kann Einleitung nie erfüllen |
| Die Regel «Auffangen trägt keine Dauer» hängt am Wert, nicht an einer Eigenschaft | Das Juniorenschema kennt Auffangen nicht |
| Die Alterskategorien G, F, E stehen nicht im kontrollierten Vokabular | Sie sind im JSON-Schema, in Datenbank-Constraints, in Labels und in Farbtokens mehrfach hartkodiert |
| Die Doku-Erzeugung und die Extraktionsskripte führen eigene, unabhängige Kopien der vier Trainingsteile | Jede Erweiterung muss dort separat nachgezogen werden |

Widersprüchlich gewordene Aussagen im Repository, die bei der Umsetzung nachzuführen sind:

1. Die Architektur-Spezifikation begründet den Verzicht auf eine Phasen-Abstraktion damit, dass die vier Trainingsteile eine feste, unveränderliche Sequenz seien
2. Die Architektur-Spezifikation führt die Gleichheitsprüfung zwischen Übung und Zuordnung darauf zurück, dass eine Übung genau einen Trainingsteil hat
3. `CLAUDE.md` beschreibt die Übungsdatenbank ausschliesslich als aus dem SFV-Manual Kinderfussball extrahiert
4. Story 3 des Epics Hauptteilkategorie schliesst eine Untergliederung der übrigen Trainingsteile ausdrücklich aus
