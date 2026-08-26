# Story: Herkunftsangaben entfernen

**Datum:** 2026-08-25
**Betrifft:** Übungsbibliothek-Epic (`2026-08-16-uebungsbibliothek-epic.md`, Story 6) und Team-Trainingsplan-Epic (`2026-08-16-team-trainingsplan-epic.md`, Stories 1, 5, 8, 11)
**Status:** TEILWEISE UMGESETZT 2026-08-25 — Anzeige und Erfassung entfernt; der Abbau der Datenfelder folgt als zweites Release, damit während der Auslieferung nichts bricht (NFR 1)

---

## Story 1 (Business, Rules) — Herkunftsangaben entfernen

Herkunftsangaben entfernen

Als Trainer
möchte ich an Trainings und Übungen nicht mehr lesen müssen, woraus sie kopiert wurden
damit Karten und Listen nur noch das zeigen, was ich zum Planen brauche

Die Angabe kam mit dem Kopie-Modell: Weil jede Übung in einem Training eine eigenständige, frei änderbare Fassung ist, sollte die Zeile „basiert auf …" verhindern, dass sich eine bearbeitete Fassung als Original ausgibt. In der Anwendung leistet sie das nicht. Eine Kopie trägt zunächst den Namen ihres Ursprungs, und solange niemand umbenennt, wiederholt die Zeile genau den Namen, unter dem sie steht — „Schnell vertikal spielen und hoch stehen, basiert auf Schnell vertikal spielen und hoch stehen". Auf dem Telefon belegt sie dabei zwei bis drei Zeilen je Eintrag und drängt Stufen, Übungszahl und Dauer nach unten. Der Nutzen tritt im Regelfall nicht ein, die Kosten an Platz und Lesbarkeit fallen bei jedem Eintrag an.

Der Bestand wird restlos abgebaut, nicht nur ausgeblendet (PO-Entscheid 2026-08-25). Das weicht bewusst von der Regel ab, auf einer produktiv genutzten Anwendung keine löschenden Migrationen zu fahren, und ist als Einzelfall entschieden: Eine stillgelegte Angabe, die niemand mehr sieht und niemand mehr pflegt, wäre genau die Altlast, die diese Anwendung sich nicht leisten will.

Innerhalb eines Trainings verschwindet damit auch die einzige Angabe, dass eine Übung aus dem SFV-Manual stammt. Eine Plakette dorthin nachzuziehen wurde geprüft und verworfen (PO-Entscheid 2026-08-25): Sie behauptete „das ist Manual-Inhalt", und diese Aussage wird falsch, sobald jemand die Fassung ändert — was er jederzeit darf. Dass veröffentlichte Vorlagen dadurch Inhalte des Manuals ohne Quellenhinweis weitergeben, ist als Folge bekannt und wird vom Product Owner getragen.

Preconditions
Keine.

Acceptance Criteria
1. Der USER sieht an einem Training nicht mehr, woraus es entstanden ist.
2. Der USER sieht an einer Übung innerhalb eines Trainings nicht mehr, woraus sie entstanden ist.
3. Der USER sieht an einer Übung seiner Bibliothek nicht mehr, woraus sie entstanden ist.
4. Der USER sieht weder in seiner Bibliothek noch innerhalb eines Trainings, woraus das Diagramm einer Übung entstanden ist.
5. Der anonyme BESUCHER eines öffentlichen Trainings sieht diese Angaben ebenfalls nicht mehr.
6. Der USER erkennt in der Übungsbibliothek weiterhin, ob eine Übung aus dem Manual stammt.
7. Der USER erkennt weiterhin an einer öffentlichen Vorlage, von wem sie stammt.
8. Der USER kann jede Übung aus einem Training in seine Bibliothek übernehmen.

Postconditions
1. Das SYSTEM führt zu einem Training, einer Übung und einem Diagramm keine Angabe mehr darüber, woraus sie entstanden sind.
2. Das SYSTEM erzeugt keine solche Angabe mehr, WENN der USER ein Training ins Team stellt, zu sich übernimmt, erneut ansetzt, eine Vorlage übernimmt oder veröffentlicht.
3. Das SYSTEM erzeugt keine solche Angabe mehr, WENN der USER eine Übung in ein Training übernimmt, in seine Bibliothek übernimmt oder ein Diagramm aus einer Vorlage übernimmt.
4. Das SYSTEM entfernt die bereits erfassten Angaben vollständig aus dem Bestand.

Out of Scope
1. Die Plakette an den kuratierten Manual-Übungen in der Übungsbibliothek entfällt nicht; dort trifft ihre Aussage weiterhin zu, weil diese Originale unveränderlich sind.
2. Innerhalb eines Trainings entsteht keine Kennzeichnung dafür, dass eine Übung aus dem Manual stammt.
3. Ein Quellenhinweis auf das SFV-Manual an anderer Stelle der Anwendung entsteht nicht.
4. Die Urheber-Angabe an einer öffentlichen Vorlage entfällt nicht; sie nennt eine Person und beantwortet eine andere Frage als die Kopier-Historie.
5. An einer übernommenen Kopie ist nicht mehr erkennbar, von wem die ursprüngliche Vorlage stammte.
6. Das Datum, seit wann ein Team-Training im Team liegt, verschwindet mit der Angabe und wird nicht ersetzt.
7. Ein Ersatz in anderer Form entsteht nicht, weder als Verweis noch als Vermerk noch als Detailangabe an zweiter Stelle.
8. Am Kopie-Modell ändert sich nichts; Kopien bleiben eigenständig und vom Ursprung unabhängig.
9. Die Regel, dass eine veröffentlichte Vorlage unveränderlich ist, bleibt bestehen.

Non-Functional Requirements
1. Weder das Aufrufen noch das Bearbeiten, Kopieren oder Veröffentlichen von Trainings und Übungen scheitert während der Auslieferung, auch nicht in dem Zeitraum, in dem Datenbank und Anwendung nicht denselben Stand tragen.
2. Der Abbau der bestehenden Angaben ist als vollständig nachweisbar und hinterlässt bei einem Abbruch keinen halb abgebauten Zustand.
3. Die Entfernung hinterlässt keine ungenutzten Felder, Bausteine, Prüfregeln oder Textbestandteile.

Offene Fragen
Keine.
