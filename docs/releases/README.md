# Release-Texte

Stand: 2026-10-06 (#411)

Jeder Merge nach `main` ist ein Release und bekommt einen GitHub-Release. Sein Titel und
Text erscheinen unverändert in KiFu unter «Versionen» — Trainerinnen und Trainer lesen ihn
also wörtlich. Darum gelten für jeden neuen Release die Regeln unten. Die Vorlage dazu ist
[`vorlage.md`](vorlage.md). Ältere Release-Texte bleiben, wie sie sind.

## Titel

`KiFu X.Y.Z - Thema`. Das Thema nennt die für Trainer:innen wichtigste Änderung, in wenigen
Wörtern («KiFu 1.28.0 - Neuigkeiten in der Seitenleiste»). Bringt der Release nichts
Bemerkbares, nennt das Thema, worum es geht («KiFu 1.28.1 - Sicherheits-Updates»). Der Tag
heisst `vX.Y.Z`.

## Versionsnummer

- Dritte Stelle (`1.28.0` → `1.28.1`): Der Release bringt nur Behobenes, Wissenswertes oder
  Technisches.
- Zweite Stelle (`1.28.1` → `1.29.0`): Der Release bringt Neues oder Verbessertes.
- Die erste Stelle bleibt bei 1, bis der Product Owner anders entscheidet.

## Aufbau

1. **Einleitung**, höchstens zwei Sätze: was sich für Trainer:innen ändert — und, falls
   nötig, was sie selbst tun müssen (etwa den Kalender neu abonnieren oder den KI-Assistenten
   neu verbinden). Bringt der Release nichts, was Trainer:innen bemerken, sagt die Einleitung
   genau das in einem Satz. Keine Zählung des Releases, kein Link auf ki-fu.ch.
2. **Rubriken** in dieser Reihenfolge, je als `### Überschrift`; eine Rubrik ohne Inhalt
   entfällt:
   - `### Neu` — Funktionen, die es vorher nicht gab.
   - `### Verbessert` — Bestehendes, das jetzt besser geht.
   - `### Behoben` — Fehler, die Trainer:innen bemerken konnten.
   - `### Gut zu wissen` — bekannte Grenzen und entfallene Funktionen.
   - `### Technisch` — Änderungen unter der Haube und noch ungeprüfte Punkte.

## Zuordnung

Massstab ist, was Trainer:innen in der Anwendung bemerken. Was sie bemerken, steht unter Neu,
Verbessert oder Behoben — auch wenn es technisch begründet ist (die Seite lädt schneller).
Was sie nicht bemerken, steht unter Technisch (Migrationen, Bibliotheken, Prüfskripte).

## Einträge

- Jeder Eintrag ist ein Listenpunkt aus höchstens zwei Sätzen. Details gehören in die
  Produktdokumentation, nicht in den Release-Text.
- Ein kurzer fetter Anfang darf den Eintrag benennen: `- **Versionen in der Seitenleiste**:
  …`.
- Issue- und PR-Nummern sind erlaubt, in Klammern am Ende (`(#408)`). In KiFu erscheinen sie
  als Text, nicht als Link.
- Eine Sicherheitskorrektur wird benannt («Sicherheitslücken in Bibliotheken geschlossen»),
  aber nie so beschrieben, dass sich daraus ablesen liesse, wie sie sich ausnutzen liess.

## Technisch

Auch diese Rubrik ist für Laien verständlich geschrieben: sagen, was sich hinter den Kulissen
geändert hat und warum, statt Fachwörter aneinanderzureihen. Sie steht bewusst am Schluss.

Ein noch ungeprüfter Punkt beginnt mit **Noch ungeprüft:** und wird in jedem folgenden
Release wieder aufgeführt, bis er geprüft ist. Ein veröffentlichter Release-Text wird dafür
nicht nachträglich geändert.

## Schreibregeln

Wie die Texte der Anwendung:

- Du-Form, auch wenn ein ganzes Team gemeint ist — nicht «euch» oder «ihr».
- Schweizer Schreibung: «ss» statt «ß».
- Anführungszeichen «…».
- Bindestrich «-» statt Gedankenstrich «—» oder «–», auch im Titel.
- Keine Fachbegriffe aus Design-System oder Jira (Lozenge, Section Message, Title Large, Epic,
  Snackbar). Gemeint ist, was Trainer:innen sehen: Plakette, Hinweis, Überschrift, Meldung.
- Produktbegriffe wie in der Anwendung: Übung, Training, Variante, Altersstufe, Team, Termin.

## Ablauf

1. Version in `web/package.json` per eigenem PR auf `develop` anheben (`npm version X.Y.Z
   --no-git-tag-version` in `web/`, damit `package-lock.json` mitzieht).
2. Release-PR `develop` → `main` mit Merge-Commit mergen, nicht squashen.
3. Erst nach bestätigtem Merge den Release anlegen, den Text aus einer Datei:

   ```bash
   gh release create vX.Y.Z --target main --title "KiFu X.Y.Z - Thema" --notes-file release.md
   ```

   `--target` braucht den Branch-Namen, keinen SHA.

Eine automatische Prüfung der Regeln gibt es nicht; wer den Release anlegt, liest den Text
vor dem Veröffentlichen gegen diese Seite.
