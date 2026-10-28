// Der Ablauf eines Feedback-Dialogs (Epic #541), gleich für Trainer:innen
// und Spielervertretungen: Grenzen über die Datenbank zählen, das Modell
// fragen, das Bestätigte ablegen. Was je Zugang anders ist — welche RPC,
// mit welchem Schlüssel, welche Rolle —, steckt im `Weg`.
//
// Bewusst OHNE "use server": Die Actions in lib/actions/feedback.ts sind die
// öffentlichen Endpunkte, diese Datei ist ihr gemeinsamer Teil.
import "server-only";
import { headers } from "next/headers";
import { LINK_TEXT } from "@/lib/spieler";
import { APP_VERSION } from "@/lib/version";
import { kiVerfuegbar, naechsteAntwort } from "./ki";
import type { Rolle } from "./prompt";
import {
  MELDUNG_NICHT_MOEGLICH,
  MELDUNG_SPEICHERN,
  MELDUNG_TAGESLIMIT,
  NACHRICHT_MAX,
  seiteAus,
  verlaufSchema,
  zusammenfassungSchema,
  type Nachricht,
  type Zusammenfassung,
} from "./regeln";

/** Antwort einer Dialog-RPC, wie die Datenbank sie liefert. */
type RpcAntwort = { status: string; dialog?: string; nachricht?: number; vorschlag_bei?: number | null };

/** Die Verbindung eines Zugangs zur Datenbank. */
export type Weg = {
  rolle: Rolle;
  /** Die Seite, die statt der gemeldeten gilt — am privaten Link, dessen
   *  Pfad das Geheimnis trägt (#544 PC 3). */
  seiteFest?: string;
  beginnen: () => Promise<RpcAntwort | null>;
  zaehlen: (dialog: string) => Promise<RpcAntwort | null>;
  vermerken: (dialog: string) => Promise<void>;
  ablegen: (dialog: string, f: Ablage) => Promise<RpcAntwort | null>;
};

/** Was ein bestätigtes Feedback in die Datenbank mitnimmt. */
export type Ablage = {
  einordnung: Zusammenfassung["einordnung"];
  titel: string;
  punkte: Zusammenfassung["punkte"];
  verlauf: Nachricht[];
  seite: string;
  version: string;
  umgebung: string;
  geraet: string;
};

export type NachrichtEingabe = {
  /** `null` vor der ersten Nachricht — dann beginnt der Dialog. */
  dialog: string | null;
  /** Der bisherige Verlauf, ohne die neue Nachricht. */
  verlauf: unknown;
  text: unknown;
  /** Die zuletzt vorgelegte Zusammenfassung, sonst `null`. */
  zusammenfassung: unknown;
  /** Die Seite, auf der die Person gerade ist. */
  seite: unknown;
};

export type NachrichtErgebnis =
  | {
      ok: true;
      dialog: string;
      antwort: string;
      zusammenfassung: Zusammenfassung | null;
      nachricht: number;
      vorschlagBei: number | null;
    }
  | { ok: false; error: string; ende: boolean };

async function geraet(): Promise<string> {
  return ((await headers()).get("user-agent") ?? "").slice(0, 500);
}

const umgebung = () => process.env.VERCEL_ENV ?? "lokal";

/** Ein privater Link, der nicht mehr gilt (#544 AK 5): wie auf der Seite selbst. */
const LINK_UNGUELTIG = `${LINK_TEXT.ungueltigTitel}. ${LINK_TEXT.ungueltig}`;

/** Eine Nachricht der Person: zählen, das Modell fragen, antworten. Jeder
 *  Fehlschlag beendet den Dialog (`ende`), ausser einer zu langen Eingabe. */
export async function sendeNachricht(weg: Weg, e: NachrichtEingabe): Promise<NachrichtErgebnis> {
  const nichtMoeglich = { ok: false as const, error: MELDUNG_NICHT_MOEGLICH, ende: true };
  const text = typeof e.text === "string" ? e.text.trim() : "";
  if (!text || text.length > NACHRICHT_MAX) {
    return { ok: false, error: `Eine Nachricht hat höchstens ${NACHRICHT_MAX} Zeichen.`, ende: false };
  }
  const verlauf = verlaufSchema.safeParse(e.verlauf);
  const vorher = e.zusammenfassung === null ? null : zusammenfassungSchema.safeParse(e.zusammenfassung);
  if (!verlauf.success || verlauf.data.length % 2 !== 0 || (vorher && !vorher.success)) return nichtMoeglich;
  // Ohne Schlüssel beginnt kein Dialog — und zählt darum auch keiner.
  if (!kiVerfuegbar()) return nichtMoeglich;

  let dialog = e.dialog;
  if (dialog === null) {
    if (verlauf.data.length > 0) return nichtMoeglich;
    const b = await weg.beginnen();
    if (b?.status === "tageslimit") return { ok: false, error: MELDUNG_TAGESLIMIT, ende: true };
    if (b?.status === "ungueltig") return { ok: false, error: LINK_UNGUELTIG, ende: true };
    if (b?.status !== "ok" || !b.dialog) return nichtMoeglich;
    dialog = b.dialog;
  }
  const z = await weg.zaehlen(dialog);
  if (z?.status === "ungueltig") return { ok: false, error: LINK_UNGUELTIG, ende: true };
  if (z?.status !== "ok" || typeof z.nachricht !== "number") return nichtMoeglich;
  // Der Browser kann den Verlauf nicht verlängern, ohne dass die Datenbank
  // mitzählt: Jede Nachricht der Person darin ist schon gezählt.
  if (verlauf.data.length / 2 !== z.nachricht - 1) return nichtMoeglich;

  const vorschlagBei = z.vorschlag_bei ?? null;
  const k = await naechsteAntwort([...verlauf.data, { von: "person", text }], {
    rolle: weg.rolle,
    seite: weg.seiteFest ?? seiteAus(e.seite),
    version: APP_VERSION,
    geraet: await geraet(),
    nachricht: z.nachricht,
    vorschlagBei,
    zusammenfassung: vorher?.success ? vorher.data : null,
  });
  if (!k) return nichtMoeglich;
  if (k.zusammenfassung && vorschlagBei === null) await weg.vermerken(dialog);
  return {
    ok: true,
    dialog,
    antwort: k.antwort,
    // Lag schon eine vor und vergisst das Modell sie, bleibt die alte stehen.
    zusammenfassung: k.zusammenfassung ?? (vorher?.success ? vorher.data : null),
    nachricht: z.nachricht,
    vorschlagBei: vorschlagBei ?? (k.zusammenfassung ? z.nachricht : null),
  };
}

export type AblageEingabe = {
  dialog: unknown;
  zusammenfassung: unknown;
  verlauf: unknown;
  seite: unknown;
};

export type AblageErgebnis = { ok: true } | { ok: false; error: string; ende?: boolean };

/** Das bestätigte Feedback ablegen. Ein erneuter Versuch nach einem Fehler
 *  legt nichts doppelt ab (die RPC kennt den gespeicherten Dialog). */
export async function legeAb(weg: Weg, e: AblageEingabe): Promise<AblageErgebnis> {
  const z = zusammenfassungSchema.safeParse(e.zusammenfassung);
  const verlauf = verlaufSchema.safeParse(e.verlauf);
  if (typeof e.dialog !== "string" || !z.success || !verlauf.success || verlauf.data.length === 0) {
    return { ok: false, error: MELDUNG_SPEICHERN };
  }
  const r = await weg.ablegen(e.dialog, {
    einordnung: z.data.einordnung,
    titel: z.data.titel,
    punkte: z.data.punkte,
    verlauf: verlauf.data,
    seite: weg.seiteFest ?? seiteAus(e.seite),
    version: APP_VERSION,
    umgebung: umgebung(),
    geraet: await geraet(),
  });
  if (r?.status === "ungueltig") return { ok: false, error: LINK_UNGUELTIG, ende: true };
  return r?.status === "ok" ? { ok: true } : { ok: false, error: MELDUNG_SPEICHERN };
}
