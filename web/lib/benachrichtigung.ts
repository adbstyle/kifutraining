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

/** Eine Serienänderung, die nur Termine wegfallen lässt (Serie ganz
 *  entfernen oder verkürzen): Sie heisst und wirkt wie ein Wegfall, nicht wie
 *  eine Änderung. */
export function nurWegfall(e: LinkBenachrichtigung): boolean {
  return e.ereignis === "serie" && !!e.inhalt.wegfall && !(e.inhalt.angaben && angabenText(e.inhalt.angaben));
}

/** Das Wort über dem Titel eines Eintrags: `EREIGNIS_WORT`, beim reinen
 *  Wegfall einer Serie «Trainings fallen weg» bzw. «Training fällt weg». */
export function eintragWort(e: LinkBenachrichtigung): string {
  if (e.ereignis === "serie" && nurWegfall(e)) {
    return e.inhalt.wegfall?.anzahl === 1 ? "Training fällt weg" : "Trainings fallen weg";
  }
  return EREIGNIS_WORT[e.ereignis];
}

/** Rot für den Eintrag: `EREIGNIS_NEGATIV`, dazu der reine Wegfall einer Serie. */
export function eintragNegativ(e: LinkBenachrichtigung): boolean {
  return EREIGNIS_NEGATIV[e.ereignis] || nurWegfall(e);
}

/** Der Termin, zu dem «Zum Termin» führt (#641 AK 3, #642 AK 4): der
 *  betroffene Termin, solange er am Link steht; sonst `null`. Eine
 *  Serienänderung betrifft mehrere Termine und führt zu keinem — ihre
 *  `termin_id` (der erste verlegte Termin) dient nur der Datenebene. */
export function zumTermin(e: LinkBenachrichtigung, amLink: ReadonlySet<string>): string | null {
  if (e.ereignis === "serie" || e.termin_id === null) return null;
  return amLink.has(e.termin_id) ? e.termin_id : null;
}

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

/** Wo: der Ort nach dem Ereignis. Bei einer Serienänderung keiner — ein
 *  geänderter Ort steht in den neuen Angaben (`eintragZusaetze`). */
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
  if (e.ereignis === "verlegung" && i.wieder) return [`${EREIGNIS_WORT.ruecknahme}.`];
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
  leer: "Sobald ein Team ein neues Spiel erfasst oder dir eine Änderung mitteilt, steht es hier.",
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

/** Die Dialoge, in denen das Häkchen steht (Prinzip 4) — je Vorgang des
 *  Mitglieds, nicht je Ereignis: Ändern kann verlegen, wegfallen lassen oder
 *  beides, einzeln oder über die Serie. */
export type BenachrichtigenVorgang = "neues_spiel" | "ausfall" | "ruecknahme" | "aendern" | "entfernen";

/** Die Zeile unter dem Häkchen, je Vorgang; sie stimmt für einen Termin wie
 *  für die Serie. */
export const BENACHRICHTIGEN_HINWEIS: Record<BenachrichtigenVorgang, string> = {
  neues_spiel: "Sie sehen das neue Spiel am privaten Link unter «Benachrichtigungen».",
  ausfall: "Den Grund sehen sie auch in der Benachrichtigung.",
  ruecknahme: "Sie sehen, dass der Termin wieder stattfindet.",
  aendern: "Sie sehen am privaten Link, was neu gilt und was wegfällt.",
  entfernen: "Sie erfahren, was wegfällt, obwohl es aus ihren Terminen verschwindet.",
};

/** Die Beschreibung des Parameters `benachrichtigen` eines KI-Werkzeugs: Label
 *  und Hinweis der Oberfläche desselben Vorgangs, dazu die Regel (Prinzipien
 *  2 und 4). */
export function BENACHRICHTIGEN_MODELL(vorgang: BenachrichtigenVorgang): string {
  return (
    `${BENACHRICHTIGEN_TEXT.label}: ${BENACHRICHTIGEN_HINWEIS[vorgang]} ` +
    "Standard true; false lässt die Spielervertretungen still. Nur bei Terminen von heute oder später, nie für ausgefallene."
  );
}

/** Der Satz im Werkzeugtext jedes KI-Werkzeugs mit `benachrichtigen`
 *  (Prinzip 4): Standard ja, und was still bleibt (Prinzipien 1, 2). Gleich
 *  für alle Vorgänge des Epics #641; die Einzelheiten stehen im Parameter
 *  (`BENACHRICHTIGEN_MODELL`). */
export const BENACHRICHTIGEN_WERKZEUG =
  "Standardmässig erhalten die Spielervertretungen dazu eine Benachrichtigung am privaten Link («benachrichtigen»: false " +
  "lässt sie still); still bleiben Termine vor heute, ausgefallene Termine und alle Änderungen ausser neuem Spiel, " +
  "Ausfall, Rücknahme, Verlegung von Datum, Zeit oder Ort und Entfernen.";

/* ── Wann das Häkchen erscheint (Zwillinge der Datenebene) ─────────────── */

/** Ob ein Termin an diesem Tag den Spielervertretungen mitgeteilt wird
 *  (Prinzip 2): heute oder später am Trainingsort; bei einer Verlegung zählt
 *  der neue, beim Entfernen der bisherige Tag. Beide Tage als «YYYY-MM-DD».
 *  SQL-Zwilling: `benachrichtigung_zaehlt` (20261119100000_benachrichtigungen.sql). */
export function benachrichtigungZaehlt(datum: string, heute: string): boolean {
  return datum >= heute;
}

/** Die Angaben eines Termins, die eine Verlegung ausmachen (Prinzip 1):
 *  Datum «YYYY-MM-DD», Beginn und Ende («HH:MM» oder «HH:MM:SS»), Ort. */
export type VerlegungStand = {
  datum: string;
  beginn: string | null;
  ende: string | null;
  ort: string | null;
};

const uhr = (z: string | null | undefined) => (z ? z.slice(0, 5) : null);
const ortWert = (o: string | null | undefined) => (o && o.trim() ? o.trim() : null);

/** Ob ein Termin verlegt ist: Datum, Beginn, Ende oder Ort anders — der
 *  Kartenlink allein nicht (#644 OoS 1). SQL-Zwilling:
 *  `benachrichtigung_verlegt` (20261119120000_benachrichtigungen_verlegung.sql). */
export function istVerlegung(vorher: VerlegungStand, nachher: VerlegungStand): boolean {
  return (
    vorher.datum !== nachher.datum ||
    uhr(vorher.beginn) !== uhr(nachher.beginn) ||
    uhr(vorher.ende) !== uhr(nachher.ende) ||
    ortWert(vorher.ort) !== ortWert(nachher.ort)
  );
}

/** Ob ein ausgefallener Termin durch eine Änderung wieder stattfindet (#327
 *  PC 4): ein Training, wenn sein Datum auf heute oder später wechselt (der
 *  Fachkern hebt den Ausfall auf), ein Spiel bei jeder Änderung von Datum
 *  oder Beginn (Trigger `spiel_zeitpunkt_vorher`). Der Termin-Dialog sagt es
 *  an, und nur dann kann die Verlegung mitgeteilt werden (#644 AK 3). */
export function ausfallEndet(
  vorher: Pick<VerlegungStand, "datum" | "beginn">,
  nachher: Pick<VerlegungStand, "datum" | "beginn">,
  art: "training" | "spiel",
  heute: string,
): boolean {
  return art === "spiel"
    ? vorher.datum !== nachher.datum || uhr(vorher.beginn) !== uhr(nachher.beginn)
    : vorher.datum !== nachher.datum && benachrichtigungZaehlt(nachher.datum, heute);
}

/** Ob die Änderung eines einzelnen Termins mitgeteilt werden kann — dann
 *  zeigt der Dialog das Häkchen (#644 AK 1): verlegt, danach heute oder
 *  später und nicht ausgefallen (ein ausgefallener nur, wenn der Ausfall
 *  damit endet). Zwilling der Datenebene (`termin_benachrichtigen`
 *  'verlegung', `benachrichtigung_verlegt`). `heute` am Trainingsort. */
export function mitteilbarEinzeln(e: {
  vorher: VerlegungStand & { ausgefallen: boolean };
  nachher: VerlegungStand;
  art: "training" | "spiel";
  heute: string;
}): boolean {
  return (
    istVerlegung(e.vorher, e.nachher) &&
    benachrichtigungZaehlt(e.nachher.datum, e.heute) &&
    (!e.vorher.ausgefallen || ausfallEndet(e.vorher, e.nachher, e.art, e.heute))
  );
}

/** Ob eine Änderung über die Serie mitgeteilt werden kann (#644 AK 2, #645
 *  PC 3): Die Serie reicht bis heute oder später (`serieEnde` = das spätere
 *  Ende vor oder nach der Änderung — ein kürzerer Zeitraum lässt Termine bis
 *  zum bisherigen Ende wegfallen), und Wochentage oder Zeitraum
 *  (`regelGeaendert`), Zeit oder Ort ändern sich. Genau zählt die Vorschau
 *  (`mitteilbar`), verlegte und wegfallende Termine zusammen. Zwilling der
 *  Datenebene: `benachrichtigung_serie_zeilen`. */
export function mitteilbarSerie(e: {
  vorher: VerlegungStand;
  nachher: VerlegungStand;
  regelGeaendert: boolean;
  serieEnde: string;
  heute: string;
}): boolean {
  return benachrichtigungZaehlt(e.serieEnde, e.heute) && (e.regelGeaendert || istVerlegung(e.vorher, e.nachher));
}
