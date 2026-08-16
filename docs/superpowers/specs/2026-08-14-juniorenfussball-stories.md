# Stories: Juniorenfussball-Trainingsschema

Stand 2026-08-14. Story-Ausarbeitung zum Epic «Juniorenfussball-Trainingsschema» (`2026-08-14-juniorenfussball-epic.md`). Die Stories werden einzeln analysiert, diskutiert und validiert; dieses Dokument wächst Story für Story.

Faktenlage für Story 1 (aus Quellen- und Bestandsanalyse):

- Bestand: 75 Manual-Übungen — 55 Hauptteil (davon 50 Fussball spielen lernen, 4 Vielseitigkeit erleben, 1 Fussball spielen), 12 Einleitung, 4 Auffangen, 4 Ausklang. Die Pflichtattribute (Trainingsteil, bei Hauptteil die Hauptteilkategorie) sind bei allen 75 gesetzt; optionale Attribute sind lückenhaft (Feldtyp 33 von 75, Material 8 von 75, Varianten 0 von 75, Erscheinungsform nur bei Hauptteil-Übungen).
- Als Eingangsgrössen einer Abbildungsregel trennscharf belegt sind damit nur Trainingsteil und Hauptteilkategorie.
- Das Juniorenschema hat fünf befüllbare Stellen: Aufwärmen und Explosivität im Einstieg, Spielformen und unterstützende Übungen sowie Spiel im Hauptteil, Ausklang im Abschluss. Für Explosivität und Körperstabilität/Prävention (laut J+S Teil des Aufwärmens, Phase 1) gibt es im Kinderfussball-Modell keine Entsprechung.
- Der J+S-Lernbaustein «Der Einstieg» gliedert den Einstieg in drei Phasen mit eigenen Zeitangaben: Aktivierung und Körperstabilität 10–12 Minuten, Spielform zum Trainingsziel 6–8 Minuten, Explosivität 8–10 Minuten.
- Das Manual Fussball Jugendliche kennt keine Kategorien-Differenzierung D/C/B/A; es beschreibt eine einzige Struktur für die FTEM-Stufe Foundation 3.
- Quellen im Projekt: sources/junioren/ (Manual Fussball Jugendliche als PDF, FVBJ-Broschüre, FF14-Ausführungsbestimmungen, zehn J+S-Einstiegs-Übungsblätter). Precondition 1 von Story 1 ist damit erfüllt.
- Am PDF verifiziert: Abbildung 17 beschriftet die Trainingsteile doppelt als EINLEITUNG/EINSTIEG und AUSKLANG/ABSCHLUSS — das Junioren-Manual verwendet die Begriffe synonym. Abbildung 19 bestätigt Einstieg 20–30, Spielformen und unterstützende Übungen 30–45, Spiel 15–20, Ausklang 5–10 Minuten bei Gesamtdauer 90 Minuten; der Broschüren-Wert 45–65 für Spielformen bleibt als PO-Entscheid bestehen.
- Das Manual stellt Übungen nicht in einem einheitlichen Raster dar: Die Spielphasen-Kapitel führen Erscheinungsformen, taktische Prinzipien, Ziele, Coachingpunkte und Entwicklungsfragen auf Kapitel-Ebene und darunter Basisspielform, Spielformen und Übungen nur mit Name, Ablauftext und Spielfeldgrösse. Ein Dauer-Feld gibt es nur im Persönlichkeits-Kapitel, ein Material-Feld nirgends.

Vorgaben des Product Owners an den Spike (entschieden am 2026-08-14):

- Die vier Auffangen-Übungen enden in der Abbildungsregel als «ohne Entsprechung»; sie sind in Junioren-Trainings nicht zuweisbar.
- Der Unterblock Spiel kann Übungen tragen; bleibt er leer, erzeugt das Speichern einen Hinweis, blockiert aber nichts.
- Die Unterblöcke Explosivität und Aufwärmen (inklusive Körperstabilität) müssen über Trainer-Übungen befüllbar sein; der Spike legt fest, wie das ohne Doppelpflege einer Übung geht.
- Zeitbandbreiten gemäss FVBJ-Broschüre (Spielformen und unterstützende Übungen 45–65 Minuten); für die Einstiegs-Phasen gelten die J+S-Werte.

---

## Story 1 (Enabler, Spike): Junioren-Schema und Abbildungsregel klären

Status: Umgesetzt und abgeschlossen am 2026-08-15. Ergebnis: `2026-08-15-junioren-abbildungsregel.md`, vom Product Owner mit datiertem Vermerk abgenommen. Alle zehn Acceptance Criteria sind erfüllt (adversarial gegen Bestand und Quellen-PDFs geprüft).

Als Entwicklungsteam
möchte ich zusammen mit dem Product Owner die Übungs- und Trainingsschemata des Juniorenfussballs sichten und die Abbildungsregel von den Kinderfussball-Attributen einer Übung auf ihre Einordnung im Juniorenschema festlegen
damit die nachfolgenden Modellierungs- und Planer-Stories auf einer abgestimmten fachlichen Grundlage aufbauen

Preconditions

1. Die SFV- und J+S-Quellen zum Juniorenfussball liegen im Projekt vor, einschliesslich des Manuals Fussball Jugendliche als PDF
2. Die Bestandsübungen tragen die Pflichtattribute vollständig

Acceptance Criteria

1. Das TEAM hat die Abbildungsregel dokumentiert, die jeder Übung aus ihren Kinderfussball-Attributen genau eine Einordnung im Juniorenschema zuweist oder sie als ohne Entsprechung ausweist
2. Die Abbildungsregel benennt ihre Eingangsattribute und deren Wertebereiche ausdrücklich, nicht gesetzte Werte eingeschlossen
3. Die Abbildungsregel liefert für jede Kombination dieser Eingangswerte genau ein Ergebnis, ohne Lücke und ohne Überlappung
4. Die Abbildungsregel weist für jeden Unterblock des Juniorenschemas aus, wie er über Übungen befüllbar ist, oder hält mit Verweis auf die Attributlage oder die Quelle fest, warum er über den heutigen Bestand nicht erreichbar ist
5. Das TEAM hat festgelegt, wie ein Trainer eigene Übungen erfasst, die in den Unterblöcken Aufwärmen und Explosivität eingeordnet werden, ohne dass eine Übung doppelt gepflegt wird
6. Das TEAM hat dokumentiert, mit welchen der bestehenden Kinderfussball-Angaben ein Trainer steuert, wo seine Übung im Juniorenschema eingeordnet wird
7. Das TEAM hat die Zeitbandbreiten je Trainingsteil und Unterblock mit Quellenbeleg als Orientierungswerte festgehalten
8. Das TEAM hat den Quellenbeleg für die Einheitlichkeit des Schemas für die Kategorien D bis A im Entscheidungsdokument festgehalten
9. Falls sich keine fachlich tragfähige Abbildungsregel definieren lässt, hat das TEAM die Konsequenzen für das Epic samt Alternativen dokumentiert
10. Der Product Owner hat die Abbildungsregel mit datiertem Vermerk im Entscheidungsdokument abgenommen

Postconditions

1. Das TEAM hat ein Entscheidungsdokument im Projekt abgelegt, das als fachliche Grundlage für die nachfolgenden Stories dient
2. Das TEAM hat offene Punkte dokumentiert, die erst in den Umsetzungs-Stories klärbar sind, einschliesslich der Fragen an die UX-Konzeption
3. Das Entscheidungsdokument benennt, welche bestehenden Architektur- und Dokumentationsaussagen des Projekts durch die Abbildungsregel überholt sind

Out of Scope

1. Das TEAM ändert weder Datenmodell noch Oberfläche, der Spike liefert ausschliesslich Dokumentation und Entscheide
2. Das TEAM baut keinen kuratierten Übungsbestand aus einer Junioren-Quelle auf, auch nicht aus den J+S-Einstiegs-Übungsblättern

Offene Fragen

Keine.

---

Faktenlage für Story 2 (aus der Codebase-Analyse dieser Session):

- Die Alterskategorien G, F, E sind heute an mehreren Stellen unabhängig voneinander hartkodiert: im JSON-Schema der Übungen, in zwei Datenbank-Constraints (Übungen und Trainings), im generierten Vokabular-Modul, in den Klartext-Labels, in der Sortierreihenfolge, in den Farbzuordnungen der Oberfläche und in den Python-Werkzeugen.
- Die Alterskategorien fehlen in der kontrollierten Vokabularquelle `data/vokabular.yaml` — im Widerspruch zum dokumentierten Prinzip der einen Quelle.
- Übungen tragen Alterskategorien als Mehrfachwert; im Bestand kommen die Kombinationen G+F+E (32), F+E (28), nur E (11) und G+F (4) vor. Trainings tragen Alterskategorien ebenfalls als Mehrfachwert.
- Es gibt echte Nutzer; Migrationen sind forward-only, bestehende Zeilen müssen jede Änderung unverändert überstehen.

## Story 2 (Business, Entwurf): Übungen und Trainings mit Alterskategorien D bis A auszeichnen und filtern

Status: Entwurf, konsolidiert aus den früheren Stories 2 und 3, nachdem die Validierung gezeigt hat, dass die Oberfläche neue Vokabularwerte automatisch anbietet und ein reiner Modell-Schnitt einen künstlichen Zwischenzustand erzeugen würde. Blockiert bis zum Abschluss des Spikes: Der Product Owner hat am 2026-08-14 entschieden, nach dem Spike zuerst das Epic mit dem Fachwissen aus dem Manual Fussball Jugendliche erneut zu diskutieren, bevor diese und die folgenden Stories verfeinert werden. In dieser Epic-Diskussion wird auch entschieden, wie der Übergangszustand gemischter Alterskategorien (z.B. E und D am selben Training, bevor die Schema-Regel existiert) behandelt wird.

Als Trainer:in im Juniorenfussball
möchte ich Übungen und Trainings mit den Alterskategorien D bis A auszeichnen und den Übungskatalog danach filtern
damit ich meine Inhalte der richtigen Stufe zuordnen und passende Übungen finden kann

Preconditions

1. Das Entscheidungsdokument des Spikes liegt abgenommen vor

Acceptance Criteria

1. Der USER kann einer Übung jede Teilmenge der Alterskategorien G, F, E, D, C, B und A zuweisen
2. Der USER kann einem Training jede Teilmenge derselben Alterskategorien zuweisen
3. Der USER kann den Übungskatalog nach den neuen Alterskategorien gleichberechtigt mit den bestehenden filtern
4. Das SYSTEM ordnet die Alterskategorien überall in der fachlichen Reihenfolge G, F, E, D, C, B, A
5. Das SYSTEM bezieht alle Alterskategorien aus der einen kontrollierten Vokabularquelle, deren Übereinstimmung mit dem Übungsschema automatisiert nachgewiesen ist

Postconditions

1. Das SYSTEM lässt alle bestehenden Übungen und Trainings nachweislich unverändert gültig, geprüft gegen eine Kopie des Produktionsbestands
2. Das SYSTEM speichert die neuen Werte, ohne dass bestehende Daten angefasst oder zurückgesetzt werden

Out of Scope

1. Das SYSTEM leitet aus den Alterskategorien eines Trainings noch kein Trainingsschema ab; die Misch-Regel liegt in der Schema-Story, wird aber im selben Release ausgeliefert (PO-Entscheid 2026-08-16: kein nutzbarer Zustand mit mischbaren Schemata)

Offene Fragen

1. @UX Designer: Welche Farbe und welches Kurzlabel erhält jede der neuen Alterskategorien in der Oberfläche?
