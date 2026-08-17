# Epic: Juniorenfussball-Trainingsschema

Stand 2026-08-16 (Epic-Review nach abgeschlossenem Spike). Requirements-Dokumentation, keine Architektur- oder Lösungsspezifikation. Zweifach validiert durch perspektivenbasiertes Lesen; der Epic-Review vom 2026-08-15/16 hat alle Aussagen gegen das Manual Fussball Jugendliche (PDF im Projekt) und gegen die Codebase abgeglichen.

## 1. Problem und Wert

Trainer:innen im Juniorenfussball (ab Kategorie D) können die Applikation heute nicht nutzen: Sie zwingt jedem Training die vier Trainingsteile des Kinderfussballs auf und kennt keine Alterskategorien oberhalb von E. Wer eine D-Juniorinnen-Mannschaft trainiert, muss auf andere Hilfsmittel ausweichen. Die Erweiterung öffnet die Applikation für den gesamten Juniorenfussball und bindet Trainer:innen über den Stufenübergang E→D hinaus, statt sie genau dann zu verlieren, wenn ihre Kinder in den Juniorenfussball wechseln.

Zusätzlicher Wert-Kontext aus den Quellen: Gemäss den Weisungen von J+S ist eine schriftliche Planung für die Durchführung von J+S-Aktivitäten verbindlich (Manual S. 42) — die App bedient damit eine regulatorisch begründete Pflicht der Trainer:innen. Der SFV bietet mit Clubcorner ein eigenes, kostenloses Planungsinstrument an; die App positioniert sich daneben über die kuratierte Übungsdatenbank und die schema-getreue Struktur.

Zwei Erweiterungen sichern die Quellentreue der neu entstehenden Junioren-Daten: Das Manual macht die zielgerichtete Planung zur Kernqualität eines Trainings (S. 41, roter Faden und SMART-Ziele) und typisiert seine Trainingsformen als Basisspielform, Spielform oder Übung (S. 56). Beides nimmt das Epic auf, damit Trainer ihre Junioren-Übungen und -Trainings von Beginn an quellengetreu erfassen und später keine Nachpflege oder Migration nötig wird.

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
| Quelle | Manual Fussball Kinder, Abbildung 14 | Manual Fussball Jugendliche, Abbildung 19 (S. 43) |
| Trainingsteile | Auffangen, Einleitung, Hauptteil, Ausklang | Einstieg, Hauptteil, Abschluss |
| Untergliederung | Hauptteil in drei Unterblöcke: Fussball spielen lernen; Vielseitigkeit erleben; Fussball spielen | Einstieg in drei Unterblöcke: Aufwärmen; Spielform zum Trainingsziel; Explosivität. Hauptteil in zwei Unterblöcke: Spielformen und unterstützende Übungen; Spiel. Abschluss mit dem Unterblock Ausklang |
| Zeitangaben | keine | Einstieg 20–30 Minuten, davon Aufwärmen 10–12, Spielform zum Trainingsziel 6–8 und Explosivität 8–10; Spielformen und unterstützende Übungen 30–45 Minuten, Spiel 15–20 Minuten, Ausklang 5–10 Minuten, Gesamtdauer 90 Minuten (Trainingsteile aus Manual Abb. 19, Einstiegs-Unterblöcke aus dem J+S-Lernbaustein; der frühere Entscheid für die Broschüren-Werte 45–65 wurde am 2026-08-16 revidiert, weil deren Summe die 90-Minuten-Vorgabe verfehlt) |
| Didaktik (Inhalts-Klassifikation) | sechs Erscheinungsformen, methodischer Fahrplan Offen starten – Üben – Wetteifern | elf Erscheinungsformen in fünf Kategorien (drei nach Spielphasen, zwei spielphasenübergreifend: Athletik und Gesundheit, Persönlichkeit und Team), darunter die Entwicklungsdimensionen Taktik, Technik, Athletik, Persönlichkeit |
| Format-Klassifikation (unabhängige Achse) | keine | Übungs-Typologie Basisspielform, Spielform, Übung. Basisspielform: die Referenzform eines Themas, die die taktischen Prinzipien sichtbar macht; Spielform: spielnahe Form mit Entscheidungsdruck; Übung: isolierte Form. Das Manual bevorzugt fachlich Spielformen; diese Präferenz ist Hintergrundwissen und wird von der App nicht abgebildet |

Anmerkungen aus der fachlichen Validierung (Manual am PDF verifiziert):
- Das Manual verwendet die Begriffe synonym: Abbildung 19 nennt die Teile EINSTIEG/HAUPTTEIL/ABSCHLUSS, Abbildung 17 («roter Faden», S. 41) beschriftet dieselben Teile doppelt als EINLEITUNG/EINSTIEG und AUSKLANG/ABSCHLUSS. «Einleitung» und «Ausklang» sind damit nicht exklusiv Kinderfussball-Begriffe. Die Verwechslungsgefahr ist in der Quelle selbst angelegt. Abbildung 19 führt im Hauptteil zudem wörtlich «Fussball spielen lernen» und «Fussball spielen» — zwei der drei Kinderfussball-Hauptteilkategorien; nur «Vielseitigkeit erleben» hat im Junioren-Manual keine Entsprechung.
- Die Inhalte des Einstiegs stehen im Manual selbst (Abb. 19: TA/TE/PE, AT-Prävention, AT-Explosivität; Reihenfolge-Belege S. 45 und S. 72); die Benennung der drei Phasen und deren Minutenwerte stammen aus dem J+S-Lernbaustein «Der Einstieg». Die Applikation bildet den Einstieg nach diesen drei Phasen ab, weil die Spielform zum Trainingsziel eine eigenständige Übungsart ist, die den Trainingsschwerpunkt einführt und den roten Faden zum Hauptteil herstellt.
- Das Manual differenziert das Trainingsschema nicht nach Kategorien; es kennt eine einzige Struktur für die FTEM-Stufe Foundation 3. Die Gleichsetzung von Foundation 3 mit den Kategorien D bis A ist eine begründete Annahme (Manual-Zielgruppe «Jugendliche», Broschüre bestätigt sie für D), keine Manual-Aussage. Pädagogische Unterschiede laufen über Entwicklungsstufen (Tabelle 3, S. 13) und betreffen Inhalte und Dosierung, nicht die Struktur.
- Der dritte Athletik-Bereich Ermüdungsresistenz gehört laut Manual (S. 72) über Spielformen in den Hauptteil; er braucht keinen eigenen Unterblock.
- Im 7er-/9er-Fussball heissen die offiziellen Kategorien D (Knaben und gemischte Teams) und FF-14 (reine Mädchenteams). Entscheid: Die Applikation führt nur D; FF-14-Teams arbeiten mit der Kategorie D.
- Die SFV-Kategorienreform (verbindlich seit Saison 2025/26) unterteilt D in D-7 und D-9. Entscheid: eine einzige Kategorie D, keine Spielform-Unterscheidung.

Die Applikation bildet heute ausschliesslich das Kinderfussball-Schema ab. Trainingsteile, Alterskategorien und die Hauptteil-Untergliederung sind nicht Konfiguration, sondern in Datenbank-Constraints, im JSON-Schema, im generierten Vokabular-Modul und in Domänen-Konstanten der Applikation verankert. Die abgenommene Abbildungsregel samt Heimat-Mechanismus ist in `2026-08-15-junioren-abbildungsregel.md` festgehalten.

## 4. Epic

Juniorenfussball-Trainingsschema

Als Trainer:in im Juniorenfussball
möchte ich Trainings für die Alterskategorien D bis A nach dem Trainingsschema des Juniorenfussballs zusammenstellen
damit ich meine Mannschaft in derselben Applikation planen kann, ohne ihr die Struktur des Kinderfussballs überstülpen zu müssen

### Preconditions

1. Die Abbildungsregel und der Heimat-Mechanismus sind als Entscheidungsdokument abgenommen
2. Die Applikation hat echte Nutzer, Migrationen müssen bestehende Daten unverändert überstehen

### Erfolgskriterien

1. Ein Training ist genau einem der beiden Trainingsschemata zugeordnet; das Schema folgt aus den gewählten Alterskategorien, und Alterskategorien beider Schemata lassen sich zu keinem Zeitpunkt mischen
2. Ein Training ohne gewählte Alterskategorie verhält sich wie bisher nach dem Kinderfussball-Schema
3. Ein Junioren-Training ist nach den drei Trainingsteilen Einstieg, Hauptteil und Abschluss in fester Reihenfolge gegliedert
4. Die Unterblock-Struktur von Einstieg und Hauptteil ist beim Planen eines Junioren-Trainings erkennbar, auch bevor ihnen Übungen zugeordnet sind
5. Die Einordnung einer Übung in ein Junioren-Training folgt über die abgenommene Abbildungsregel aus ihrer gepflegten Heimat, ohne dass eine Übung doppelt gepflegt wird
6. Eine Übung ist in Trainings beider Schemata verwendbar, sofern die Abbildungsregel für sie eine Entsprechung im jeweiligen Schema liefert
7. Übungen für die Einstiegs-Unterblöcke lassen sich als eigene Übungen mit Junioren-Heimat erfassen
8. Wechselt ein befülltes Training durch Änderung seiner Alterskategorien das Schema, überträgt das System die zugeordneten Übungen anhand der Abbildungsregel in die Struktur des neuen Schemas; Übungen ohne Entsprechung sind für den Trainer als Nacharbeit erkennbar
9. Die Zeitbandbreiten je Trainingsteil und die Gesamtdauer von 90 Minuten stehen dem Trainer beim Planen eines Junioren-Trainings als Orientierung zur Verfügung und sind keine Speicher- oder Veröffentlichungsbedingung
10. Der Übungskatalog ist nach den Alterskategorien D, C, B und A gleichwertig filterbar wie nach G, F und E
11. Ein veröffentlichtes Junioren-Training ist lehrmittelkonform: Die drei Einstiegs-Unterblöcke, der Unterblock Spielformen und unterstützende Übungen sowie der Abschluss sind belegt, und keine Nacharbeit ist offen; einzig der Spiel-Block bleibt als freies Spiel von der Pflicht ausgenommen
12. Ein Junioren-Training folgt in der mobilen Durchführungsansicht und im Druck derselben Gliederung und Reihenfolge nach Trainingsteilen und Unterblöcken wie im Editor, beschränkt auf die belegten Blöcke
13. Ein Training kann genau ein optionales Ziel als Freitext tragen, das in Editor, Detailansicht, Durchführungsansicht und Druck sichtbar ist, unabhängig vom Schema
14. Eine Übung kann genau einen Übungstyp aus Basisspielform, Spielform oder Isolierte Form tragen, und der Übungskatalog ist danach filterbar; für den Bestand ist der Übungstyp nicht erforderlich
15. Die zentralen nutzersichtbaren Texte der Applikation — Seitentitel, Beschreibung und Startseite — beschreiben sie wörtlich als Werkzeug für Kinder- und Juniorenfussball; Quellen- und Herkunftshinweise bezeichnen die Herkunft der Inhalte weiterhin korrekt
16. Bestehende Kinderfussball-Trainings und -Übungen bleiben unverändert lesbar, bearbeitbar und veröffentlichbar
17. Eine Übung kann mit Erscheinungsformen des Junioren-Manuals ausgezeichnet werden, und der Übungskatalog ist danach gleichwertig filterbar wie nach den Kinderfussball-Erscheinungsformen; für den Bestand sind sie nicht erforderlich

### Out of Scope

1. Die Applikation führt keinen kuratierten Übungsbestand aus dem Manual Fussball Jugendliche oder anderen Junioren-Quellen; Trainer erfassen Junioren-Übungen selbst
2. Das Spielphasenmodell und die Entwicklungsdimensionen des Junioren-Manuals werden nicht abgebildet; die Kinderfussball-Didaktik-Attribute der Bestandsübungen bleiben unverändert. Die Junioren-Erscheinungsformen selbst sind seit dem PO-Entscheid vom 2026-08-17 im Scope
3. Die Applikation bildet kein Geschlecht ab; Juniorinnen und Junioren derselben Alterskategorie arbeiten mit derselben Struktur und demselben Übungsbestand
4. Die Applikation unterscheidet die Spielformen 7er, 9er und 11er nicht; die Kategorie D wird nicht in D-7 und D-9 aufgeteilt
5. Der Produktname und die Domain der Applikation werden nicht geändert
6. Die Applikation leitet aus der Alterskategorie, dem Trainingsziel oder der Typologie keine Empfehlung ab, welche Übung fachlich geeignet ist
7. Die Applikation bildet keine Belastungssteuerung und keine Periodisierung über mehrere Trainings ab
8. Die Organisation von Trainerteams, das Teilen und das Terminieren von Trainings sind nicht Teil dieses Epics; sie werden im Epic Team-Trainingsplan behandelt

## 5. Story-Zerlegung nach SPIDR

Vertikal geschnitten, jede Story liefert für sich einen nachvollziehbaren Zustand. Reihenfolge ist die vorgeschlagene Umsetzungsreihenfolge.

| # | Story | SPIDR | Typ | Hängt ab von |
|---|---|---|---|---|
| 1 | Spike: Junioren-Übungsschemata sichten, Abbildungsregel definieren (abgeschlossen 2026-08-15) | Spike | Enabler | — |
| 2 | Übungen und Trainings mit Alterskategorien D bis A auszeichnen und filtern | Data | Business | 1 |
| 3 | Trainingsschema aus den Alterskategorien bestimmen, Mischverbot und Wechselverhalten mit Übertragung | Rules | Business | 1, 2 |
| 4 | Junioren-Training nach Einstieg, Hauptteil und Abschluss gliedern | Paths | Business | 3 |
| 5a | Einstieg und Hauptteil eines Junioren-Trainings in Unterblöcke gliedern | Rules | Business | 4 |
| 5b | Übungen mit Junioren-Heimat in einem Einstiegs-Unterblock erfassen | Data | Business | 1, 5a |
| 6 | Zeitbandbreiten und Gesamtdauer als Orientierung anzeigen | Rules | Business | 4, 5a |
| 7 | Junioren-Training veröffentlichen | Rules | Business | 4 |
| 8 | Junioren-Training mobil durchführen und drucken | Interface | Business | 4, 5a |
| 9 | Übungstyp erfassen und filtern | Data | Business | — |
| 10 | Trainingsziel an Trainings führen | Data | Business | — |
| 11 | Nutzersichtbare Texte auf Kinder- und Juniorenfussball öffnen | Interface | Business | — |
| 12 | Junioren-Erscheinungsformen erfassen und filtern | Data | Business | — |

Release-Entscheid (PO, 2026-08-16): Das gesamte Epic wird als Ganzes released. Die Story-Reihenfolge ist reine Entwicklungs-Reihenfolge; Zwischenzustände einzelner Stories erreichen die Nutzer nie. Damit ist ausgeschlossen, dass je ein nutzbarer Zustand existiert, in dem Alterskategorien beider Schemata mischbar sind, ein Junioren-Training ohne Junioren-Struktur entsteht oder ein Junioren-Training nicht veröffentlicht werden kann.

Die frühere Story 5 wurde im Refinement in 5a (Unterblock-Gliederung im Trainings-Editor) und 5b (Erfassen von Übungen mit Junioren-Heimat im Übungs-Editor) getrennt — zwei Oberflächen, zwei Workflows.

Die Stories 9, 10, 11 und 12 sind unabhängig und können jederzeit gezogen werden. Die Stories 9 und 12 sind bewusst früh sinnvoll, damit Junioren-Übungen von Anfang an typisiert und ausgezeichnet erfasst werden und keine Nachmigration entsteht.

## 6. Nicht-funktionale Anforderungen

1. Bestehende Kinderfussball-Daten überstehen die Erweiterung ohne manuellen Eingriff und ohne Datenverlust
2. Die Erweiterung fügt den bestehenden Invarianten nur zusätzlich erlaubte Werte hinzu und verschärft keine Regel, die auf bereits produktiv gespeicherten Zeilen gilt
3. Trainingsteile, Unterblöcke, Alterskategorien, Übungstyp und Erscheinungsformen beider Schemata stammen aus einer einzigen kontrollierten Vokabularquelle
4. Ein Trainer erkennt an jeder Stelle der Oberfläche ohne Rückfrage, in welchem Trainingsschema er sich befindet
5. Die zwischen den Schemata gleichlautenden oder synonym verwendeten Begriffe, insbesondere Hauptteil, Einleitung und Einstieg sowie Ausklang und Abschluss, sind in der Oberfläche eindeutig ihrem Schema zuordenbar

## 7. Getroffene Entscheide

| Frage | Entscheid |
|---|---|
| Umfang der Alterskategorien | Gesamter Juniorenfussball, vier neue Kategorien D, C, B, A |
| D-7 / D-9 gemäss Kategorienreform | Eine einzige Kategorie D, keine Spielform-Unterscheidung |
| Geschlecht als Dimension | Nein; D-Juniorinnen und FF-14-Teams nutzen die Kategorie D |
| Übungsbestand für den Juniorenfussball | Kein kuratierter Junioren-Bestand, Trainer erfassen selbst |
| Verbindlichkeit der Zeitvorgaben | Orientierung, nicht bindend |
| Zeitwerte | Manual-Werte gemäss Abbildung 19 (Spielformen 30–45); der Broschüren-Entscheid vom 2026-08-14 wurde am 2026-08-16 wegen des Rechenkonflikts mit der 90-Minuten-Gesamtdauer revidiert |
| Mischung der Schemata in einem Training | Nicht möglich; die Regel wird zusammen mit der Einführung der Kategorien ausgeliefert, ein Übergangszustand mit Mischung existiert nie |
| Schema-Bestimmung | Folgt aus den gewählten Alterskategorien; ohne Auswahl gilt das Kinderfussball-Schema |
| Schema-Wechsel eines befüllten Trainings | Automatische Übertragung anhand der Abbildungsregel, Übungen ohne Entsprechung als Nacharbeit markiert |
| Untergliederung im Juniorenschema | Einstieg und Hauptteil werden untergliedert; der Einstieg hat drei Unterblöcke gemäss den J+S-Phasen (PO-Entscheid 2026-08-16, ersetzt die frühere Zweiteilung) |
| Junioren-Einordnung einer Übung | Heimat-Mechanismus gemäss abgenommenem Entscheidungsdokument, keine Doppelpflege |
| Befüllbarkeit der Einstiegs-Unterblöcke | Über Übungen mit direkter Junioren-Heimat, beschränkt auf die drei Einstiegs-Unterblöcke |
| Zeit-Orientierung | Berechneter Abgleich der erfassten Dauern gegen die Bandbreiten und die Gesamtdauer, nur im Juniorenschema (PO 2026-08-16) |
| Leere Unterblöcke Spiel, Spielform zum Trainingsziel und Explosivität im Junioren-Training | Hinweis, analog zum Kinderfussball-Hinweis bei leerem freiem Spiel; blockiert nichts (PO 2026-08-16) |
| Unterblock-Zuordnung im Junioren-Training | Revidiert am 2026-08-16 durch das Übungsbibliothek-Epic: Die Einordnung der Übung liefert den Unterblock als Vorschlag; die Einordnung der Fassung im Training ist frei anpassbar, eine Abweichung erzeugt einen Hinweis am Training statt einer Sperre. (Ursprünglich: Der Unterblock folgt zwingend aus der Übung, kein freies Wählen, PO 2026-08-16) |
| Übungen mit Junioren-Heimat | Aufwärmen und Spielform zum Trainingsziel tragen den methodischen Fahrplan mit Offen starten als einziger Pflichtstufe und dürfen Junioren-Erscheinungsformen tragen (präzisiert 2026-08-17 mit der Aufnahme der Junioren-Erscheinungsformen); Explosivität trägt einen Aufbau-Text und darf ebenfalls Junioren-Erscheinungsformen tragen (revidiert 2026-08-17 — das Manual ordnet «Explosiv und dynamisch agieren» dem Bereich Explosivität 1:1 zu; ursprünglich ohne Erscheinungsform, PO 2026-08-16). Die Warnung bei Heimat-Änderung einer verwendeten Übung ist seit dem Übungsbibliothek-Epic (2026-08-16) gegenstandslos: Trainings enthalten eigenständige Fassungen, Änderungen an Bibliotheks-Übungen wirken nicht mehr in Trainings |
| Pflichtbedingungen für Veröffentlichung im Juniorenschema | Drei Einstiegs-Unterblöcke, Spielformen und unterstützende Übungen sowie der Abschluss belegt, keine offene Nacharbeit; der Spiel-Block ist als freies Spiel ausgenommen (PO 2026-08-16). Die bewusst hohe Erst-Hürde (zwei Unterblöcke nur über eigene Übungen befüllbar) wird später durch geseedete Community-Übungen gesenkt |
| Trainingsziel | Genau ein optionales Freitext-Ziel pro Training, für beide Schemata; SMART-Formulierung bleibt Sache des Trainers (PO 2026-08-16). Obergrenze 200 Zeichen; bereits beim Anlegen erfassbar; sichtbar auch auf der Detailansicht und damit für Betrachter veröffentlichter Trainings; in der Durchführung nur zu Beginn; weder auf den Trainings-Karten noch in der Trainings-Suche (PO 2026-08-17) |
| Übungs-Typologie | Basisspielform, Spielform, Übung als optionales Attribut für alle Übungen; keine Nachpflege des Bestands (PO 2026-08-16). In der App heisst das Attribut Übungstyp; der dritte Wert heisst Isolierte Form, bewusste Abweichung vom Manual-Begriff Übung wegen der Kollision mit dem Objekt Übung. Kurzdefinitionen im Manual-Wortlaut beim Zuweisen einsehbar; an Fassungen frei anpassbar ohne Rückwirkung auf die Vorlage; die dreifache Belegung des Worts Spielform bleibt bewusst quellentreu bestehen (PO 2026-08-17) |
| Junioren-Erscheinungsformen | Revidiert am 2026-08-17: Die 11 Erscheinungsformen des Junioren-Manuals (Tabelle 4, S. 21) werden aufgenommen — erfassen und filtern als eigene Story, weil das Manual seinen Trainingsformen Erscheinungsformen über die Spielphasen-Kapitel zuschreibt. (Ursprünglich out of scope, Epic-Review 2026-08-16). Mehrere Werte pro Übung erlaubt; beide Vokabulare stehen allen erscheinungsform-berechtigten Übungen offen (Einleitung, Hauptteil und die drei Junioren-Heimaten; Auffangen/Ausklang bleiben ausgeschlossen) — der Zwischenentscheid «Vokabular folgt der Heimat» wurde gleichentags revidiert, weil die 6 spielphasenbezogenen Werte sonst an Hauptteil-Übungen nie zuweisbar wären; keine Einschränkung je Unterblock; gemeinsame Filter-Dimension; die Auswahl- und Filterlisten bleiben flach ohne Spielphasen-Gruppierung; an Fassungen frei anpassbar ohne Rückwirkung (PO 2026-08-17) |
| Junioren-Didaktik im Übrigen | Spielphasenmodell und Entwicklungsdimensionen bleiben ausserhalb dieses Epics |
| Begriffsführung | Getrennte Begriffe je Schema, gemäss SFV-Lehrmittel |
| Positionierung | Sichtbare Texte werden geöffnet, Produktname und Domain bleiben. Präzisiert 2026-08-17: Kinderfussball und Juniorenfussball wörtlich in Titel, Beschreibung und Startseite; Übungs-Seitentitel schema-neutral; Quellenhinweise und Herkunfts-Badge unverändert; kein SEO-Ausbau; Formulierungen zur PO-Abnahme |
| Lifecycle | Echte Nutzer vorhanden, Migrationen forward-only |
| Urheberrecht SFV/BASPO-Lehrmittel | Vom PO als unkritisch eingestuft (Struktur-Begriffe mit Quellenangabe) |

## 8. Offene Fragen

1. @UX Designer: Gestaltung der Heimat-Wahl im Übungs-Editor, der Nacharbeits-Markierung beim Schema-Wechsel, der Zeit-Abgleich-Anzeige sowie Farbe und Kurzlabel je neuer Alterskategorie

## 9. Requirements-Analyse: Konflikte gegenüber dem Ist-Zustand

Diese Befunde begründen den Umfang des Epics. Sie sind Analyseergebnis, keine Anforderungen. Vollständige Kopplungsanalyse in den Review-Protokollen; die wichtigsten Punkte:

1. Die Bindung Übung zu Trainingsteil ist als Gleichheitsprüfung auf Datenbank- und Applikationsebene verankert; der Heimat-Mechanismus löst genau diese Prüfung ab
2. Der Wertebereich des Übungs-Trainingsteils ist heute abschliessend auf die vier Kinderfussball-Werte begrenzt; Übungen mit Junioren-Heimat sind damit nicht darstellbar
3. Die Untergliederung existiert heute nur für den Hauptteil; der Einstieg braucht dieselbe zweite Ebene
4. Die Veröffentlichungsprüfung, die Positions-Eindeutigkeit und die Verschiebe-Logik kennen nur die Kinderfussball-Struktur
5. Der bestehende Stufen-Hinweis unterscheidet nicht zwischen Alters-Abweichung und Schema-Konflikt; ein Begriff von Nacharbeit an einzelnen Zuordnungen existiert nicht
6. Editor, Durchführung, Druck und Doku-Erzeugung iterieren über eine feste Vier-Teile-Konstante; Übungen mit fremden Werten verschwinden dort stillschweigend
7. Die Alterskategorien stehen nicht in der kontrollierten Vokabularquelle, sondern sind mehrfach hartkodiert, auch im Vokabular-Generator selbst
8. Trainingsziel, Übungs-Typologie und Zeit-Orientierungswerte haben im heutigen Modell keinerlei Entsprechung

Durch dieses Epic überholte Aussagen im Repository (bei der Umsetzung nachzuführen): die Architektur-Spec-Aussagen zur festen Vier-Teile-Sequenz und zur Gleichheitsprüfung, die Kinderfussball-Beschreibungen in CLAUDE.md, im Kopf der Init-Migration und im JSON-Schema-Titel, das Out-of-Scope von Epic #20 Story #23 sowie die veralteten Pre-Launch-Migrationsmuster als Vorlage.
