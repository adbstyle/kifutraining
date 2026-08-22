# Epic: Übungsbibliothek — Vorlagen kopieren statt referenzieren

**Datum:** 2026-08-16
**Ebene:** Epic (Business) — Paradigmenwechsel der Kernarchitektur, mehrere Workflows, mehrere Sprints
**Status:** Anforderungen mit dem Product Owner abgestimmt; alle 9 Stories ausgearbeitet und perspektivenbasiert validiert (2026-08-22, siehe `2026-08-16-uebungsbibliothek-stories.md`)
**Reihenfolge:** Dieses Epic geht dem Epic Team-Trainingsplan (`2026-08-16-team-trainingsplan-epic.md`) voraus.

## 1. Problem & Wert

Ein Training verweist heute auf Übungen, die ihm nicht gehören. Diese Abhängigkeit erzeugt eine ganze Klasse von Problemen: Löscht oder privatisiert ein Trainer seine öffentliche Übung, bleibt in fremden Trainings nur ein Name ohne Inhalt zurück. Ändert er sie, ändern sich fremde Trainings unbemerkt mit. Wer ein Training veröffentlicht, muss über die Mitveröffentlichung seiner privaten Übungen entscheiden — und diese bleiben öffentlich, selbst wenn er das Training zurückzieht. Und die 75 kuratierten Manual-Übungen sind in Trainings gänzlich unveränderbar, obwohl Trainer sie ständig an Gruppengrösse, Platz und Niveau anpassen müssen.

Mit dem geplanten Team-Trainingsplan verschärft sich das Problem: Sobald mehrere Trainer gemeinsam an Trainings arbeiten, darf deren Vollständigkeit von keiner einzelnen Person mehr abhängen. Jeder Verweis auf ein fremdes Objekt ist eine Sollbruchstelle.

Der Wechsel: Der Übungspool wird zu einer Vorlagen-Bibliothek. Wird eine Übung einem Training zugeordnet, entsteht eine eigenständige Fassung, die im Training lebt und dort vollständig angepasst werden kann — ausnahmslos, auch bei Manual-Übungen und eigenen Übungen. Ein Training hängt danach von niemandem mehr ab. Woher eine Fassung stammt, bleibt als unveränderliche Angabe sichtbar.

Trainer gewinnen dreierlei: verlässliche Trainings, die sich nie ungefragt ändern; erstmals anpassbare Manual-Übungen, ohne dass der kuratierte Bestand angetastet wird; und ein Veröffentlichen ohne Nebenwirkungen auf die eigene Bibliothek.

## 2. Stakeholder & Personas

- **Trainer** — stellt Trainings aus Bibliotheks-Vorlagen zusammen und passt die Fassungen an seine Gruppe an. Will verlässliche Trainings und anpassbare Vorlagen.
- **Community-Trainer** — stellt eigene Übungen als Vorlagen bereit. Will, dass seine Urheberschaft erkennbar bleibt, und seine Bibliothek unabhängig von fremden Trainings pflegen können.
- **Anonymer Besucher** — sieht öffentliche Übungen und Trainings wie bisher.
- **Product Owner** — verantwortet, dass der kuratierte Manual-Bestand unverändert und als Herkunft erkennbar bleibt und dass bestehende Trainings die Umstellung unbeschadet überstehen.

## 3. Epic-Beschreibung

Als Trainer
will ich Übungen aus der Bibliothek als eigenständige, anpassbare Fassungen in meine Trainings übernehmen
damit meine Trainings vollständig mir gehören, sich nie durch Handlungen anderer verändern und ich jede Vorlage auf meine Gruppe zuschneiden kann.

## 4. Preconditions

1. Die Anwendung wird produktiv genutzt; bestehende Trainings verweisen auf Bibliotheks-Übungen und müssen ohne Nutzereingriff überführt werden.
2. Der kuratierte Manual-Bestand ist als Datenquelle vorhanden und über einen wiederholbaren Ladevorgang aktualisierbar.
3. Für Diagramme existiert ein Kopiermechanismus, der eine vollständig entkoppelte Zweitfassung erzeugt.

## 5. Erfolgskriterien

1. Eine einem Training zugeordnete Übung wird als eigenständige Fassung Teil des Trainings und ist dort vollständig anpassbar, einschliesslich ihrer Einordnung.
2. Kein Training verändert sich dadurch, dass eine Bibliotheks-Übung geändert, privat gestellt, gelöscht oder ihr Konto entfernt wird.
3. Eine Manual-Übung ist als Fassung im Training anpassbar, während der kuratierte Bestand in der Bibliothek unverändert bleibt.
4. Jede Fassung trägt eine unveränderliche Herkunftsangabe mit dem Stand zum Zeitpunkt der Übernahme.
5. Bei einer Kopie einer Kopie bleibt die ursprüngliche Herkunft bestehen.
6. Bild und Diagramm einer Fassung sind eigenständig und bleiben intakt, wenn das Original verschwindet.
7. Fassungen erscheinen weder im Übungskatalog noch in der Suche noch in den Favoriten.
8. Eine im Training angepasste Fassung ist bewusst in die eigene Bibliothek übernehmbar und danach als eigene Vorlage verwendbar.
9. Eine Fassung kann bewusst von der aus der Vorlage vorgeschlagenen Einordnung abweichen; die Abweichung blockiert nichts und wird nicht gesondert angezeigt. (Revidiert am 2026-08-22: der ursprünglich vorgesehene Abweichungs-Hinweis ist gestrichen.)
10. Das Veröffentlichen eines Trainings erfordert keine Entscheidung mehr über einzelne Übungen; der Trainer bestätigt stattdessen einmalig, dass sämtliche Inhalte des Trainings einschliesslich der Bilder öffentlich werden.
11. Eine veröffentlichte Bibliotheks-Übung ist im Katalog als Vorlage auffindbar und über eine öffentliche Detailseite einsehbar; das Zurückziehen bleibt jederzeit möglich und lässt bestehende Fassungen unberührt.
12. Jede Übung erfüllt eine zu ihrer Hauptteilkategorie passende Vollständigkeitsregel; für die Kategorie Fussball spielen genügt eine Beschreibung des Spiels anstelle des methodischen Fahrplans.
13. Sämtliche Manual-Übungen erfüllen die für ihre Kategorie geltende Vollständigkeitsregel nachweislich, ohne Extraktionsfehler im Text.
14. Bestehende Trainings sind nach einer einmaligen Überführung vollständig und verhalten sich wie neu erstellte, ohne dass ein Nutzer eingreifen muss.
15. Zu keinem Zeitpunkt erleben Nutzer zwei Verhaltensweisen nebeneinander; die Überführung des Bestands wird zusammen mit dem neuen Zuordnen wirksam.
16. Eine öffentlich geteilte, bearbeitete Fassung einer Manual-Übung ist als Bearbeitung erkennbar; die Herkunftsangabe sagt, worauf sie basiert, und gibt sie nicht als Original aus.

## 6. Story-Zerlegung (SPIDR, vertikal)

Jede Story liefert End-to-End-Wert. Reihenfolge grob abhängigkeitssortiert.

1. **Enabler (Spike) — Fassungs-Datenmodell und Überführungsansatz:** Das Team klärt mit dem PO, wie eine Fassung im Datenmodell lebt, wie Bilddateien kopiert werden, welche Felder die Herkunftsangabe umfasst und wie der Bestand sicher überführt wird — einschliesslich Laufzeit, Speichervolumen, Verhalten bei Teilausfall und Nachweis der Vollständigkeit. Ergebnis ist ein abgenommenes Entscheidungsdokument.
2. **Enabler (Data) — Fahrplan-Regel je Hauptteilkategorie und Manual-Vollständigkeit:** Die Vollständigkeitsregel gilt je Hauptteilkategorie für alle Übungen; die Kategorie Fussball spielen trägt eine Beschreibung statt eines Fahrplans, bestehende Übungen dieser Kategorie übernehmen ihren bisherigen Ablauftext als Beschreibung; der Manual-Bestand erfüllt die Regel nachweislich, inklusive Bereinigung von Extraktionsfehlern. Diese Story geht der Datenmodell-Story voraus, weil die Fassung einer Manual-Übung den Regeln für Trainer-Übungen genügen muss und daran heute scheitern würde.
3. **Enabler (Data) — Datenmodell für Fassungen mit Herkunftsangabe:** Das Datenmodell trägt Fassungen als trainingseigene Übungen mit unveränderlicher Herkunftsangabe, ausgeblendet aus Katalog, Suche und Favoriten; Bild und Diagramm werden beim Erzeugen entkoppelt.
4. **Business (Paths) — Übung als Fassung ins Training übernehmen:** Ein Trainer fügt eine Bibliotheks-Übung einem Training hinzu und erhält eine eigenständige Fassung; der Vorschlag des Blocks folgt der Einordnung der Vorlage; der Picker fügt nur hinzu, entfernt wird im Editor.
5. **Business (Paths) — Fassung im Training bearbeiten:** Ein Trainer passt eine Fassung vollständig an, einschliesslich Einordnung, Bild und Diagramm. (Revidiert am 2026-08-22: der Hinweis bei abweichender Einordnung ist gestrichen.)
6. **Business (Rules) — Herkunft einer Fassung erkennen:** Ein Trainer erkennt an jeder Fassung, woraus sie entstanden ist; Diagramm-Kopien tragen dieselbe Art von Herkunftsangabe.
7. **Business (Paths) — Fassung in die eigene Bibliothek übernehmen:** Ein Trainer macht eine Fassung zur eigenen, zunächst privaten Vorlage und verwendet sie in weiteren Trainings; die ursprüngliche Herkunft bleibt an der Vorlage und an späteren Fassungen davon bestehen.
8. **Business (Rules) — Vereinfachtes Veröffentlichen:** Ein Trainer veröffentlicht ein Training mit einer einmaligen Bestätigung der Tragweite statt einer Übungs-Rückfrage; eine veröffentlichte Bibliotheks-Übung ist danach als Vorlage auffindbar und öffentlich einsehbar.
9. **Enabler (Data) — Bestand überführen:** Alle bestehenden Trainings werden einmalig in Fassungen überführt, einschliesslich Bilddateien; Zuordnungen, deren Übung bereits fehlt, bleiben unter Übernahme des bisher zwischengespeicherten Namens als benannte, inhaltsleere Fassungen erhalten. Die Überführung wird im selben Release wirksam wie Story 4, damit nie zwei Modelle nebeneinander bestehen.

## 7. Non-Functional Requirements

1. Das Übernehmen einer Übung ins Training fühlt sich nicht langsamer an als das heutige Zuordnen und antwortet in unter einer Sekunde.
2. Beim Kopieren einer Bilddatei entsteht keine Qualitätsveränderung und keine erneute serverseitige Bildverarbeitung.
3. Die Überführung des Bestands verändert an bestehenden Trainings nichts Erkennbares ausser der neuen Unabhängigkeit ihrer Inhalte.
4. Die Einführung verschärft keine Regel auf bereits produktiv gespeicherten Daten, ohne dass diese vorher nachweislich bereinigt sind.
5. Der wiederholbare Ladevorgang des Manual-Bestands bleibt nach der Umstellung funktionsfähig und erzeugt keine Fassungen.

## 8. Out of Scope

1. Eine Fassung erhält keine Aktualisierung, wenn sich ihre Vorlage später ändert; es gibt keinen Abgleich und keine Benachrichtigung darüber.
2. Mehrere Fassungen derselben Vorlage werden nicht zusammengeführt und nicht gemeinsam bearbeitet.
3. Eine Bibliotheks-Übung zeigt nicht an, wie oft und in welchen Trainings sie kopiert wurde.
4. Die Herkunftsangabe macht keine Aussage darüber, ob die Vorlage inzwischen geändert wurde.
5. Die Anwendung prüft die Angabe zur Anzahl Kinder einer Fassung nicht gegen deren Bild.
6. Die Alterskategorien-Abgleichswarnung zwischen Training und Übung wird nicht ausgebaut; sie arbeitet auf der Fassung wie bisher auf der Übung.
7. Der kuratierte Manual-Bestand bleibt in der Bibliothek unveränderbar; anpassbar ist ausschliesslich die Fassung im Training.

## 9. Getroffene Entscheide

| Thema | Entscheid | Datum |
|---|---|---|
| Grundsatz | Zuordnen erzeugt ausnahmslos eine eigenständige Fassung — auch bei Manual-Übungen und eigenen Übungen | 2026-08-16 |
| Anpassbarkeit | Eine Fassung ist vollständig anpassbar, einschliesslich Einordnung, Bild und Diagramm | 2026-08-16 |
| Einordnung | Die Abbildungsregel schlägt den Block vor; eine abweichende Einordnung ist frei und erzeugt weder Hinweis noch Sperre (revidiert 2026-08-22, ursprünglich „Hinweis am Training") | 2026-08-16 / 2026-08-22 |
| Ort der Fassung | Die Fassung lebt nur im Training; Katalog, Suche und Favoriten zeigen ausschliesslich Bibliothekseinträge | 2026-08-16 |
| Wiederverwendung | Eine Aktion „in meine Bibliothek übernehmen" macht eine angepasste Fassung zur eigenen Vorlage | 2026-08-16 |
| Herkunft | Unveränderlicher Stempel zum Kopierzeitpunkt; bei Kopien von Kopien und bei Trainingskopien bleibt die ursprüngliche Herkunft stehen; gilt einheitlich auch für Diagramm-Kopien; kein Sprungziel, reine Angabe | 2026-08-16 |
| Herkunfts-Wortlaut | Die Angabe sagt „basiert auf", nicht „ist" — eine bearbeitete Fassung gibt sich nie als Original aus | 2026-08-16 |
| Einordnung vs. Junioren-Regel | Freie Einordnung statt Zwang gilt auch im Junioren-Schema; der Junioren-Entscheid „Unterblock folgt zwingend aus der Übung" ist revidiert (2026-08-22: auch dort kein Hinweis) | 2026-08-16 / 2026-08-22 |
| Publish-Moment | Einmalige Bestätigung mit Klartext-Folgen ersetzt die Übungs-Rückfrage | 2026-08-16 |
| Übernahme-Default | Eine in die Bibliothek übernommene Fassung ist zunächst privat | 2026-08-16 |
| Umstellung | Harte Umstellung: die Überführung des Bestands wird zusammen mit dem neuen Zuordnen ausgeliefert | 2026-08-16 |
| Typologie | Bleibt eine freie Selbstauskunft ohne Konsistenzprüfung gegen die Einordnung | 2026-08-16 |
| Bilder | Die Bilddatei wird physisch mitkopiert; keine geteilten Dateien zwischen Original und Fassung | 2026-08-16 |
| Veröffentlichen | Übung veröffentlichen heisst: als Vorlage freigeben plus öffentliche Detailseite; Training veröffentlichen braucht keine Übungs-Rückfrage mehr | 2026-08-16 |
| Fahrplan-Regel | Vollständigkeit gilt je Hauptteilkategorie; Fussball spielen braucht keinen methodischen Fahrplan, sondern ein Beschreibungsfeld | 2026-08-16 |
| Manual-Qualität | Der Manual-Bestand wird auf Vollständigkeit gemäss der neuen Regel gebracht | 2026-08-16 |
| Picker | Der Übungs-Picker fügt nur hinzu; entfernt wird im Trainings-Editor | 2026-08-16 |
| Kinderzahl | Wird mitkopiert und ist frei anpassbar, ohne Automatik | 2026-08-16 |
| Bestand | Einmalige Überführung aller bestehenden Trainings in Fassungen | 2026-08-16 |
| Reihenfolge | Dieses Epic läuft vor dem Team-Trainingsplan-Epic | 2026-08-16 |

## 10. Aufgehobene Abgrenzungen und geänderte Festlegungen

1. Architektur-Spec (2026-05-31), §9.3: Das Platzhalter-Prinzip für nicht mehr auflösbare Übungen (Verweis mit Namens-Snapshot) wird durch die Fassung ersetzt und entfällt.
2. Epic Trainingsplaner (#8), Erfolgskriterium 9 und Story #14: Die gesamthafte Rückfrage zur Mitveröffentlichung privater Übungen entfällt; ihre Prämisse existiert nicht mehr.
3. Story #9, Acceptance Criteria 9 und 10 (Namens-Cache und Platzhalter-Verhalten): gegenstandslos.
4. Diagramm-Wiederverwendungs-Spike (2026-06-13): Der Entscheid, dass Diagramm-Kopien keinen Bezug zur Quelle tragen, wird zugunsten der einheitlichen Herkunftsangabe korrigiert.
5. Juniorenfussball-Epic (2026-08-14): Der Entscheid, dass jede Heimat-Änderung einer verwendeten Übung alle verwendenden Trainings warnt, wird gegenstandslos — Änderungen an Bibliotheks-Übungen wirken nicht mehr in Trainings. Der Heimat-Mechanismus selbst (eine gepflegte Einordnung, Junioren-Zuordnung abgeleitet) bleibt für Bibliotheks-Übungen bestehen und liefert den Block-Vorschlag beim Übernehmen.
6. Architektur-Spec §3 „Manual-Bestand schreibgeschützt": gilt weiterhin für die Bibliothek, nicht mehr für Fassungen in Trainings.
7. Team-Trainingsplan-Epic (2026-08-16), Entscheid „Herkunft eines übernommenen fremden Trainings wird nicht festgehalten": zurückgenommen; die Herkunft bleibt einheitlich überall sichtbar. Beim Übernehmen eines Trainings werden dessen Fassungen erneut kopiert und behalten ihre ursprüngliche Herkunft.
8. Juniorenfussball-Epic (2026-08-14), Entscheid „Der Unterblock folgt zwingend aus der Übung, kein freies Wählen": revidiert; die Einordnung einer Fassung ist frei, eine Abweichung blockiert nichts und wird nicht gesondert angezeigt (2026-08-22).

## 11. Offene Fragen

1. @UX Designer: Wie wird die Herkunftsangabe an Fassung und Diagramm dargestellt, ohne die Karten und Detailansichten zu überladen?
4. @Product Owner: Wie soll die „Fassung" gegenüber den Nutzern heissen? Der Begriff ist intern; die Oberfläche braucht ein verständliches Wort.
