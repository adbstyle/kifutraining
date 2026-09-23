// Das Ergebnis- und Fehlerprotokoll des Fachkerns (Spike #191 AK 1, Epic #190).
//
// Der Kern nimmt einen Client entgegen, der bereits als Nutzer spricht (Cookie-
// Session oder OAuth-Bearer), und tut nur Fachliches. Sein Ergebnis ist darum
// weder ein Redirect noch ein FormState noch ein MCP-Ergebnis, sondern diese
// eine Form, die beide Adapter — Server Action und MCP-Werkzeug — übersetzen.
//
// REIN: keine Importe aus `next/*`, `server-only` oder Datenbank-Modulen —
// die Prüfskripte (`tsx scripts/pruefe-*.ts`) laden diese Datei ohne Server.
import type { Bedingung, FehlendeBedingung } from "@/lib/training-bedingungen";

/** Wie ein Fehler einzuordnen ist — damit der Assistent weiss, ob er die
 *  Eingabe korrigieren, eine Regel beachten, wiederholen oder aufgeben soll.
 *
 *  - `eingabe`: Form oder Wertebereich (leerer Name, 41 Zeichen, falsches Datum).
 *  - `regel`: Fachregel (Block passt nicht, Auffangen ohne Dauer, Team-Training
 *    nicht veröffentlichbar). `zulaessig` nennt, wo es sie gibt, die Werte.
 *  - `bedingung`: das Veröffentlichungs-Gate; trägt `bedingung`, `varianteId`,
 *    `fehlend`.
 *  - `nicht_gefunden`: die Kennung ist für dieses Konto nicht sichtbar. Ob sie
 *    nicht existiert oder jemand anderem privat gehört, bleibt bewusst
 *    ununterscheidbar (#193 OoS 7).
 *  - `keine_rechte`: sichtbar, aber nicht bearbeitbar — ein fremdes
 *    öffentliches Training (PO 2026-09-23: eigene Meldung erlaubt, sie verrät
 *    nichts, was nicht ohnehin öffentlich ist).
 *  - `konflikt`: Nebenläufigkeit, etwa zwei Zuordnungen auf dieselbe Position;
 *    `wiederholbar: true` — nochmals senden genügt (#192 NFR 5).
 *  - `gebremst`: Aufruf-Begrenzung je Konto (#142 AK 12); `retryAfter` in
 *    Sekunden.
 *  - `technisch`: unerwartet; der Rohtext steht im Server-Log, nie hier. */
export type FehlerArt =
  | "eingabe"
  | "regel"
  | "bedingung"
  | "nicht_gefunden"
  | "keine_rechte"
  | "konflikt"
  | "gebremst"
  | "technisch";

export type KernFehler = {
  ok: false;
  /** Fertige, wortgleich mit der Oberfläche formulierte Meldung. Nie ein
   *  roher Datenbank- oder Bibliothekstext. Heisst im MCP-Ergebnis gleich
   *  (`structuredContent.fehler.meldung`). */
  meldung: string;
  art: FehlerArt;
  /** Das betroffene Eingabefeld, wo es eines gibt (`name`, `stufen`, …). */
  feld?: string;
  /** Die zulässigen Werte, wo eine Aufzählung die Korrektur ohne Rückfrage
   *  erlaubt (Epic-NFR 3). */
  zulaessig?: readonly string[];
  /** Nur bei `art: "bedingung"`: die verletzte Veröffentlichungs-Bedingung
   *  (aus dem DB-Marker) samt Variante — der Editor spitzt die Meldung damit
   *  auf Variante und Block zu (#204 AK 3). */
  bedingung?: Bedingung;
  varianteId?: string;
  /** Nur beim Veröffentlichen: ALLE fehlenden Bedingungen, nicht nur die erste
   *  (#196 NFR 2). */
  fehlend?: FehlendeBedingung[];
  /** `true`, wenn ein unveränderter zweiter Versuch Erfolg verspricht. */
  wiederholbar?: boolean;
  /** Nur bei `art: "gebremst"`: Sekunden bis zum nächsten möglichen Aufruf. */
  retryAfter?: number;
  /** Zusatz nur für den Assistenten (die Oberfläche zeigt ihn nie), etwa
   *  «Es ist keine Kopie entstanden.» */
  hinweis?: string;
};

export type KernErgebnis<T = undefined> = { ok: true; wert: T } | KernFehler;

export function ok<T>(wert: T): KernErgebnis<T> {
  return { ok: true, wert };
}

export function fehlschlag(
  art: FehlerArt,
  meldung: string,
  extra: Omit<Partial<KernFehler>, "ok" | "art" | "meldung"> = {},
): KernFehler {
  return { ok: false, art, meldung, ...extra };
}

/** Die Standard-Texte für «nicht sichtbar», je Gegenstand. Heute nur die
 *  Übung (#142); Training, Fassung, Gruppe, Termin und Team kommen mit den
 *  Werkzeugen aus #192 ff. dazu — wortgleich mit den bisherigen Meldungen der
 *  Server Actions. */
export const NICHT_GEFUNDEN = {
  uebung: "Diese Übung gibt es nicht oder sie ist für dein Konto nicht sichtbar.",
} as const;
