// Benachrichtigungen am privaten Link (Epic #641, Story #642).
//
// REIN: keine Importe aus `next/*`, `server-only` oder Datenbank-Modulen —
// Seite (Client), Fachkern, KI-Werkzeuge und Prüfskripte laden diese Datei.
// Den Inhalt einer Benachrichtigung legt die Datenebene strukturiert ab
// (`spieler_benachrichtigungen`, Migration 20261119100000_benachrichtigungen.sql);
// die Wörter dazu stehen hier.
//
// Keine Datumsformatierung des Browsers in dieser Datei: Server und Browser
// müssen Zeichen für Zeichen dasselbe rendern (Hydration); Tage kommen als
// «YYYY-MM-DD» von der Datenebene und werden mit `lib/monat.ts` und
// `lib/serie.ts` gesetzt (Wächter in `check:kern`).
import { tagMonatKurz, tagOhneJahr } from "@/lib/monat";
import { plusTage } from "@/lib/serie";

/** Wie lange eine Benachrichtigung gilt (#642 AK 1, 5). SQL-Zwillinge:
 *  `spieler_benachrichtigungen_frist_loeschen` und der Lesefilter in
 *  `spieler_link_benachrichtigungen` (je `interval '90 days'`). */
export const BENACHRICHTIGUNG_TAGE = 90;

/** Was geschehen ist (Prinzip 1). SQL-Zwilling: Check
 *  `spieler_benachrichtigungen_ereignis`. `serie` fasst eine Änderung der
 *  Terminserie je Spieler:in zusammen (Prinzip 5). */
export type BenachrichtigungEreignis = "neues_spiel" | "ausfall" | "ruecknahme" | "verlegung" | "wegfall" | "serie";

/** Inhalt zu einem einzelnen Termin (Prinzip 6) — die Momentaufnahme nach dem
 *  Ereignis. SQL-Zwilling: `benachrichtigung_inhalt`. `datum` als
 *  «YYYY-MM-DD», Zeiten als «HH:MM». `grund` nur an einem ausgefallenen
 *  Termin (#643; `null` ohne Grund), `wieder` nur, wenn ein ausgefallener
 *  Termin wieder stattfindet (#644). */
export type BenachrichtigungTermin = {
  team: string;
  art: "training" | "spiel";
  /** Nur an einem Spiel. */
  bezeichnung: string | null;
  datum: string;
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  grund?: string | null;
  wieder?: true;
};

/** Inhalt zu einer Änderung der Terminserie (#644, #645): die neuen Angaben
 *  ab `ab` und, was wegfällt — je `null`, wenn es das nicht gibt. */
export type BenachrichtigungSerie = {
  team: string;
  art: "training";
  ab: string | null;
  angaben: { wochentage?: number[]; beginn?: string; ende?: string; ort?: string | null } | null;
  wegfall: { von: string; bis: string; wochentage: number[]; anzahl: number } | null;
};

/** Ein Eintrag am privaten Link, wie `spieler_link_benachrichtigungen` ihn
 *  liefert. `termin_id` bleibt, auch wenn der Termin nicht mehr am Link
 *  steht (AK 1); `erstellt` in ms, `erstellt_tag` als Tag am Trainingsort. */
export type LinkBenachrichtigung = {
  id: string;
  termin_id: string | null;
  erstellt: number;
  erstellt_tag: string;
} & (
  | { ereignis: Exclude<BenachrichtigungEreignis, "serie">; inhalt: BenachrichtigungTermin }
  | { ereignis: "serie"; inhalt: BenachrichtigungSerie }
);

/** Die Benachrichtigungen am Link: neueste zuerst, höchstens 200 aus den
 *  letzten 90 Tagen. `jetzt` (ms) und `heute` («YYYY-MM-DD» am
 *  Trainingsort) kommen von der Datenebene, damit Server und Browser gleich
 *  rechnen. */
export type LinkBenachrichtigungen = {
  jetzt: number;
  heute: string;
  eintraege: LinkBenachrichtigung[];
};

/* ── Wörter und Formen (Seite, Dialoge und KI-Werkzeuge) ─────────────────── */

/** Das Wort zum Ereignis, über dem Titel eines Eintrags (Prinzip 1). */
export const EREIGNIS_WORT: Record<BenachrichtigungEreignis, string> = {
  neues_spiel: "Neues Spiel",
  ausfall: "Fällt aus",
  ruecknahme: "Findet wieder statt",
  verlegung: "Verlegt",
  wegfall: "Fällt weg",
  serie: "Trainings geändert",
};

/** Rot nur dort, wo etwas nicht mehr stattfindet. */
export const EREIGNIS_NEGATIV: Record<BenachrichtigungEreignis, boolean> = {
  neues_spiel: false,
  ausfall: true,
  ruecknahme: false,
  verlegung: false,
  wegfall: true,
  serie: false,
};

const WOCHENTAGE_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"] as const;

/** «Dienstag», «Dienstag und Donnerstag», «Montag, Mittwoch und Freitag». */
function tageWort(tage: readonly number[]): string {
  const w = [...new Set(tage)].sort((a, b) => a - b).map((t) => WOCHENTAGE_LANG[t - 1]).filter(Boolean);
  return w.length <= 1 ? (w[0] ?? "") : `${w.slice(0, -1).join(", ")} und ${w[w.length - 1]}`;
}

/** «18:00–19:30», «ab 18:00», «bis 19:30» oder `null`. */
function zeitText(beginn: string | null | undefined, ende: string | null | undefined): string | null {
  if (beginn && ende) return `${beginn}–${ende}`;
  if (beginn) return `ab ${beginn}`;
  if (ende) return `bis ${ende}`;
  return null;
}

/** Der Titel eines Eintrags: das Spiel mit seiner Bezeichnung, sonst «Training»,
 *  dazu das Team (#642 AK 3). */
export function eintragTitel(e: LinkBenachrichtigung): string {
  if (e.ereignis === "serie") return `Training · ${e.inhalt.team}`;
  const i = e.inhalt;
  return `${i.art === "spiel" ? (i.bezeichnung ?? "Spiel") : "Training"} · ${i.team}`;
}

/** Wann: «Samstag, 5. Dezember · 14:00–15:30» (Stand nach dem Ereignis). Bei
 *  einer Serienänderung der Tag, ab dem sie gilt. */
export function eintragWann(e: LinkBenachrichtigung): string | null {
  if (e.ereignis === "serie") return e.inhalt.ab ? `Ab ${tagOhneJahr(e.inhalt.ab)}` : null;
  const i = e.inhalt;
  const zeit = zeitText(i.beginn, i.ende);
  return zeit ? `${tagOhneJahr(i.datum)} · ${zeit}` : tagOhneJahr(i.datum);
}

/** Wo: der Ort nach dem Ereignis; bei der Serie nur, wenn er sich änderte. */
export function eintragWo(e: LinkBenachrichtigung): string | null {
  if (e.ereignis === "serie") return null;
  return e.inhalt.ort || null;
}

/** Was wegfällt: «Es fallen 3 Trainings am Mittwoch weg (2.–16. Dez.).» */
export function wegfallText(w: NonNullable<BenachrichtigungSerie["wegfall"]>): string {
  const zeitraum = w.von === w.bis ? tagMonatKurz(w.von) : zeitraumKurz(w.von, w.bis);
  const tage = tageWort(w.wochentage);
  const wann = tage ? ` am ${tage}` : "";
  return w.anzahl === 1
    ? `Es fällt 1 Training${wann} weg (${zeitraum}).`
    : `Es fallen ${w.anzahl} Trainings${wann} weg (${zeitraum}).`;
}

/** «2.–16. Dez.» im selben Monat, sonst «28. Nov.–16. Dez.». */
function zeitraumKurz(von: string, bis: string): string {
  return von.slice(0, 7) === bis.slice(0, 7)
    ? `${Number(von.slice(8, 10))}.–${tagMonatKurz(bis)}`
    : `${tagMonatKurz(von)}–${tagMonatKurz(bis)}`;
}

/** Die neuen Angaben einer Serienänderung: «Neu jeweils Dienstag · 18:00–19:30 · Halle»;
 *  `null`, wenn sie nichts Neues nennt. */
export function angabenText(a: NonNullable<BenachrichtigungSerie["angaben"]>): string | null {
  const teile: string[] = [];
  const tage = a.wochentage?.length ? tageWort(a.wochentage) : "";
  const zeit = zeitText(a.beginn, a.ende);
  if (tage) teile.push(`jeweils ${tage}`);
  if (zeit) teile.push(zeit);
  if (a.ort) teile.push(a.ort);
  else if (a.ort === null) teile.push("ohne Ort");
  return teile.length ? `Neu ${teile.join(" · ")}` : null;
}

/** Was unter dem Ort steht: der Grund eines Ausfalls, «Findet wieder statt»
 *  an einem verlegten, vorher ausgefallenen Termin, bei einer Serienänderung
 *  die neuen Angaben und das Wegfallende. Leer, wenn es nichts zu sagen gibt. */
export function eintragZusaetze(e: LinkBenachrichtigung): string[] {
  if (e.ereignis === "serie") {
    const a = e.inhalt.angaben ? angabenText(e.inhalt.angaben) : null;
    return [a, e.inhalt.wegfall ? wegfallText(e.inhalt.wegfall) : null].filter((x): x is string => !!x);
  }
  const i = e.inhalt;
  if (e.ereignis === "ausfall") return i.grund ? [`Grund: ${i.grund}`] : [];
  if (e.ereignis === "verlegung" && i.wieder) return ["Findet wieder statt."];
  return [];
}

/** Wann der Eintrag entstand: «Erhalten heute», «Erhalten gestern», sonst «Erhalten am 3. Nov.». */
export function erhaltenText(erstelltTag: string, heute: string): string {
  if (erstelltTag >= heute) return "Erhalten heute";
  if (plusTage(erstelltTag, 1) === heute) return "Erhalten gestern";
  return `Erhalten am ${tagMonatKurz(erstelltTag)}`;
}

/** Teilt in neu und früher: neu ist, was nach `neuSeit` entstand. Ohne
 *  Stand (`null`) ist nichts neu — ein Gerät ohne Stand zeigt zum ersten Mal
 *  an, und alles Bisherige gilt als gesehen (#642 AK 2). */
export function gruppiere(
  eintraege: readonly LinkBenachrichtigung[],
  neuSeit: number | null,
): { neu: LinkBenachrichtigung[]; frueher: LinkBenachrichtigung[] } {
  const neu: LinkBenachrichtigung[] = [];
  const frueher: LinkBenachrichtigung[] = [];
  for (const e of eintraege) (neuSeit !== null && e.erstellt > neuSeit ? neu : frueher).push(e);
  return { neu, frueher };
}

/** Wie viele Einträge dieses Gerät noch nicht angezeigt hat (#642 AK 2). */
export function neuZahl(eintraege: readonly LinkBenachrichtigung[], gesehen: number | null): number {
  return gruppiere(eintraege, gesehen).neu.length;
}

export const ELTERN_TEXT = {
  titel: "Benachrichtigungen",
  neu: "Neu",
  frueher: "Früher",
  leerTitel: "Noch keine Benachrichtigungen",
  leer: "Sobald ein Team ein neues Spiel erfasst, steht es hier.",
  zumTermin: "Zum Termin",
  zurueck: "Zurück zu den Terminen",
  nichtMehr: "Steht nicht mehr in deinen Terminen",
  speicher: `KiFu bewahrt Benachrichtigungen ${BENACHRICHTIGUNG_TAGE} Tage auf. Welche du schon gesehen hast, merkt sich nur dieses Gerät.`,
} as const;

/** Der Name des Knopfs im Kopf der Seite; die Zahl steht auch im Namen, weil
 *  die Plakette am Zeichen für die Vorlesehilfe stumm ist. */
export function knopfLabel(neu: number): string {
  return neu > 0 ? `${ELTERN_TEXT.titel}, ${neu} neu` : ELTERN_TEXT.titel;
}

/** Das Häkchen im Dialog der Mitglieder (Prinzip 4) — Oberfläche und
 *  KI-Beschreibung nennen es wortgleich. */
export const BENACHRICHTIGEN_TEXT = {
  label: "Spielervertretungen benachrichtigen",
  gescheitert: "Gespeichert, aber die Benachrichtigung ist nicht entstanden.",
} as const;

/** Die Zeile unter dem Häkchen, je Vorgang. */
export const BENACHRICHTIGEN_HINWEIS: Record<BenachrichtigungEreignis, string> = {
  neues_spiel: "Sie sehen das neue Spiel am privaten Link unter «Benachrichtigungen».",
  ausfall: "Den Grund sehen sie auch in der Benachrichtigung.",
  ruecknahme: "Sie sehen, dass der Termin doch stattfindet.",
  verlegung: "Sie sehen die neuen Angaben am privaten Link.",
  serie: "Eine Benachrichtigung je Spieler:in mit den neuen Angaben.",
  wegfall: "Sie erfahren, dass der Termin wegfällt, obwohl er aus ihren Terminen verschwindet.",
};

/** Die Beschreibung des Parameters `benachrichtigen` eines KI-Werkzeugs: Label
 *  und Hinweis der Oberfläche, dazu die Regel (Prinzipien 2 und 4). */
export function BENACHRICHTIGEN_MODELL(vorgang: BenachrichtigungEreignis): string {
  return (
    `${BENACHRICHTIGEN_TEXT.label}: ${BENACHRICHTIGEN_HINWEIS[vorgang]} ` +
    "Standard true; false lässt die Spielervertretungen still. Nur bei Terminen von heute oder später, nie für ausgefallene."
  );
}
