// Sichere Rücksprung-Ziele nach der Anmeldung.
//
// Der Login trägt sein Ziel im Parameter `redirect`, die Auth-Callbacks in
// `next`. Bisher genügte `startsWith("/")` — das lässt `//evil.example` durch,
// und Browser machen aus `/\evil` und `/<TAB>/evil` ebenfalls ein `//evil`.
// Mit dem Erlauben-Ablauf für KI-Clients (#142) wird der Weg über den Login
// öffentlich beworben; darum hier die eine, geprüfte Regel für alle Stellen.
//
// REIN: ohne Server-Importe, damit `check:ki-zugang` sie prüfen kann.

/** Nur relative Pfade dieser Anwendung; alles andere fällt auf `rueckfall`. */
export function sichererRuecksprung(roh: unknown, rueckfall = "/"): string {
  const v = typeof roh === "string" ? roh : "";
  if (!v.startsWith("/") || v.startsWith("//")) return rueckfall;
  // Steuerzeichen und Backslash: Browser normalisieren sie zu Trennzeichen.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(v)) return rueckfall;
  return v;
}

/** Die Login-Adresse für einen geschützten Pfad: Der Rücksprung trägt Pfad UND
 *  Abfrage (`?termin=…`, `?meine=1`), die Login-Adresse selbst sonst
 *  nichts — dort bedeutet etwa `?error` etwas. */
export function loginAdresse(pfad: string, abfrage: string): string {
  return `/login?${new URLSearchParams({ redirect: pfad + abfrage })}`;
}

/** Übungen und Trainings gibt es nur mit Konto (#669): Katalog, Übung,
 *  Trainingsübersicht und Training samt Druck, Durchführen und Diagramm.
 *  Wer ohne Anmeldung einen Verweis darauf öffnet, landet auf der Startseite
 *  mit einem Hinweis (PC 1). Die Durchsetzung bleibt die RLS (nur
 *  `authenticated` liest). Der Vergleich endet am Pfadsegment. */
export const NUR_MIT_KONTO_PRAEFIXE = ["/uebungen", "/uebung", "/trainings", "/training"] as const;

/** Der Parameter, an dem die Startseite den Hinweis erkennt. */
export const NUR_MIT_KONTO_PARAMETER = "nur_mit_konto";

export function istNurMitKonto(pfad: string): boolean {
  return NUR_MIT_KONTO_PRAEFIXE.some((p) => pfad === p || pfad.startsWith(p + "/"));
}

/** Die Startseite mit Hinweis; der Rücksprung trägt Pfad UND Abfrage, damit
 *  die Anmeldung von dort zum Ziel des Verweises führt (PC 2). */
export function nurMitKontoAdresse(pfad: string, abfrage: string): string {
  return `/?${new URLSearchParams({ [NUR_MIT_KONTO_PARAMETER]: "1", redirect: pfad + abfrage })}`;
}

/** Die Abfrage einer Seite aus ihren Suchparametern, samt «?» (leer ohne
 *  Parameter) — für `loginAdresse`, wo eine Seite statt der Middleware zur
 *  Anmeldung schickt. Mehrfache Werte bleiben in ihrer Reihenfolge. */
export function abfrageAus(sp: Record<string, string | string[] | undefined>): string {
  const abfrage = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    for (const w of Array.isArray(v) ? v : v === undefined ? [] : [v]) abfrage.append(k, w);
  }
  const text = abfrage.toString();
  return text ? `?${text}` : "";
}

/** Anmelden und Registrieren sind für Angemeldete nichts mehr (PO 2026-11-23):
 *  Ein leeres Formular wirkte wie abgemeldet und lüde zu einem zweiten Konto
 *  ein. Wohin sie stattdessen führen — `/login` zum sicheren Ziel aus
 *  `redirect` (wie nach einer Anmeldung), sonst und von `/registrieren` auf
 *  «/» und damit in den Arbeitsbereich (#671). `null` für alle anderen Pfade.
 *  Ein Ziel, das selbst wieder Anmelden oder Registrieren wäre, fällt auf «/». */
export const ANMELDE_SEITEN = ["/login", "/registrieren"] as const;

export function angemeldetWeiter(pfad: string, abfrage: URLSearchParams): string | null {
  if (!(ANMELDE_SEITEN as readonly string[]).includes(pfad)) return null;
  const ziel = pfad === "/login" ? sichererRuecksprung(abfrage.get("redirect")) : "/";
  const zielPfad = ziel.split(/[?#]/)[0];
  return (ANMELDE_SEITEN as readonly string[]).includes(zielPfad) ? "/" : ziel;
}
