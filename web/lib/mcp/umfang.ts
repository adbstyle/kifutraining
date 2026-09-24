// Der Umfang eines KI-Zugangs, wie ihn die Erlauben-Seite nennt (#142 AK 2).
//
// Die Seite nennt von Anfang an den VOLLEN künftigen Umfang — auch, was erst
// mit späteren Stories dazukommt (Epic #139 Übungen, Epic #190 Trainings).
// Eine Erweiterung des Werkzeugsatzes verlangt darum keine erneute
// Zustimmung (#142 OoS 4, PO 2026-09-23). Was hier steht, ist Zusage an den
// Trainer; wer den Werkzeugsatz über diese Liste hinaus erweitert, muss zuerst
// diese Liste ändern — und damit die Frage nach erneuter Zustimmung stellen.
//
// REIN: keine Server-Importe; die Produktdoku übernimmt denselben Wortlaut.

export const ZUGANG_DARF: readonly string[] = [
  "Übungen suchen und abrufen — den ganzen Bestand, den du auch in KiFu siehst",
  "eigene Übungen samt Feld-Diagramm anlegen und ändern",
  "Trainings anlegen, überarbeiten, veröffentlichen, zurückziehen, übernehmen und löschen",
  "Team-Trainings deiner Teams führen und auf Termine ansetzen",
];

export const ZUGANG_DARF_NICHT: readonly string[] = [
  "deine Favoriten",
  "die Verwaltung deiner Teams (gründen, umbenennen, Mitglieder aufnehmen oder entfernen)",
  "dein Konto selbst (Anzeigename, Passwort, Löschen)",
];

export const ZUGANG_ERWEITERUNG =
  "Einige dieser Fähigkeiten kommen erst nach und nach dazu. Dafür musst du nicht erneut zustimmen.";

/** Der Client nennt seinen Namen selbst; geprüft ist er nicht (Spike #141
 *  AK 7.2). Die Erlauben-Seite ist die einzige Schranke — darum dieser Satz. */
export const ZUGANG_WARNUNG =
  "Den Namen oben hat der Client selbst angegeben. Erlaube nur, wenn du das Verbinden eben selbst gestartet hast.";
