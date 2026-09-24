// Die Regeln des KI-Zugangs (Story #142): Grenzen, Namensregel, Meldungen.
//
// Die Zugänge selbst (Zustimmung, Sitzungen, Widerruf) führt Supabase Auth
// als OAuth-2.1-Server; hier steht nur, was die Anwendung dazu festlegt.
// Zwei Zahlen haben einen SQL-Zwilling — KI_AUFRUFE_JE_STUNDE (`v_grenze` in
// `ki_aufruf_zaehlen()`) und ZUGANGSNAME_MAX (CHECK `kzn_name_laenge`);
// `check:ki-zugang` prüft, dass beide Seiten dieselbe Zahl tragen. Die Grenze
// der Zugänge prüft allein die Anwendung (über `listGrants`).
//
// REIN: keine Server-Importe.

/** Höchstens so viele gleichzeitig gültige Zugänge je Konto (AK 11, PO
 *  2026-09-23). Gezählt wird über die Zustimmungen bei Supabase Auth
 *  (`listGrants`); ein Client, der schon einen Zugang hat, zählt beim erneuten
 *  Erlauben nicht dazu. */
export const KI_ZUGAENGE_MAX = 5;

/** Höchstens so viele Werkzeug-Aufrufe je Konto und Stunde, über ALLE seine
 *  Zugänge zusammen (AK 12, NFR 3; PO 2026-09-23). Ein Konto vervielfacht
 *  seinen Spielraum nicht durch weitere Zugänge.
 *  SQL-Zwilling: `v_grenze` in `ki_aufruf_zaehlen()` (Migration
 *  `ki_zugaenge`). */
export const KI_AUFRUFE_JE_STUNDE = 600;

/** Der eigene Name eines Zugangs (AK 3): höchstens 40 Zeichen — wie der
 *  Anzeigename, damit die Konto-Seite beide gleich behandelt.
 *  SQL-Zwilling: CHECK `kzn_name_laenge` an `ki_zugang_namen`. */
export const ZUGANGSNAME_MAX = 40;

/** Leerraum zusammenziehen und trimmen — so wird der Name gespeichert. Alles,
 *  was kein Text ist (ein fehlender Client-Name, ein direkt geposteter
 *  Action-Aufruf), gilt als leer. */
export function zugangsnameBereinigt(eingabe: unknown): string {
  return typeof eingabe === "string" ? eingabe.replace(/\s+/g, " ").trim() : "";
}

/** Was am eingegebenen Namen nicht stimmt, oder `null`. Leer ist KEIN Fehler:
 *  dann gilt der Name des Clients (PC 2). */
export function zugangsnameProblem(eingabe: unknown): string | null {
  const name = zugangsnameBereinigt(eingabe);
  if (name.length > ZUGANGSNAME_MAX) return `Höchstens ${ZUGANGSNAME_MAX} Zeichen.`;
  return null;
}

/** Der Name, den die Anwendung selbst festhält — oder `null`, wenn der Trainer
 *  keinen eigenen vergeben hat (leer oder wortgleich mit dem Client-Namen).
 *  Dann braucht es keine Zeile: das Konto zeigt den Client-Namen. */
export function eigenerZugangsname(eingabe: unknown, clientName: unknown): string | null {
  const name = zugangsnameBereinigt(eingabe);
  if (!name || name === zugangsnameBereinigt(clientName)) return null;
  return name;
}

/** Was die Konto-Seite zeigt: der eigene Name, sonst der vom Client genannte
 *  (PC 2). Ein Client ohne Namen bleibt nicht namenlos. */
export function zugangsAnzeigename(eigener: string | null, clientName: unknown): string {
  return eigener ?? (zugangsnameBereinigt(clientName) || "Unbenannter Client");
}

type GrantMitClient = { client: { id: string } };

/** Wie viele ANDERE Clients bereits einen Zugang haben — der anfragende zählt
 *  nicht, auch wenn er schon einen hat (erneutes Erlauben ersetzt nur). */
export function andereZugaenge(grants: readonly GrantMitClient[], clientId: string): number {
  return new Set(grants.map((g) => g.client.id).filter((id) => id !== clientId)).size;
}

/** Ist die Grenze für einen NEUEN Zugang dieses Clients erreicht? */
export function grenzeErreicht(grants: readonly GrantMitClient[], clientId: string): boolean {
  return andereZugaenge(grants, clientId) >= KI_ZUGAENGE_MAX;
}

/** Die Kennung einer Anfrage (`authorization_id`) kommt aus der URL und damit
 *  von aussen. Mehr als «nicht leer, nicht absurd lang» lässt sich nicht
 *  prüfen, ohne das Format von Supabase nachzubauen — gültig ist sie erst,
 *  wenn Supabase sie kennt. Eine Regel für Erlauben-Seite und Actions. */
export const ANFRAGE_KENNUNG_MAX = 200;

export function istAnfrageKennung(wert: unknown): wert is string {
  return typeof wert === "string" && wert.length > 0 && wert.length <= ANFRAGE_KENNUNG_MAX;
}

/** Supabase kennt die Anfrage nicht (mehr) — abgelaufen, schon verwendet oder
 *  erfunden. Wortgleich auf der Seite und aus der Action. */
export const MELDUNG_ANFRAGE_UNBEKANNT =
  "Diese Anfrage ist abgelaufen oder unbekannt. Starte das Verbinden in deinem KI-Client neu.";

export const MELDUNG_ZUGAENGE_GRENZE =
  `Dein Konto hat bereits ${KI_ZUGAENGE_MAX} KI-Zugänge. ` +
  "Widerrufe zuerst einen davon im Konto und starte das Verbinden dann neu.";

/** Die Meldung an den KI-Client, wenn die Aufruf-Begrenzung greift (PC 9):
 *  sie nennt Grund und Wartezeit, damit der Assistent nicht blind wiederholt. */
export function meldungGebremst(retryAfterSekunden: number): string {
  const minuten = Math.max(1, Math.ceil(retryAfterSekunden / 60));
  return (
    `Zu viele Aufrufe: Ein Konto darf über alle seine KI-Zugänge zusammen höchstens ` +
    `${KI_AUFRUFE_JE_STUNDE} Werkzeug-Aufrufe je Stunde auslösen. ` +
    `Wieder möglich in etwa ${minuten} ${minuten === 1 ? "Minute" : "Minuten"}.`
  );
}
