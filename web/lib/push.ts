// Mitteilungen aufs Mobile (Epic #482, Story #483).
//
// REIN: keine Importe aus `next/*`, `server-only` oder Datenbank-Modulen —
// Seite (Client), Route, Fachkern und Prüfskripte laden diese Datei. Hier
// stehen die Regeln mit SQL-Zwilling (Migration
// 20261120100000_push_mitteilungen.sql), der Inhalt einer Mitteilung und die
// Texte. Begriff durchgängig «Mobile», nie «Handy».
import {
  eintragWann,
  eintragWo,
  eintragWort,
  eintragZusaetze,
  type LinkBenachrichtigung,
} from "@/lib/benachrichtigung";
import { genitiv } from "@/lib/app-ablegen";

/** Höchstens so viele Geräte je Spieler:in (AK 5, PO). SQL-Zwilling: Trigger
 *  `push_abos_grenze` (`>= 10`). */
export const PUSH_MAX_GERAETE = 10;

/** So lange hält der Mitteilungsdienst eine Mitteilung für ein Gerät, das
 *  gerade nicht erreichbar ist (24 h). SQL-Zwilling:
 *  `push_auftraege_aufraeumen` (`interval '24 hours'`). */
export const PUSH_TTL_SEKUNDEN = 24 * 60 * 60;

/** Nach so vielen gescheiterten Versuchen fällt ein Auftrag weg. SQL-Zwilling:
 *  `push_auftraege_melden` und `push_auftraege_aufraeumen` (`versuche >= 5`). */
export const PUSH_MAX_VERSUCHE = 5;

/** Wie viele Aufträge die Route je Runde holt; höchstens 200 (SQL). */
export const PUSH_ANZAHL_JE_RUNDE = 50;

/** Wie lange die Route auf einen Mitteilungsdienst wartet (web-push bricht
 *  die Anfrage danach selbst ab). */
export const PUSH_TIMEOUT_MS = 5000;

/** Die Notbremse des Abarbeiters gegen einen Sender, der nie antwortet —
 *  bewusst länger als `PUSH_TIMEOUT_MS`, damit sie nie «fehler» meldet,
 *  während web-push noch zustellt (sonst käme die Mitteilung doppelt). */
export const PUSH_ZEITLIMIT_MS = 2 * PUSH_TIMEOUT_MS;

/** Die Mitteilungsdienste, an die KiFu zustellt: Google (auch Samsung und
 *  Opera), Apple, Mozilla, Microsoft. SQL-Zwilling: Check
 *  `push_abos_endpunkt`. Andere Adressen nimmt KiFu nicht an (keine Anfragen
 *  der Route an beliebige Hosts). */
export const PUSH_ENDPUNKT =
  /^https:\/\/(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)\//;

/** Höchstlänge einer Adresse. SQL-Zwilling: `length(endpoint) <= 1024`. */
export const PUSH_ENDPUNKT_MAX = 1024;

/** Die Schlüssel eines Browsers (base64url). SQL-Zwillinge: Checks
 *  `push_abos_p256dh` und `push_abos_auth`. */
const P256DH = /^[A-Za-z0-9_-]{86,88}={0,2}$/;
const AUTH = /^[A-Za-z0-9_-]{21,24}={0,2}$/;

/** Was der Browser beim Einschalten liefert (`PushSubscription.toJSON()`). */
export type PushAbo = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Ob eine Anmeldung des Browsers so aussieht, wie die Datenebene sie annimmt. */
export function istPushAbo(x: unknown): x is PushAbo {
  if (!x || typeof x !== "object") return false;
  const { endpoint, keys } = x as Record<string, unknown>;
  if (typeof endpoint !== "string" || endpoint.length > PUSH_ENDPUNKT_MAX || !PUSH_ENDPUNKT.test(endpoint)) return false;
  if (!keys || typeof keys !== "object") return false;
  const { p256dh, auth } = keys as Record<string, unknown>;
  return typeof p256dh === "string" && P256DH.test(p256dh) && typeof auth === "string" && AUTH.test(auth);
}

/** Ob eine Adresse eines bekannten Diensts ist (zum Ausschalten und für den Stand). */
export function istPushEndpunkt(x: unknown): x is string {
  return typeof x === "string" && x.length <= PUSH_ENDPUNKT_MAX && PUSH_ENDPUNKT.test(x);
}

/** Ein Auftrag, wie `push_auftraege_holen` ihn liefert. `link` ist der
 *  private Link — er steht nur in der verschlüsselten Mitteilung, nie im Log. */
export type PushAuftrag = {
  id: string;
  versuche: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  vorname: string;
  link: string;
  eintrag: LinkBenachrichtigung;
};

/** Was die Route an `push_auftraege_melden` zurückgibt. */
export type PushErgebnis = "zugestellt" | "weg" | "fehler";

/** Die Antwort eines Mitteilungsdiensts einordnen: 2xx zugestellt; 404 und
 *  410 heissen, das Gerät nimmt nichts mehr an (PC 4); alles andere ist ein
 *  Fehler, der später noch einmal versucht wird. */
export function pushErgebnis(status: number | null): PushErgebnis {
  if (status !== null && status >= 200 && status < 300) return "zugestellt";
  if (status === 404 || status === 410) return "weg";
  return "fehler";
}

/** Was im Service Worker als Mitteilung erscheint. */
export type Mitteilung = { titel: string; text: string; url: string; tag: string };

/** Höchstlänge des Texts einer Mitteilung — das Mobile kürzt ohnehin. */
export const MITTEILUNG_TEXT_MAX = 240;

/** Der Teil des Titels eines Eintrags ohne das Team: das Spiel mit seiner
 *  Bezeichnung, sonst «Spiel» oder «Training» (eine Serienänderung betrifft
 *  Trainings). */
function wasText(e: LinkBenachrichtigung): string {
  if (e.ereignis === "serie") return "Training";
  return e.inhalt.art === "spiel" ? (e.inhalt.bezeichnung ?? "Spiel") : "Training";
}

/** Die Mitteilung zu einer Benachrichtigung (AK 8, 9): Titel = Ereigniswort
 *  und Team («Neues Spiel · E-Junioren»), Text = Vorname, dann was, wann, wo
 *  und die Zusätze (etwa der Grund eines Ausfalls). Antippen öffnet die
 *  Benachrichtigungen am privaten Link — die Adresse ist relativ; der
 *  Service Worker öffnet sie nur innerhalb des Links. */
export function mitteilungInhalt({ vorname, link, eintrag }: { vorname: string; link: string; eintrag: LinkBenachrichtigung }): Mitteilung {
  const teile = [wasText(eintrag), eintragWann(eintrag), eintragWo(eintrag), ...eintragZusaetze(eintrag)].filter(
    (x): x is string => !!x,
  );
  let text = `${vorname}: ${teile.join(" · ")}`;
  if (text.length > MITTEILUNG_TEXT_MAX) text = `${text.slice(0, MITTEILUNG_TEXT_MAX - 1).trimEnd()}…`;
  return {
    titel: `${eintragWort(eintrag)} · ${eintrag.inhalt.team}`,
    text,
    url: `/abmelden/${link}?ansicht=benachrichtigungen`,
    tag: eintrag.id,
  };
}

/** Der Bereich des Service Workers eines Links: derselbe wie der des
 *  Manifests (#650), also je Spieler:in eine eigene Anmeldung beim
 *  Mitteilungsdienst — Geschwister auf demselben Mobile teilen keine. */
export const pushBereich = (link: string) => `/abmelden/${link}`;

/** Der Pfad des Service Workers (eine Datei für alle Links). */
export const SERVICE_WORKER_PFAD = "/abmelden/sw.js";

/** Der Stand am Gerät (AK 3, 6, OoS 7). */
export type MitteilungenStand =
  | "laedt"
  | "aus"
  | "an"
  /** iPhone im Safari-Tab: nur in der abgelegten App. */
  | "ios_browser"
  /** Das Mobile lässt keine Mitteilungen zu (abgelehnt). */
  | "abgelehnt"
  /** Dieser Browser kann keine Mitteilungen von Webseiten. */
  | "nicht_moeglich";

/** Die Texte der Glocken-Ansicht und des Dialogs (AK 1–7). */
export const MITTEILUNGEN_TEXT = {
  titel: "Mitteilungen aufs Mobile",
  schalter: (vorname: string) => `Mitteilungen für ${vorname} auf diesem Gerät`,
  stand: {
    laedt: "Wird geprüft …",
    aus: "Aus. Neues siehst du nur hier.",
    an: "Auf diesem Gerät eingeschaltet. Andere Mobiles schaltest du dort ein.",
    ios_browser: "Auf dem iPhone nur in der abgelegten App.",
    abgelehnt: "Dein Mobile lässt keine Mitteilungen zu.",
    nicht_moeglich: "Dieser Browser lässt keine Mitteilungen zu. Öffne den Link im Browser deines Mobiles, etwa in Safari oder Chrome.",
  } satisfies Record<MitteilungenStand, string>,
  /** AK 3: was auf dem iPhone zu tun ist. */
  iosHinweis: (vorname: string) =>
    `Lege diese Seite als App auf den Home-Bildschirm und öffne ${genitiv(vorname)} Termine dort. In der App schaltest du die Mitteilungen hier ein.`,
  soGehts: "So geht’s",
  /** Abgelehnt: wo man es wieder erlaubt. */
  abgelehntHinweis:
    "Erlaube in den Einstellungen deines Mobiles Mitteilungen für diese Seite bzw. die abgelegte App. Danach kannst du sie hier einschalten.",
  // ── Vor dem Einschalten (AK 2) ──
  dialogTitel: (vorname: string) => `Mitteilungen für ${vorname} einschalten`,
  dialogEinleitung: (vorname: string) =>
    `Zu jeder Benachrichtigung für ${vorname} erhält dieses Gerät eine Mitteilung, etwa zu einem neuen Spiel oder einem Ausfall.`,
  speichertTitel: "Was KiFu speichert",
  speichert:
    "Eine Adresse, über die dieses Gerät Mitteilungen erhält, zusammen mit dem Link. Keine Telefonnummer, keine E-Mail-Adresse.",
  zustellerTitel: "Wer zustellt",
  zusteller:
    "Der Mitteilungsdienst des Geräteherstellers, etwa Apple, Google oder Mozilla, auch über Server im Ausland. Den Inhalt einer Mitteilung erhält er verschlüsselt.",
  verschwindetTitel: "Wann es verschwindet",
  verschwindet: (vorname: string) =>
    `Wenn du die Mitteilungen hier ausschaltest, wenn das Gerät keine mehr annimmt, wenn das Team den Link erneuert oder wenn ${vorname} nicht mehr im Verein ist.`,
  abbrechen: "Abbrechen",
  einschalten: "Einschalten",
  // ── Meldungen ──
  grenze: (vorname: string) =>
    `Für ${vorname} sind schon auf ${PUSH_MAX_GERAETE} Geräten Mitteilungen eingeschaltet. Schalte sie auf einem davon aus, dann geht es hier.`,
  /** Die Abfrage des Browsers wurde abgelehnt. */
  nichtErlaubt: "Ohne deine Erlaubnis auf dem Mobile gehen keine Mitteilungen. Du kannst sie in den Einstellungen erlauben.",
  fehler: "Das hat nicht geklappt. Versuche es noch einmal.",
} as const;

/** Die Zeile über eingeschaltete Mitteilungen für Mitglieder (AK 11): fester
 *  Hinweis hinter ⓘ an der Spalte «Mobile», wortgleich in der Beschreibung des
 *  KI-Werkzeugs (AK 12). */
export const MITTEILUNGEN_SPALTE = {
  kopf: "Mobile",
  an: "Mitteilungen eingeschaltet",
  aus: "Mitteilungen nicht eingeschaltet",
  hinweis:
    "Glocke heisst: Nach dem letzten bekannten Stand erhält mindestens ein Mobile Mitteilungen für diese Spieler:in. Ankommen ist damit nicht gesichert.",
} as const;

/** Der öffentliche VAPID-Schlüssel (base64url) als Bytes für
 *  `pushManager.subscribe`. */
export function schluesselBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const roh = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(roh.length));
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

/** Ob eine bestehende Anmeldung des Browsers mit diesem Schlüssel entstand
 *  (sonst stammt sie aus einer anderen Umgebung oder von einem alten
 *  Schlüssel und taugt nicht mehr). */
export function gleicherSchluessel(a: ArrayBuffer | null | undefined, publicKey: string): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  const y = schluesselBytes(publicKey);
  return x.length === y.length && x.every((b, i) => b === y[i]);
}
