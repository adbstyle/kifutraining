// Die Antworten der RPCs zum Gründen und Löschen von Verein und Konto (Epic
// Vereine #575, Story #587), auf ihre Form geprüft.
//
// Die Datenebene antwortet mit `jsonb`; der Verein-Kern (lib/kern/verein.ts)
// verlässt sich nicht darauf, dass es so aussieht, wie der Vertrag sagt:
// Passt die Antwort nicht, ist das ein technischer Fehler, keine halbe
// Auskunft (Muster `vorschauAus` in lib/spieler-import.ts). Die Prüfung liegt
// hier, rein, damit `check:kern` sie ohne Datenbank durchläuft.
//
// REIN: keine Server-Importe.

const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const istText = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const istZahl = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0;

/** Ein Bild, das mit dem Verein verschwindet: Kennung der Fassung und Adresse
 *  im Speicher (`null`, wenn die Zeile keines trug). Der Aufrufer räumt den
 *  Speicher (`eigeneBildPfade` + `raeumeVerwaisteBilder`). */
export type VereinBild = { id: string; bild_url: string | null };

/** Die Bilder einer Antwort; `null`, wenn die Form nicht stimmt. */
function bilderAus(x: unknown): VereinBild[] | null {
  if (!Array.isArray(x)) return null;
  const bilder: VereinBild[] = [];
  for (const b of x) {
    if (!istObjekt(b) || !istText(b.id) || !(b.bild_url === null || typeof b.bild_url === "string")) return null;
    bilder.push({ id: b.id, bild_url: b.bild_url });
  }
  return bilder;
}

// ── Gründen ─────────────────────────────────────────────────────────────────

/** Der gegründete Verein. */
export type Gruendung = { id: string; name: string };

/** `verein_gruenden` → `{status:'gegruendet', id, name}`; sonst `null`. */
export function gruendungAus(antwort: unknown): Gruendung | null {
  if (!istObjekt(antwort) || antwort.status !== "gegruendet" || !istText(antwort.id) || !istText(antwort.name)) return null;
  return { id: antwort.id, name: antwort.name };
}

// ── Vereinbarung zur Auftragsbearbeitung (#675) ─────────────────────────────

/** Die Vereinbarung des Vereins für seine Verwaltung: die geltende Fassung
 *  und die festgehaltene Zustimmung (`null` bei Vereinen von vor #675). */
export type VereinVereinbarung = { geltend: string; zustimmung: { fassung: string; am: string } | null };

/** `verein_vereinbarung` → `{geltend, zustimmung: {fassung, am} | null}`; sonst `null`. */
export function vereinbarungAus(antwort: unknown): VereinVereinbarung | null {
  if (!istObjekt(antwort) || !istText(antwort.geltend)) return null;
  const z = antwort.zustimmung;
  if (z === null) return { geltend: antwort.geltend, zustimmung: null };
  if (!istObjekt(z) || !istText(z.fassung) || !istText(z.am) || Number.isNaN(Date.parse(z.am))) return null;
  return { geltend: antwort.geltend, zustimmung: { fassung: z.fassung, am: z.am } };
}

// ── Verein löschen ──────────────────────────────────────────────────────────

/** Der Ausgang von `verein_loeschen`: gelöscht (mit dem Namen und den Bildern,
 *  die der Aufrufer aus dem Speicher räumt) oder der Name stimmte nicht — dann
 *  steht der aktuelle Name da, und nichts ist gelöscht. */
export type VereinLoeschAusgang =
  | { status: "geloescht"; name: string; bilder: VereinBild[] }
  | { status: "vereinsname_falsch"; name: string };

/** `verein_loeschen` → `{status:'geloescht', name, bilder}` oder
 *  `{status:'vereinsname_falsch', name}`; sonst `null`. */
export function vereinLoeschAusgangAus(antwort: unknown): VereinLoeschAusgang | null {
  if (!istObjekt(antwort) || !istText(antwort.name)) return null;
  if (antwort.status === "vereinsname_falsch") return { status: "vereinsname_falsch", name: antwort.name };
  if (antwort.status !== "geloescht") return null;
  const bilder = bilderAus(antwort.bilder);
  return bilder ? { status: "geloescht", name: antwort.name, bilder } : null;
}

// ── Konto löschen ───────────────────────────────────────────────────────────

/** Der Ausgang von `delete_account` (alle vier Antworten des Vertrags):
 *  `letzte_verwaltung`: weitere Personen im Verein, nichts gelöscht;
 *  `verein_bestaetigen`: die einzige Person im Verein, der Name fehlt;
 *  `vereinsname_falsch`: die einzige Person, der Name stimmt nicht (`name`: der
 *  aktuelle). `bilder` ist leer, wenn kein Verein mitging. */
export type KontoLoeschAusgang =
  | { status: "geloescht"; bilder: VereinBild[] }
  | { status: "letzte_verwaltung" }
  | { status: "verein_bestaetigen"; verein: string; teams: number; spieler: number }
  | { status: "vereinsname_falsch"; name: string };

export function kontoLoeschAusgangAus(antwort: unknown): KontoLoeschAusgang | null {
  if (!istObjekt(antwort)) return null;
  switch (antwort.status) {
    case "geloescht": {
      const bilder = bilderAus(antwort.bilder);
      return bilder ? { status: "geloescht", bilder } : null;
    }
    case "letzte_verwaltung":
      return { status: "letzte_verwaltung" };
    case "verein_bestaetigen":
      return istText(antwort.verein) && istZahl(antwort.teams) && istZahl(antwort.spieler)
        ? { status: "verein_bestaetigen", verein: antwort.verein, teams: antwort.teams, spieler: antwort.spieler }
        : null;
    case "vereinsname_falsch":
      return istText(antwort.name) ? { status: "vereinsname_falsch", name: antwort.name } : null;
    default:
      return null;
  }
}

/** Wie sich das Löschen des Kontos zum Verein verhält (`konto_loeschen_info`):
 *  `frei` — das Konto geht allein, ein Verein bleibt bestehen (oder es gibt
 *  keinen); `letzte_verwaltung` — es ist die letzte Person der Verwaltung, und
 *  weitere gehören dem Verein an; `einzige_person` — es ist die einzige Person
 *  im Verein, der mit dem Konto verschwände (Zahlen von Teams und
 *  Spieler:innen). */
export type KontoLoeschInfo =
  | { fall: "frei" }
  | { fall: "letzte_verwaltung"; verein: string }
  | { fall: "einzige_person"; verein: string; teams: number; spieler: number };

/** `konto_loeschen_info` → `{fall, verein, teams, spieler}`; die Zahlen stehen
 *  immer da (0, wo sie nicht gelten), `verein` bei den letzten beiden Fällen. */
export function kontoInfoAus(antwort: unknown): KontoLoeschInfo | null {
  if (!istObjekt(antwort) || !istZahl(antwort.teams) || !istZahl(antwort.spieler)) return null;
  if (antwort.fall === "frei") return { fall: "frei" };
  if (!istText(antwort.verein)) return null;
  if (antwort.fall === "letzte_verwaltung") return { fall: "letzte_verwaltung", verein: antwort.verein };
  if (antwort.fall === "einzige_person")
    return { fall: "einzige_person", verein: antwort.verein, teams: antwort.teams, spieler: antwort.spieler };
  return null;
}
