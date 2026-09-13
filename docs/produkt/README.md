# Produktdokumentation

Was die Anwendung kann — beschrieben als Zustand, nicht als Auftrag. Diese Sammlung ist die
Antwort auf die Frage „Was geht heute?" für alle, die nicht im Code nachsehen wollen.

| Bereich | Inhalt |
|---|---|
| [Konto und Zugang](konto-und-zugang.md) | Registrieren, Anmelden, Anzeigename, Konto löschen |
| [Übungen](uebungen.md) | Altersstufen, Übungsbestand, eigene Übungen, Feld-Diagramme, Favoriten |
| [Trainings](trainings.md) | Trainings der beiden Altersstufen zusammenstellen, durchführen, drucken, veröffentlichen |
| [Team-Bereich](team-bereich.md) | Trainerteams, Team-Trainings, Termine und Trainingsplan |
| [Was überall gilt](was-ueberall-gilt.md) | Sprache und Region, Erscheinungsbild, Lesbarkeit, Suchen, Drucken, Verhalten im Fehlerfall |

Die letzte Seite ist die Ausnahme von der Gliederung nach Bereichen: Dort steht, was keinem
Bereich allein gehört. Wer etwas Querschnittliches beschreibt, schreibt es dorthin und verweist
aus dem Bereich darauf — nicht umgekehrt, sonst steht dasselbe bald an vier Stellen halb.

## Pflicht zur Aktualisierung

**Landet eine Umsetzung auf Produktion, wird diese Dokumentation im selben Zug aktualisiert.**
Der Auslöser ist der Merge nach `main` — wer ihn vornimmt, verantwortet, dass die betroffenen
Seiten den neuen Zustand beschreiben. Eine Änderung, die auf Produktion sichtbar ist und hier
nicht steht, gilt als unfertig.

Das gilt in beide Richtungen: Neue Fähigkeiten kommen dazu, entfallene verschwinden, und was
sich anders verhält als beschrieben, wird berichtigt. Auch der Abschnitt „Bekannte Grenzen"
gehört gepflegt — er ist oft der ehrlichste Teil einer Seite.

## Verhältnis zu den Stories

Die Stories unter `../superpowers/specs/` sind **Aufträge**. Ist ein Auftrag umgesetzt, wird
er als erledigt markiert und nicht mehr nachgeführt; er beschreibt dann den Stand seiner
Entstehungszeit, nicht den heutigen. Wo Story und Produktdokumentation auseinandergehen, gilt
diese Dokumentation — und wo diese Dokumentation und die Anwendung auseinandergehen, gilt die
Anwendung und diese Seite ist zu berichtigen.

## Nichtfunktionale Anforderungen gehören nicht hierher

Das Querschnittliche verführt dazu, hier Anforderungen abzulegen — „Kontrast mindestens 4.5:1",
„erste Antwort unter einer Sekunde". Das ist die Verwechslung, gegen die diese Sammlung gebaut
ist: Eine Anforderung ist ein **Auftrag**, diese Seiten beschreiben den **Ist-Zustand**. Hierher
gehört „die Schrift ist auf jedem Untergrund lesbar", nicht die Zahl, an der das gemessen wird.

Anforderungen haben zwei bestehende Orte, und ein dritter wäre genau die Ambiguität, die wir
sonst vermeiden:

- **Messbare Ziele** — ein Wert, eine Frist, eine Schwelle — werden als GitHub-Issue erfasst,
  wie jede andere Story auch.
- **Dauerhafte Invarianten**, die für jede künftige Änderung gelten, stehen in der `CLAUDE.md`
  im Repo-Wurzelverzeichnis. Dort wohnen sie schon: forward-only Migrationen, Supabase
  ausschliesslich serverseitig, clientseitige Bildverkleinerung, Styleguide-first.

Ist ein solcher Auftrag umgesetzt und auf Produktion sichtbar, wird sein **Ergebnis** hier
beschrieben — in der Sprache dessen, was eine Trainerin erlebt.

## Stil

Fliesstext, kein Aufzählungs-Stakkato. Keine Dateinamen, keine Technologien, keine
Datenbankbegriffe — beschrieben wird, was eine Trainerin oder ein Trainer erlebt. Jede Seite
beginnt mit einem Stand-Datum und endet mit den bekannten Grenzen.
