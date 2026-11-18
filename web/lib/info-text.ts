// Texte von Teams für die Eltern (Info-Schreiben #556, Infos zum Team #598):
// wie die Datenebene sie speichert und zählt — eine Regel für beide.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.

/** Zeilenenden als \n, Leerraum am Anfang und Ende weg, leer = keiner
 *  (Zwilling von `nullif(btrim(replace(…, E'\r\n', E'\n'), E' \t\n\r'), '')`
 *  in `team_probetraining_festlegen` und `team_infos_festlegen`). */
export function infoTextBereinigt(text: string | null | undefined): string | null {
  const t = (text ?? "").replace(/\r\n/g, "\n").replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, "");
  return t === "" ? null : t;
}

/** Zeichen wie `char_length`: Codepunkte, nicht UTF-16-Einheiten. */
export function infoTextLaenge(text: string | null | undefined): number {
  return [...(infoTextBereinigt(text) ?? "")].length;
}
