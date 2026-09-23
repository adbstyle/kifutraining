// Die Regeln eines Termins (Team-Epic Stories 7–9, #198 AK 7/8).
//
// Eine Regelquelle für den Termin-Dialog des Team-Bereichs und die
// KI-Werkzeuge «termin_ansetzen», «termin_aendern» und
// «training_erneut_ansetzen» — der Fachkern (lib/kern/termine.ts) ruft sie vor
// jedem Schreiben auf. Die Meldungen sind wortgleich mit den bisherigen der
// Server Actions.
//
// REIN: keine Importe — `check:kern` lädt diese Datei mit tsx.

export type TerminFelder = {
  datum: string;
  beginn?: string | null;
  ort?: string | null;
  bemerkung?: string | null;
};

/** Leere Eingaben sind „nicht erfasst", nicht „leerer Text". */
export function leerZuNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/** Gibt es diesen Kalendertag? `YYYY-MM-DD` allein genügt nicht: «2026-02-30»
 *  passt auf das Muster und wäre bisher bis in die Datenbank gelangt, die ihn
 *  mit «date/time field value out of range» abweist — an der Oberfläche
 *  hiesse das «Das liess sich nicht speichern», also ein Wiederholen, das nie
 *  gelingt. Über das native Datumsfeld der Oberfläche ist so ein Tag nicht
 *  eingebbar, über den KI-Client dagegen jederzeit. Das Jahr 0000 kennt
 *  Postgres ebenfalls nicht. */
function gibtEsDenTag(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (j < 1 || mo < 1 || mo > 12 || t < 1) return false;
  // Der letzte Tag des Monats: Tag 0 des Folgemonats (UTC, ohne Zeitzone).
  const letzter = new Date(Date.UTC(j, mo, 0)).getUTCDate();
  return t <= letzter;
}

/** Eine Uhrzeit `HH:MM` innerhalb eines Tages. «25:99» passt auf das Muster,
 *  die `time`-Spalte weist es aber ab — dieselbe Begründung wie beim Datum.
 *  «24:00» nimmt Postgres zwar an, als Beginn einer Einheit ist es aber kein
 *  sinnvoller Wert, und das Zeitfeld der Oberfläche kennt es nicht. */
function gibtEsDieUhrzeit(hhmm: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/** Was an den Feldern eines Termins nicht stimmt, sonst `null`. `feld` ist der
 *  Eingabename des KI-Werkzeugs (Kern-Konvention, lib/kern/ergebnis.ts).
 *
 *  `YYYY-MM-DD` und `HH:MM` liefern die nativen Felder der Oberfläche; alles
 *  andere ist ein manipulierter Aufruf oder eine Eingabe des KI-Clients und
 *  wird hier abgewiesen statt in der DB. Ort und Bemerkung sind frei. */
export function terminProblem(f: {
  datum?: string | null;
  beginn?: string | null;
}): { feld: "datum" | "beginn"; text: string } | null {
  if (!gibtEsDenTag(f.datum ?? "")) return { feld: "datum", text: "Bitte ein Datum angeben." };
  const beginn = leerZuNull(f.beginn);
  if (beginn && !gibtEsDieUhrzeit(beginn))
    return { feld: "beginn", text: "Bitte eine gültige Uhrzeit angeben." };
  return null;
}
