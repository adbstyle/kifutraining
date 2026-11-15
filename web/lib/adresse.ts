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
