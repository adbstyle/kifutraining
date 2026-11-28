// Der Umfang eines KI-Zugangs, wie ihn die Erlauben-Seite nennt (#142 AK 2).
//
// Die Seite nennt von Anfang an den VOLLEN künftigen Umfang — auch, was erst
// mit späteren Stories dazukommt (Epic #139 Übungen, Epic #190 Trainings).
// Eine Erweiterung des Werkzeugsatzes verlangt darum keine erneute
// Zustimmung (#142 OoS 4, PO 2026-09-23). Was hier steht, ist Zusage an den
// Trainer; wer den Werkzeugsatz über diese Liste hinaus erweitert, ändert
// zuerst diese Liste. Bleibt die Ergänzung im Rahmen dessen, was das Konto in
// KiFu ohnehin darf, und beschreibt sie nur, was der Zugang über dieselben
// Daten zusätzlich erfährt oder nicht mehr darf, verlangt sie von bestehenden
// Zugängen keine erneute Zustimmung (Vereine: Verein und weitere Teams,
// Herausnehmen statt Löschen; #589 PC 2). Technisch gäbe es dafür auch keinen
// Weg: Der Grant trägt weder Scope noch Fassung dieser Liste.
//
// REIN: keine Server-Importe; die Produktdoku übernimmt denselben Wortlaut.

export const ZUGANG_DARF: readonly string[] = [
  "Übungen suchen und abrufen - den ganzen Bestand, den du auch in KiFu siehst",
  "eigene Übungen samt Feld-Diagramm anlegen, kopieren, ändern, in die Community stellen und zurückziehen",
  "Trainings anlegen, überarbeiten, in die Community stellen, zurückziehen, übernehmen und löschen",
  "Team-Trainings deiner Teams führen und im Kalender deiner Teams Termine und Terminserien samt Platz, Treffpunkt, erwarteter Spielerzahl, Kadern und Mindestbesetzung sowie Spiele mit Bezeichnung, Richtwert, Meldefrist und Treffpunkten festlegen, ändern und entfernen, ihnen als Kopie Trainings aus dem Team oder deine persönlichen Trainings zuordnen und sie wieder lösen, Trainer:innen einladen, ausladen, absagen und wieder zusagen und bestimmen, wer verantwortlich ist, Ausfälle festhalten und zurücknehmen sowie die Termine eines Zeitraums abrufen; bei neuen Spielen, Ausfällen und ihrer Rücknahme, Verlegungen und beim Entfernen jeweils entscheiden, ob die Spielervertretungen am privaten Link benachrichtigt werden",
  "die Anzeigenamen der Mitglieder deiner Teams lesen (ohne E-Mail-Adressen)",
  "die Spielerliste deiner Teams (Vorname, Nachname, Jahrgang, J+S-Nummer) einsehen und führen, dazu den Verein deiner Teams und die Namen weiterer Teams einer Spieler:in sehen, Spieler:innen aus einem deiner Teams nehmen (sie bleiben im Verein), Kader anlegen, umbenennen und entfernen und ihnen Spieler:innen zuteilen, Spieler:innen ins Schnuppertraining nehmen und die Anzahl Schnuppertrainings samt Info-Schreiben festlegen, die Infos zum Team für Spieler:innen und Eltern verfassen, ändern und entfernen, Spieler:innen für Termine ab- und wieder anmelden, für Spiele an- oder abmelden und als nicht aufgeboten kennzeichnen und sehen, wer angemeldet ist, wer an Spielen noch ohne Meldung ist und seit wann, ab Beginn eines Trainings oder Spiels nachtragen, wer nicht oder doch erschienen ist, je Spieler:in sehen, wie oft sie in einem Zeitraum an Trainings und Spielen da war und aus welchem Grund nicht, das für alle Spieler:innen eines Teams vergleichen und sehen, wie früh vor Beginn sie sich ab- und anmelden, den privaten Link einer Spieler:in holen, erneuern und als zugestellt markieren, die Selbstabholung ein- und ausschalten, die Abholadresse holen und erneuern und sehen, welche Links abgeholt oder zugestellt sind",
];

export const ZUGANG_DARF_NICHT: readonly string[] = [
  "deine Favoriten",
  "die Verwaltung deiner Teams und deines Vereins (Verein gründen, umbenennen und löschen, Teams anlegen, umbenennen und auflösen, Personen in Teams oder in die Vereinsverwaltung aufnehmen oder daraus entfernen, Spieler:innen Teams zuordnen, Spieler:innen aus dem Verein löschen und Spielerlisten importieren)",
  "dein Konto selbst (Anzeigename, Passwort, Löschen)",
];

export const ZUGANG_ERWEITERUNG =
  "Einige dieser Fähigkeiten kommen erst nach und nach dazu. Dafür musst du nicht erneut zustimmen.";

/** Der Client nennt seinen Namen selbst; geprüft ist er nicht (Spike #141
 *  AK 7.2). Die Erlauben-Seite ist die einzige Schranke — darum dieser Satz. */
export const ZUGANG_WARNUNG =
  "Den Namen oben hat der Client selbst angegeben. Erlaube nur, wenn du das Verbinden eben selbst gestartet hast.";
