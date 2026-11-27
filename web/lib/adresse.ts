/* Adress-Parameter lesen und weiterreichen — die Mechanik der Server-Seiten
   mit Filtern in der Adresse (Übungskatalog, Spieler:innen des Vereins). Das
   Schreiben übernimmt `useAdressFilter`; hier steht, wie eine Seite die
   Parameter liest und die Adresse für «Weitere anzeigen» neu baut. Rein:
   keine Importe aus `next/*`, damit die Prüfskripte sie ohne Server laden. */

export type AdressParameter = Record<string, string | string[] | undefined>;

/** Ein Mehrfachparameter, kommagetrennt (`?kat=E,F`); leere Teile fallen weg. */
export function liesListe(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v.join(",") : v).split(",").filter(Boolean);
}

/** Eine ganze Zahl über 0, sonst `undefined`. */
export function liesPositiveZahl(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  const n = s ? Number.parseInt(s, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Dieselbe Adresse mit den Werten aus `soll` (leer entfernt den Parameter)
 *  — oder `null`, wenn `sp` sie schon trägt. Alles übrige reist unverändert
 *  mit. Mehrfachwerte vergleicht es kommagetrennt, wie `liesListe` sie liest:
 *  die Bereinigung der Seiten mit Filtern (Spielerliste, Teilnahme). */
export function adresseMitWerten(pfad: string, sp: AdressParameter, soll: Record<string, string>): string | null {
  const roh = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(",") : v ?? "");
  if (Object.entries(soll).every(([k, v]) => roh(sp[k]) === v)) return null;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k in soll || v === undefined) continue;
    for (const w of Array.isArray(v) ? v : [v]) p.append(k, w);
  }
  for (const [k, v] of Object.entries(soll)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `${pfad}?${qs}` : pfad;
}

/** Dieselbe Adresse mit allen gesetzten Parametern, nur `anzahl` neu. Alles
 *  ausser `anzahl` reist mit, damit ein künftiger Filter nicht still
 *  verlorengeht; Hinweise wie `?deleted` entfernt der Flash ohnehin selbst. */
export function mitAnzahl(pfad: string, sp: AdressParameter, anzahl: number): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "anzahl" || v === undefined) continue;
    for (const w of Array.isArray(v) ? v : [v]) p.append(k, w);
  }
  p.set("anzahl", String(anzahl));
  return `${pfad}?${p}`;
}
