/**
 * Trainer:innen an Terminen (Epic #518): wer eingeladen ist und wer den
 * Termin vorbereitet und leitet. Rein — ohne Server-Importe, damit Oberfläche,
 * Fachkern, KI-Werkzeuge und Prüfskripte dieselben Regeln und Sätze teilen.
 *
 * Modell (PO 2026-10-25): Eingeladene gelten als dabei, bis sie absagen. Genau
 * eine Eingeladene ist verantwortlich — oder keine, wenn die Verantwortliche
 * ausgeladen wurde oder ausgeschieden ist. Wer verantwortlich wird, ist damit
 * eingeladen; Ausladen wirkt immer.
 */

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

/** Ist dieses Konto am Termin dabei — eingeladen und (ab #520) nicht abgesagt? */
export function istDabei(trainer: readonly TerminTrainer[], userId: string): boolean {
  return istEingeladen(trainer, userId);
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
  return trainer.filter((t) => t.userId && istDabei(trainer, t.userId)).length;
}

/** Ein anstehender, nicht ausgefallener Termin ohne Verantwortliche:n fällt
 *  im Trainingsplan auf (#519 AK 18). */
export function ohneVerantwortliche(
  t: { trainer: readonly TerminTrainer[]; datum: string; ausgefallen: boolean },
  heute: string,
): boolean {
  return t.datum >= heute && !t.ausgefallen && !verantwortlicheVon(t.trainer);
}

/** Der ganze Satz zur Trainer-Zahl eines Termins, aus Sicht des USERS. */
export function trainerZahlSatz(trainer: readonly TerminTrainer[], ich: string): string {
  const v = verantwortlicheVon(trainer);
  const eigen = istDabei(trainer, ich)
    ? "du bist dabei"
    : istEingeladen(trainer, ich)
      ? "du hast abgesagt"
      : "du bist nicht eingeladen";
  return [
    `Trainer:innen: ${dabeiZahl(trainer)} von ${trainer.length} dabei`,
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
} as const;
