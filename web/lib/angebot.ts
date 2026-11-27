import { genitiv, type Geraet } from "@/lib/app-ablegen";
import type { LinkBenachrichtigung } from "@/lib/benachrichtigung";
import type { MitteilungenStand } from "@/lib/push";

/* Das Angebot am privaten Link (#698): Mitteilungen aufs Mobile einschalten
   und die Seite als App ablegen, im Moment des Nutzens statt ab dem zweiten
   Besuch (ersetzt #650 AK 6–8, #483 AK 4).

   REIN: kein Browser, kein Server — der Hook `useAngebot` liest Gerät,
   Speicher und den Stand der Mitteilungen und reicht sie hier durch.
   Geprüft in scripts/pruefe-kern.ts.

   Was das Gerät sich merkt, steht im lokalen Speicher (`ANGEBOT_SPEICHER`,
   eingetragen in lib/browser-speicher.ts): je Link unter dem Kürzel aus
   `linkSchluessel` (nie der Link selbst), wann das Angebot abgelehnt und wann
   es zuletzt gezeigt wurde. Ein erneuerter Link beginnt damit neu, ebenso
   ein Gerät, das den alten Hinweis zum Ablegen geschlossen hatte (PC 2). */

/** Name im lokalen Speicher des Browsers. */
export const ANGEBOT_SPEICHER = "kifu-angebot";

/** Der Speicher des abgelösten Hinweises zum Ablegen (#650): Er zählt nicht
 *  mehr (PC 2) und wird beim nächsten Besuch entfernt. */
export const ANGEBOT_ALTER_SPEICHER = "kifu-app-ablegen";

/** Wie viele Links ein Gerät sich merkt; der zuletzt berührte steht zuerst,
 *  der älteste fällt heraus (wie `BENACHRICHTIGUNG_MAX_LINKS`). */
export const ANGEBOT_MAX_LINKS = 20;

/** Nach dem Ablehnen kommt das Angebot frühestens nach 30 Tagen wieder (AK 1, 2). */
export const ANGEBOT_PAUSE_MS = 30 * 24 * 60 * 60 * 1000;

/** Höchstens einmal je Besuch (AK 1): Gezeigt gilt für die übliche
 *  Sitzungsgrenze von 30 Minuten — neu laden oder zurück aus den Infos ist
 *  derselbe Besuch. */
export const ANGEBOT_BESUCH_MS = 30 * 60 * 1000;

/** Was das Gerät je Link weiss: Kürzel, wann abgelehnt und wann zuletzt
 *  gezeigt (ms; `null` = nie). */
export type AngebotStand = { k: string; a: number | null; g: number | null };

const SCHLUESSEL = /^[A-Za-z0-9_-]{12}$/;
const istZeit = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
const zeitOderNull = (x: unknown): x is number | null => x === null || istZeit(x);

/** Der gespeicherte Wert; Unlesbares fällt weg (auch ein ganz kaputter Wert). */
export function liesAngebot(wert: string | null | undefined): AngebotStand[] {
  if (!wert) return [];
  let roh: unknown;
  try {
    roh = JSON.parse(wert);
  } catch {
    return [];
  }
  if (!Array.isArray(roh)) return [];
  const stand: AngebotStand[] = [];
  for (const e of roh) {
    if (!e || typeof e !== "object") continue;
    const { k, a, g } = e as Record<string, unknown>;
    if (typeof k !== "string" || !SCHLUESSEL.test(k) || !zeitOderNull(a) || !zeitOderNull(g)) continue;
    if (stand.some((s) => s.k === k)) continue;
    stand.push({ k, a, g });
  }
  return stand.slice(0, ANGEBOT_MAX_LINKS);
}

/** Der Stand eines Links, oder `null`, wenn das Gerät ihn nicht kennt. */
export function angebotFuer(wert: string | null | undefined, schluessel: string): AngebotStand | null {
  return liesAngebot(wert).find((s) => s.k === schluessel) ?? null;
}

/** Setzt ein Feld des Links auf `jetzt`; der Link rückt nach vorn. */
function mit(feld: "a" | "g", wert: string | null | undefined, schluessel: string, jetzt: number): string {
  const stand = liesAngebot(wert);
  if (!SCHLUESSEL.test(schluessel) || !istZeit(jetzt)) return JSON.stringify(stand);
  const bisher = stand.find((s) => s.k === schluessel) ?? { k: schluessel, a: null, g: null };
  return JSON.stringify([{ ...bisher, [feld]: jetzt }, ...stand.filter((s) => s.k !== schluessel)].slice(0, ANGEBOT_MAX_LINKS));
}

/** Abgelehnt (AK 2): «Nicht jetzt», eine nicht erteilte Erlaubnis des Geräts
 *  oder das Ausschalten der Mitteilungen. */
export const mitAbgelehnt = (wert: string | null | undefined, schluessel: string, jetzt: number) => mit("a", wert, schluessel, jetzt);

/** Gezeigt: zählt für «höchstens einmal je Besuch». */
export const mitGezeigt = (wert: string | null | undefined, schluessel: string, jetzt: number) => mit("g", wert, schluessel, jetzt);

/** Was das Angebot auf diesem Gerät anbietet. */
export type AngebotArt =
  /** Mitteilungen einschalten — auf Android zugleich ablegen, wo der Browser es anbietet (AK 3, 4). */
  | "einschalten"
  /** iPhone oder iPad im Browser: zuerst als App ablegen, dort einschalten (AK 5). */
  | "ablegen_ios"
  /** Im Browser einer anderen App: der Weg in den Browser des Geräts (AK 6). */
  | "in_app"
  /** Das Gerät hat Mitteilungen gesperrt: der Weg in die Einstellungen (AK 3). */
  | "gesperrt";

/** Ob und was das Angebot jetzt anbieten darf (AK 1): nur auf Telefon und
 *  Tablet, solange auf diesem Gerät keine Mitteilungen eingeschaltet sind,
 *  höchstens einmal je Besuch und frühestens 30 Tage nach dem Ablehnen.
 *  Solange der Stand der Mitteilungen nicht feststeht, wartet es. */
export function angebotJetzt({
  geraet,
  mitteilungen,
  stand,
  jetzt,
}: {
  geraet: Geraet;
  mitteilungen: MitteilungenStand;
  stand: AngebotStand | null;
  jetzt: number;
}): AngebotArt | null {
  if (geraet.system === "andere") return null;
  if (stand?.a != null && jetzt - stand.a < ANGEBOT_PAUSE_MS) return null;
  if (stand?.g != null && jetzt - stand.g < ANGEBOT_BESUCH_MS) return null;
  if (geraet.inApp) return "in_app";
  switch (mitteilungen) {
    case "aus":
      return "einschalten";
    case "ios_browser":
      return "ablegen_ios";
    case "abgelehnt":
      return "gesperrt";
    default:
      // «laedt», «an» und ein Browser ohne Mitteilungen: kein Angebot.
      return null;
  }
}

/** Der Ausfall, der das Angebot auslöst (AK 1): der neueste, den dieses Gerät
 *  noch nicht gesehen hat und dessen Termin am Link steht. Kennt das Gerät
 *  den Link noch nicht (`gesehenBis` `null`), gilt alles Bisherige als
 *  gesehen (#642) — dann keiner. */
export function ungesehenerAusfall(
  eintraege: readonly LinkBenachrichtigung[],
  gesehenBis: number | null,
  amLink: ReadonlySet<string>,
): string | null {
  if (gesehenBis === null) return null;
  const e = eintraege.find((x) => x.ereignis === "ausfall" && x.erstellt > gesehenBis && x.termin_id !== null && amLink.has(x.termin_id));
  return e?.termin_id ?? null;
}

/** Die Texte des Angebots (Begriff durchgängig «Mobile»). */
export const ANGEBOT_TEXT = {
  titel: "Ausfälle, Änderungen und neue Spiele sofort aufs Mobile",
  einschalten: (vorname: string) => `Schalte Mitteilungen für ${vorname} ein. Dann meldet sich dein Mobile, sobald sich etwas ändert.`,
  /** Android, wenn der Browser selbst ablegen kann (AK 4). */
  einrichten: (vorname: string) =>
    `Lege ${genitiv(vorname)} Termine als App auf den Startbildschirm und schalte Mitteilungen ein. Dann meldet sich dein Mobile, sobald sich etwas ändert.`,
  ablegenIos: (vorname: string) =>
    `Lege ${genitiv(vorname)} Termine als App auf den Home-Bildschirm und öffne sie dort. In der App schaltest du die Mitteilungen ein.`,
  inApp: "Öffne den Link dafür im Browser deines Mobiles, etwa in Safari oder Chrome: im Menü dieser App mit «Im Browser öffnen», oder kopiere den Link.",
  gesperrt: (vorname: string) =>
    `Dein Mobile lässt für ${genitiv(vorname)} Termine keine Mitteilungen zu. Erlaube sie in den Einstellungen deines Mobiles, danach schaltest du sie hinter der Glocke ein.`,
  knopfEinschalten: "Einschalten",
  knopfEinrichten: "Einrichten",
  knopfSoGehts: "So geht’s",
  knopfKopieren: "Link kopieren",
  kopiert: "Link kopiert",
  nichtJetzt: "Nicht jetzt",
} as const;
