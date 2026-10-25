/**
 * Trainer:innen an Terminen (Epic #518): wer eingeladen ist und wer den
 * Termin vorbereitet und leitet. Rein — ohne Server-Importe, damit Oberfläche,
 * Fachkern, KI-Werkzeuge und Prüfskripte dieselben Regeln und Sätze teilen.
 *
 * Modell (PO 2026-10-25): Eingeladene gelten als dabei, bis sie absagen (#520).
 * Höchstens eine Eingeladene ist verantwortlich — keine, wenn die
 * Verantwortliche ausgeladen wurde, ausgeschieden ist oder als Letzte absagte.
 * Wer verantwortlich wird, ist damit eingeladen und dabei; Ausladen wirkt immer.
 */

import { angezeigteSpielerzahl, fehlendeTrainer, noetigeTrainer, type Mindestbesetzung } from "@/lib/besetzung";
import { spielerzahlVon, type Spielstand } from "@/lib/spieler";

/** Wie ein Eintrag ohne Namen (gelöschtes Konto) überall heisst. */
export const EHEMALIGES_MITGLIED = "Ehemaliges Mitglied";

/** Eine eingeladene Trainer:in an einem Termin. */
export type TerminTrainer = {
  eintragId: string;
  /** `null`: ein gelöschtes Konto (#519 PC 9). */
  userId: string | null;
  /** Der aktuelle Anzeigename; `null` bei gelöschtem Konto. */
  name: string | null;
  /** Nicht mehr im Team (oder Konto gelöscht). */
  ehemalig: boolean;
  /** Bereitet den Termin vor und leitet ihn (höchstens eine je Termin). */
  verantwortlich: boolean;
  /** Wann abgesagt wurde (#520 AK 17); `null`: dabei. */
  abgesagtAm: string | null;
};

/** Eine Trainer:in in der Vorgabe einer Serie. */
export type SerienTrainer = { userId: string; name: string; verantwortlich: boolean };

/** Die Eingrenzung des Trainingsplans (#518 PO 12): «Meine Termine» = wo man
 *  dabei ist, «Eingeladen» = alle, zu denen man eingeladen ist. Höchstens eine. */
export type Eingrenzung = "dabei" | "eingeladen";

/** Der Name zum Anzeigen; gelöschte Konten stehen namenlos als ehemaliges Mitglied da. */
export function trainerName(t: { name: string | null }): string {
  return t.name ?? EHEMALIGES_MITGLIED;
}

/** Die verantwortliche Trainer:in eines Termins, sonst `null`. */
export function verantwortlicheVon<T extends { verantwortlich: boolean }>(trainer: readonly T[]): T | null {
  return trainer.find((t) => t.verantwortlich) ?? null;
}

/** Der Name zum Anzeigen aus Sicht des USERS: man selbst mit «(du)». */
export function trainerNameFuer(t: { userId: string | null; name: string | null }, ich: string): string {
  return t.userId === ich ? `${trainerName(t)} (du)` : trainerName(t);
}

/** Wer verantwortlich ist, aus Sicht des USERS; `null`: niemand (#519 AK 17, 24). */
export function verantwortlichText(trainer: readonly TerminTrainer[], ich: string): string | null {
  const v = verantwortlicheVon(trainer);
  return v ? trainerNameFuer(v, ich) : null;
}

/** Ist dieses Konto zum Termin eingeladen? */
export function istEingeladen(trainer: readonly TerminTrainer[], userId: string): boolean {
  return trainer.some((t) => t.userId === userId);
}

/** Ist dieses Konto am Termin dabei — eingeladen und nicht abgesagt (#520 AK 2)? */
export function istDabei(trainer: readonly TerminTrainer[], userId: string): boolean {
  return trainer.some((t) => t.userId === userId && !t.abgesagtAm);
}

/** Hat dieses Konto für den Termin abgesagt? */
export function hatAbgesagt(trainer: readonly TerminTrainer[], userId: string): boolean {
  return trainer.some((t) => t.userId === userId && !!t.abgesagtAm);
}

/** Lassen sich Absagen am Termin noch ändern (#520 AK 3)? Bis zum Beginn bzw.
 *  Anpfiff und nie an einem ausgefallenen Termin. `begonnen` aus lib/zeit. */
export function absageOffen(t: { ausgefallen: boolean }, begonnen: boolean): boolean {
  return !t.ausgefallen && !begonnen;
}

/** Wer die Verantwortung übernehmen kann, wenn die Verantwortliche absagt
 *  (#520 AK 4, 19): andere Eingeladene, die dabei sind. */
export function uebernehmenKoennen(trainer: readonly TerminTrainer[], ohne: string): TerminTrainer[] {
  return trainer.filter((t) => t.userId && t.userId !== ohne && !t.abgesagtAm);
}

/** Gehört der Termin in die Eingrenzung dieses Kontos? */
export function imFilter(trainer: readonly TerminTrainer[], userId: string, e: Eingrenzung): boolean {
  return e === "dabei" ? istDabei(trainer, userId) : istEingeladen(trainer, userId);
}

/** Die Eingeladenen nach Name, gelöschte Konten zuletzt; bei gleichem Namen
 *  nach Kennung, damit die Reihenfolge stabil bleibt. */
export function nachTrainerName<T extends { name: string | null }>(liste: readonly T[], schluessel: (x: T) => string): T[] {
  return [...liste].sort((a, b) => {
    if (a.name === null || b.name === null) {
      if (a.name !== b.name) return a.name === null ? 1 : -1;
    } else {
      const n = a.name.localeCompare(b.name, "de");
      if (n !== 0) return n;
    }
    return schluessel(a).localeCompare(schluessel(b));
  });
}

/** Wie viele dabei sind (ohne Einträge gelöschter Konten). */
export function dabeiZahl(trainer: readonly TerminTrainer[]): number {
  return trainer.filter((t) => t.userId && !t.abgesagtAm).length;
}

/** Ein anstehender, nicht ausgefallener Termin ohne Verantwortliche:n fällt
 *  im Trainingsplan auf (#519 AK 18). */
export function ohneVerantwortliche(
  t: { trainer: readonly TerminTrainer[]; datum: string; ausgefallen: boolean },
  heute: string,
): boolean {
  return t.datum >= heute && !t.ausgefallen && !verantwortlicheVon(t.trainer);
}

/** Was die Besetzung eines Termins braucht. */
type MitBesetzung = {
  trainer: readonly TerminTrainer[];
  mindestbesetzung: Mindestbesetzung;
  spielerzahl: number | null;
  spielstand: Spielstand;
  datum: string;
  ausgefallen: boolean;
};

/** Wie viele Trainer:innen der Termin braucht (#521 AK 6, 9); `null`: keine Bewertung. */
export function noetigeVon(t: Omit<MitBesetzung, "trainer" | "datum">): number | null {
  return noetigeTrainer(t.mindestbesetzung, angezeigteSpielerzahl(spielerzahlVon(t)));
}

/** Die Trainer-Lücke eines anstehenden, nicht ausgefallenen Termins (#519 AK 18,
 *  #521 AK 8, 16): zu wenige dabei geht vor «niemand verantwortlich» — fehlt
 *  beides, zählt nur die Unterbesetzung. `null`: keine. */
export function trainerLuecke(t: MitBesetzung, heute: string): { art: "zuWenig"; fehlen: number } | { art: "niemand" } | null {
  if (t.datum < heute || t.ausgefallen) return null;
  const fehlen = fehlendeTrainer(noetigeVon(t), dabeiZahl(t.trainer));
  if (fehlen > 0) return { art: "zuWenig", fehlen };
  return ohneVerantwortliche(t, heute) ? { art: "niemand" } : null;
}

/** Der ganze Satz zur Trainer-Zahl eines Termins, aus Sicht des USERS; mit
 *  `noetig` auch, wie viele die Mindestbesetzung verlangt (#521 AK 9). */
export function trainerZahlSatz(trainer: readonly TerminTrainer[], ich: string, noetig: number | null = null): string {
  const v = verantwortlicheVon(trainer);
  const eigen = istDabei(trainer, ich)
    ? "du bist dabei"
    : istEingeladen(trainer, ich)
      ? "du hast abgesagt"
      : "du bist nicht eingeladen";
  return [
    `Trainer:innen: ${dabeiZahl(trainer)} von ${trainer.length} dabei`,
    ...(noetig !== null ? [`nötig ${noetig}`] : []),
    v ? `${v.userId === ich ? "du bist" : trainerName(v)} verantwortlich` : "niemand verantwortlich",
    eigen,
  ].join(" · ");
}

// ── Die Wahl im Termin-Dialog (#519 AK 1–14) ─────────────────────────────────

/** Die Wahl im Abschnitt: eingeladene Konten (`eingeladene`), die Einträge
 *  gelöschter Konten, die bleiben (`anonyme`, Eintrags-Kennungen), und wer
 *  verantwortlich ist (`null`: niemand). */
export type TrainerWert = { eingeladene: string[]; anonyme: string[]; verantwortlich: string | null };

/** Die Vorwahl beim Festlegen (#519 AK 2, 4): alle Mitglieder eingeladen, du verantwortlich. */
export function trainerVorwahl(mitglieder: readonly { userId: string }[], ich: string): TrainerWert {
  return { eingeladene: mitglieder.map((m) => m.userId), anonyme: [], verantwortlich: ich };
}

/** Die Wahl, mit der der Abschnitt für einen bestehenden Termin öffnet — auch
 *  die Vergleichsbasis für `trainerAenderung`. */
export function trainerStart(bisher: readonly (TerminTrainer | SerienTrainer)[]): TrainerWert {
  return {
    eingeladene: bisher.flatMap((t) => (t.userId ? [t.userId] : [])),
    anonyme: bisher.flatMap((t) => (t.userId || !("eintragId" in t) ? [] : [t.eintragId])),
    verantwortlich: bisher.find((t) => t.verantwortlich)?.userId ?? null,
  };
}

/** Dieselben Werte, gleich in welcher Reihenfolge. */
export const gleicheMenge = (a: readonly string[], b: readonly string[]) => [...a].sort().join() === [...b].sort().join();

/** Was sich gegenüber dem Öffnen geändert hat, getrennt nach den zwei Angaben
 *  einer Serie (#519 AK 14); `null`, wenn nichts. `verantwortlich` nur, wenn
 *  jemand Neues verantwortlich ist — wer die Verantwortliche auslädt, ändert
 *  die Eingeladenen (AK 9). `nurNamenlose`: Es fallen allein Einträge
 *  gelöschter Konten weg; das geht nur für diesen Termin. */
export function trainerAenderung(neu: TrainerWert, alt: TrainerWert) {
  const eingeladene = !gleicheMenge(neu.eingeladene, alt.eingeladene);
  const anonyme = !gleicheMenge(neu.anonyme, alt.anonyme);
  const verantwortlich = neu.verantwortlich !== null && neu.verantwortlich !== alt.verantwortlich;
  if (!eingeladene && !anonyme && !verantwortlich) return null;
  return {
    einladen: neu.eingeladene.filter((u) => !alt.eingeladene.includes(u)),
    ausladen: alt.eingeladene.filter((u) => !neu.eingeladene.includes(u)),
    ausladenEintraege: alt.anonyme.filter((a) => !neu.anonyme.includes(a)),
    verantwortlich: verantwortlich ? neu.verantwortlich! : undefined,
    /** Für folgende und alle: die ganze neue Liste, nur wenn sie sich ändert. */
    eingeladene: eingeladene ? neu.eingeladene : undefined,
    nurNamenlose: anonyme && !eingeladene && !verantwortlich,
  };
}
export type TrainerAenderung = NonNullable<ReturnType<typeof trainerAenderung>>;

/** Der Satz zu verfallenden Absagen steht bei den Verfall-Sätzen der
 *  Abmeldungen (lib/spieler.ts), an die er anschliesst. */
export { absagenVerfallText } from "@/lib/spieler";

// ── Das Kalender-Abo der Trainer:innen (#522) ────────────────────────────────

/** Wie der Feed eines Abos einen Termin liefert (kalender_abo_termine). */
export type AboTrainerTermin = {
  stand: "dabei" | "abgesagt" | "verantwortlich";
  trainer: { name: string | null; ich: boolean; verantwortlich: boolean; abgesagt: boolean }[];
  besetzung_art: string | null;
  besetzung_zahl: number | null;
  erwartete_spielerzahl: number | null;
  spielstand: Spielstand;
};

const ABO_STAND: Record<AboTrainerTermin["stand"], string> = {
  dabei: "",
  abgesagt: "Abgesagt · ",
  verantwortlich: "Verantwortlich · ",
};

/** Der Stand vorn im Titel (#522 AK 3): «Abgesagt · …», «Verantwortlich · …», sonst nichts. */
export function aboTitel(t: AboTrainerTermin, titel: string): string {
  return `${ABO_STAND[t.stand]}${titel}`;
}

/** Der Eintrag (#522 AK 4–6): der eigene Stand, wer dabei ist, abgesagt hat
 *  und verantwortlich ist, mit Namen; eine Lücke zur Mindestbesetzung; dann
 *  der Weg in KiFu (der Verweis folgt in `kalenderText`). */
export function aboBeschreibung(t: AboTrainerTermin): string {
  const name = (x: AboTrainerTermin["trainer"][number]) => (x.ich ? `${x.name ?? EHEMALIGES_MITGLIED} (du)` : (x.name ?? EHEMALIGES_MITGLIED));
  const dabei = t.trainer.filter((x) => !x.abgesagt);
  const abgesagt = t.trainer.filter((x) => x.abgesagt);
  const v = t.trainer.find((x) => x.verantwortlich);
  const noetig = noetigeTrainer(
    t.besetzung_art && t.besetzung_zahl !== null ? ({ art: t.besetzung_art, zahl: t.besetzung_zahl } as Mindestbesetzung) : null,
    angezeigteSpielerzahl(spielerzahlVon({ spielerzahl: t.erwartete_spielerzahl, spielstand: t.spielstand })),
  );
  const fehlen = fehlendeTrainer(noetig, dabei.length);
  return [
    t.stand === "verantwortlich" ? "Du bist verantwortlich." : t.stand === "abgesagt" ? "Du hast abgesagt." : "Du bist dabei.",
    `Dabei (${dabei.length} von ${t.trainer.length}): ${dabei.map(name).join(", ") || "niemand"}`,
    abgesagt.length > 0 ? `Abgesagt: ${abgesagt.map(name).join(", ")}` : null,
    t.stand === "verantwortlich" ? null : v ? `Verantwortlich: ${name(v)}` : "Niemand ist verantwortlich.",
    fehlen > 0 ? `Mindestbesetzung ${noetig} – es ${fehlen === 1 ? "fehlt 1 Trainer:in" : `fehlen ${fehlen} Trainer:innen`}.` : null,
    "Absagen oder zusagen in KiFu:",
  ]
    .filter(Boolean)
    .join("\n");
}

export const TRAINER_TEXT = {
  /** Eingabe mit einer Kennung, die keine ist. */
  kennungUngueltig: "Bitte nur Mitglieder des Teams als Trainer:innen wählen.",
  verantwortlichPflicht: "Bitte wähle, wer den Termin vorbereitet und leitet.",
  /** Fester Hinweis zum Feld «Verantwortlich». */
  verantwortlichHinweis: "Wer verantwortlich ist, ist damit eingeladen.",
  eingeladenHinweis: "Wer eingeladen ist, gilt als dabei, bis sie oder er absagt.",
} as const;

/** Die Sätze zu den Markern der Datenebene (Migration trainer_einladen) —
 *  dieselben in Oberfläche und KI (#519 AK 23). Kein Marker steckt in einem
 *  anderen (Test in `check:kern`). */
export const TRAINER_MELDUNG = {
  VERANTWORTUNG_ERSATZLOS:
    "Die Verantwortung lässt sich nur weitergeben. Gib sie einer anderen Trainer:in oder lade die Verantwortliche aus.",
  VERANTWORTUNG_PFLICHT: TRAINER_TEXT.verantwortlichPflicht,
  TRAINER_WIDERSPRUCH: "Wer verantwortlich wird, lässt sich nicht gleichzeitig ausladen.",
  // Absagen (Migration trainer_absagen, #520).
  ABSAGE_VERALTET:
    "Seit deiner Auswahl hat sich der Termin oder seine Verantwortung geändert. Sieh dir die Trainer:innen noch einmal an.",
  ABSAGE_AUSGEFALLEN: "Der Termin fällt aus: Absagen und Zusagen ruhen, bis der Ausfall zurückgenommen ist.",
  ABSAGE_BEGONNEN: "Der Termin hat begonnen: Absagen und Zusagen lassen sich nicht mehr ändern.",
  TRAINER_NICHT_EINGELADEN: "Diese Trainer:in ist zu diesem Termin nicht (mehr) eingeladen.",
  VERANTWORTUNG_UEBERGEBEN:
    "Die Verantwortliche kann erst absagen, wenn eine andere Trainer:in, die dabei ist, die Verantwortung übernimmt.",
  UEBERNAHME_UNGUELTIG: "Übernehmen kann nur eine andere eingeladene Trainer:in, die dabei ist.",
} as const;
