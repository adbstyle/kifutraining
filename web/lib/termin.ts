// Die Regeln eines Termins (Team-Kalender #322, #323; vorher Team-Epic
// Stories 7–9 und #198).
//
// Eine Regelquelle für den Kalender der Oberfläche und die KI-Werkzeuge
// «termin_*» und «training_zuordnen» — der Fachkern (lib/kern/termine.ts)
// ruft sie vor jedem Schreiben auf, und die Datenebene meldet mit denselben
// Markern (TERMIN_MELDUNG), wenn sie trotzdem abweist.
//
// REIN: importiert nur lib/termin-felder.ts und lib/spiel.ts (ebenfalls
// rein) — `check:kern` lädt diese Datei mit tsx.
import { gleicheBesetzung, type Mindestbesetzung } from "@/lib/besetzung";
import { gleicheFelder, type Felder } from "@/lib/termin-felder";
import { TREFFPUNKT_ORT_MAX, TREFFPUNKT_TEXT, treffpunkteNormal, type TerminArt, type Treffpunkt } from "@/lib/spiel";

/** Der Treffpunkt eines Trainings (#561): Uhrzeit `HH:MM` am Termintag und
 *  Ort — nicht zu verwechseln mit den Treffpunkten eines Spiels (#465).
 *  Gespeichert ist der Abstand zum Beginn (`treffpunkt_vorlauf_min`). */
export type TerminTreffpunkt = { zeit: string; ort: string };

/** Die Angaben eines Termins, wie der Dialog sie führt. `felder` sind die
 *  Felder des Platzes (#389, lib/termin-felder.ts) — nicht zu verwechseln mit
 *  den Formularfeldern, nach denen dieser Typ heisst. */
export type TerminFelder = {
  datum: string;
  beginn?: string | null;
  ende?: string | null;
  ort?: string | null;
  /** Der Kartenlink zum Ort (#533); leer = keiner. */
  ortLink?: string | null;
  bemerkung?: string | null;
  /** Der Hinweis für Eltern (#590); leer = keiner. */
  hinweisEltern?: string | null;
  /** `null`: ohne Felder (Platz unbekannt). */
  felder?: Felder | null;
  /** Die erwartete Spielerzahl (#390); `null`: unbekannt. */
  spielerzahl?: number | null;
  /** Wie viele Trainer:innen mindestens dabei sein sollen (#521); `null`: keine. */
  mindestbesetzung?: Mindestbesetzung;
  /** Training oder Spiel (#459); nur beim Festlegen, danach fest. */
  art?: TerminArt;
  /** Nur an einem Spiel: Bezeichnung und Richtwert (#459). */
  bezeichnung?: string | null;
  richtwertMin?: number | null;
  richtwertMax?: number | null;
  /** Nur an einem Spiel: die Meldefrist `YYYY-MM-DDTHH:MM`; leer = keine (#463). */
  meldefrist?: string | null;
  /** Nur an einem Spiel: die Treffpunkte als ganze Liste (#465). */
  treffpunkte?: Treffpunkt[];
  /** Nur an einem Training: der Treffpunkt (#561); `null`: keiner. */
  treffpunkt?: TerminTreffpunkt | null;
};

export type TerminFeld = "datum" | "beginn" | "ende" | "ort" | "ortLink" | "bemerkung" | "hinweisEltern" | "treffpunkt";
export type TerminProblem = { feld: TerminFeld; text: string };

/** Zwillinge der Checks `tt_ort_laenge` und `tt_bemerkung_laenge`. */
export const ORT_MAX = 100;
export const BEMERKUNG_MAX = 500;
/** Zwilling der Checks `tt_hinweis_eltern_laenge` und `ts_hinweis_eltern_laenge` (#590 AK 16). */
export const HINWEIS_ELTERN_MAX = 500;
/** Zwilling der Checks `tt_ort_link` und `ts_ort_link` (#533 AK 5). */
export const KARTENLINK_MAX = 500;

/** Die erwartete Spielerzahl (#390, PO 7): ganze Zahl von 1 bis 200 wie der
 *  Kinder-Filter der Übungssuche. Zwilling des Checks `tt_spielerzahl`. */
export const SPIELERZAHL_MIN = 1;
export const SPIELERZAHL_MAX = 200;

export const TERMIN_TEXT = {
  datum: "Bitte ein Datum angeben.",
  uhrzeit: "Bitte eine gültige Uhrzeit angeben.",
  zeitPflicht: "Bitte Beginn und Ende angeben.",
  endeNachBeginn: "Das Ende muss am selben Tag nach dem Beginn liegen.",
  ortLang: `Der Ort darf höchstens ${ORT_MAX} Zeichen lang sein.`,
  bemerkungLang: `Die Bemerkung darf höchstens ${BEMERKUNG_MAX} Zeichen lang sein.`,
  hinweisElternLang: `Der Hinweis für Eltern darf höchstens ${HINWEIS_ELTERN_MAX} Zeichen lang sein.`,
  /** Wer den Hinweis liest und wer die Bemerkung (#590 AK 6, 7, 15) — als
   *  Hinweis am Feld und im KI-Werkzeug. */
  hinweisElternSichtbar:
    "Die Eltern sehen den Hinweis über ihren privaten Link und im Kalender-Abo, ausser der Termin fällt aus.",
  bemerkungIntern: "Die Bemerkung ist für das Team. Die Eltern sehen sie nicht.",
  grundLang: `Der Grund darf höchstens ${BEMERKUNG_MAX} Zeichen lang sein.`,
  /** Wer den Grund liest (#530 AK 6, 7) — als Hinweis am Feld und im KI-Werkzeug. */
  grundSichtbar: "Die Eltern sehen den Grund des Ausfalls über ihren privaten Link.",
  kartenlinkUngueltig: "Füge den ganzen Link ein, er beginnt mit https://.",
  kartenlinkLang: `Der Kartenlink darf höchstens ${KARTENLINK_MAX} Zeichen lang sein.`,
  kartenlinkOhneOrt: "Gib zuerst einen Ort an.",
  /** Wer den Link öffnet (#533) — als Hinweis am Feld und im KI-Werkzeug. */
  kartenlinkSichtbar: "Die Eltern öffnen den Kartenlink über ihren privaten Link.",
  /** #533 AK 12, 13: vor dem Speichern, wenn der Link mit dem Ort wegfällt. */
  kartenlinkFaelltWeg: "Der Kartenlink gehörte zum bisherigen Ort und fällt weg. Füge den Link zum neuen Ort ein.",
  kartenlinkFolgtSerie: "Mit dem Ort der Serie gilt auch ihr Kartenlink, der eigene Kartenlink dieses Termins fällt weg.",
  spielerzahl: `Die erwartete Spielerzahl ist eine ganze Zahl von ${SPIELERZAHL_MIN} bis ${SPIELERZAHL_MAX}.`,
  /** Was die Zahl zählt (PO 7) — als Hinweis am Feld und im KI-Werkzeug. */
  spielerzahlZaehlt: "Alle erwarteten Kinder einschliesslich Torhüter:innen, ohne Trainer:innen.",
  treffpunktPflicht: "Bitte für den Treffpunkt Uhrzeit und Ort angeben.",
  /** Zwilling der Checks `tt_treffpunkt_termintag` und `ts_treffpunkt_termintag`. */
  treffpunktTermintag: "Der Treffpunkt liegt am Tag des Trainings und nicht nach dem Beginn.",
  /** Wer den Treffpunkt sieht und was beim Verlegen geschieht (#561 AK 11) —
   *  als Hinweis am Feld und im KI-Werkzeug. */
  treffpunktSichtbar:
    "Wann und wo sich das Team vor dem Beginn trifft, etwa bei den Garderoben. Die Eltern sehen den Treffpunkt " +
    "über ihren privaten Link und im Kalender-Abo. Wird der Termin verlegt, behält er seinen Abstand zum Beginn.",
  treffpunktNurTraining: "Einen Treffpunkt mit Uhrzeit und Ort gibt es nur an einem Training; ein Spiel hat Treffpunkte je Anreiseart.",
  /** #561 PC 5, 6: vor dem Speichern und im Ergebnis der KI. */
  treffpunktEntfaellt: "Mit dem neuen Beginn läge der Treffpunkt am Vortag. Er entfällt, das Training hat danach keinen Treffpunkt.",
  /** #561 AK 9: Der Treffpunkt der Serie läge mit der eigenen Zeit des Termins am Vortag. */
  treffpunktFolgtNicht:
    "Mit der eigenen Zeit dieses Termins läge der Treffpunkt der Serie am Vortag. Lass zuerst die Zeit der Serie folgen.",
  /** #561 PC 4: beim Erstellen — ohne Rückfrage, der Dialog hält an. */
  treffpunktVortag: "Mit diesem Beginn läge der Treffpunkt am Vortag. Wähle eine andere Uhrzeit oder entferne den Treffpunkt.",
  treffpunktEntfaelltSerie:
    "Mit dem neuen Beginn läge der Treffpunkt am Vortag. An diesen Terminen hat das Training danach keinen Treffpunkt:",
} as const;

/** Der Treffpunkt liegt nach dem Beginn (#561 AK 5) — mit der spätesten Uhrzeit. */
export function treffpunktNachBeginnText(beginn: string): string {
  return `Der Treffpunkt liegt nach dem Beginn. Wähle eine Uhrzeit bis ${beginn}.`;
}

/** Minuten seit Mitternacht einer Uhrzeit `HH:MM`. */
function minuten(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

/** Liegt ein Treffpunkt `vorlauf` Minuten vor `beginn` am selben Tag? Ohne
 *  Treffpunkt wahr. Zwilling von `treffpunkt_passt`. */
export function treffpunktPasst(vorlauf: number | null, beginn: string): boolean {
  return vorlauf === null || (vorlauf >= 0 && vorlauf <= minuten(beginn));
}

/** Der Abstand eines Treffpunkts um `zeit` zum Beginn, in Minuten. */
export function treffpunktVorlauf(beginn: string, zeit: string): number {
  return minuten(beginn) - minuten(zeit);
}

/** Die Uhrzeit eines Treffpunkts `vorlauf` Minuten vor `beginn`; `null`, wenn
 *  er dann am Vortag läge. */
export function treffpunktZeit(beginn: string, vorlauf: number): string | null {
  const m = minuten(beginn) - vorlauf;
  if (vorlauf < 0 || m < 0) return null;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Der Treffpunkt, wie er gespeichert wird (#561 PC 1): Abstand zum Beginn
 *  und Ort, beides getrimmt. Vorher mit `treffpunktProblem` geprüft. */
export function treffpunktGespeichert(t: TerminTreffpunkt, beginn: string): { vorlauf_min: number; ort: string | null } {
  return { vorlauf_min: treffpunktVorlauf(beginn.trim(), t.zeit.trim()), ort: leerZuNull(t.ort) };
}

/** Was am Treffpunkt eines Trainings nicht stimmt, sonst `null` (#561 AK 3, 5,
 *  6). Ohne Treffpunkt stimmt alles; der Beginn ist vorher geprüft. */
export function treffpunktProblem(
  t: TerminTreffpunkt | null | undefined,
  beginn: string | null | undefined,
): { feld: "treffpunkt"; text: string } | null {
  if (!t) return null;
  const zeit = leerZuNull(t.zeit);
  const ort = leerZuNull(t.ort);
  if (zeit === null || ort === null) return { feld: "treffpunkt", text: TERMIN_TEXT.treffpunktPflicht };
  if (!istUhrzeit(zeit)) return { feld: "treffpunkt", text: TERMIN_TEXT.uhrzeit };
  if ([...ort].length > TREFFPUNKT_ORT_MAX) return { feld: "treffpunkt", text: TREFFPUNKT_TEXT.ortLang };
  const b = leerZuNull(beginn);
  if (b !== null && istUhrzeit(b) && zeit > b) return { feld: "treffpunkt", text: treffpunktNachBeginnText(b) };
  return null;
}

/** Leere Eingaben sind „nicht erfasst", nicht „leerer Text". */
export function leerZuNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/** Gibt es diesen Kalendertag? `YYYY-MM-DD` allein genügt nicht: «2026-02-30»
 *  passt auf das Muster, die `date`-Spalte weist ihn aber ab — über den
 *  KI-Client jederzeit eingebbar. Das Jahr 0000 kennt Postgres ebenfalls nicht. */
export function istKalendertag(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (j < 1 || mo < 1 || mo > 12 || t < 1) return false;
  return t <= new Date(Date.UTC(j, mo, 0)).getUTCDate();
}

/** Eine Uhrzeit `HH:MM` innerhalb eines Tages; «24:00» ist kein Beginn. */
export function istUhrzeit(hhmm: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/** Beginn und Ende als EINE Angabe (Story 5 PC 2): beide da, beide gültig,
 *  das Ende am selben Tag danach (AK 5). */
export function zeitProblem(
  beginnRoh: string | null | undefined,
  endeRoh: string | null | undefined,
): { feld: "beginn" | "ende"; text: string } | null {
  const beginn = leerZuNull(beginnRoh);
  const ende = leerZuNull(endeRoh);
  if (!beginn) return { feld: "beginn", text: TERMIN_TEXT.zeitPflicht };
  if (!ende) return { feld: "ende", text: TERMIN_TEXT.zeitPflicht };
  if (!istUhrzeit(beginn)) return { feld: "beginn", text: TERMIN_TEXT.uhrzeit };
  if (!istUhrzeit(ende)) return { feld: "ende", text: TERMIN_TEXT.uhrzeit };
  if (ende <= beginn) return { feld: "ende", text: TERMIN_TEXT.endeNachBeginn };
  return null;
}

/** Ein Kartenlink ist eine vollständige https-Adresse ohne Leerraum, höchstens
 *  500 Zeichen (#533 AK 5) — gezählt in Zeichen wie `char_length`. Zwilling der
 *  Checks `tt_ort_link` und `ts_ort_link`; die Prüfung hier ist strenger (eine
 *  gültige Adresse), die Datenebene die Untergrenze. Leer ist kein Link. */
export function kartenlinkProblem(v: string | null | undefined): { feld: "ortLink"; text: string } | null {
  const link = leerZuNull(v);
  if (link === null) return null;
  if ([...link].length > KARTENLINK_MAX) return { feld: "ortLink", text: TERMIN_TEXT.kartenlinkLang };
  if (!/^https:\/\/\S+$/.test(link)) return { feld: "ortLink", text: TERMIN_TEXT.kartenlinkUngueltig };
  try {
    if (new URL(link).protocol !== "https:") throw new Error();
  } catch {
    return { feld: "ortLink", text: TERMIN_TEXT.kartenlinkUngueltig };
  }
  return null;
}

/** Kein Kartenlink ohne Ort (#533 AK 4) — am ganzen Stand, nicht an einer
 *  Teiländerung. */
export function kartenlinkOhneOrt(f: { ort?: string | null; ortLink?: string | null }): { feld: "ortLink"; text: string } | null {
  return leerZuNull(f.ortLink) !== null && leerZuNull(f.ort) === null
    ? { feld: "ortLink", text: TERMIN_TEXT.kartenlinkOhneOrt }
    : null;
}

/** Ort, Kartenlink, Bemerkung und Hinweis für Eltern sind frei, aber begrenzt
 *  (AK 6; #533 AK 5; #590 AK 16). */
export function textProblem(f: {
  ort?: string | null;
  ortLink?: string | null;
  bemerkung?: string | null;
  hinweisEltern?: string | null;
}): { feld: "ort" | "ortLink" | "bemerkung" | "hinweisEltern"; text: string } | null {
  if ((leerZuNull(f.ort) ?? "").length > ORT_MAX) return { feld: "ort", text: TERMIN_TEXT.ortLang };
  const link = kartenlinkProblem(f.ortLink);
  if (link) return link;
  if ((leerZuNull(f.bemerkung) ?? "").length > BEMERKUNG_MAX)
    return { feld: "bemerkung", text: TERMIN_TEXT.bemerkungLang };
  if ((leerZuNull(f.hinweisEltern) ?? "").length > HINWEIS_ELTERN_MAX)
    return { feld: "hinweisEltern", text: TERMIN_TEXT.hinweisElternLang };
  return null;
}

/** Was an einem Termin nicht stimmt, sonst `null`. Datum, Beginn und Ende
 *  sind an jedem Termin Pflicht (AK 2; Zwilling: NOT NULL und
 *  `tt_ende_nach_beginn`). */
export function terminProblem(
  f: {
    datum?: string | null;
    beginn?: string | null;
    ende?: string | null;
    ort?: string | null;
    ortLink?: string | null;
    bemerkung?: string | null;
    hinweisEltern?: string | null;
    treffpunkt?: TerminTreffpunkt | null;
  },
): TerminProblem | null {
  if (!istKalendertag(f.datum ?? "")) return { feld: "datum", text: TERMIN_TEXT.datum };
  return zeitProblem(f.beginn, f.ende) ?? textProblem(f) ?? kartenlinkOhneOrt(f) ?? treffpunktProblem(f.treffpunkt, f.beginn);
}

/** Die erwartete Spielerzahl (#390 AK 3): `null` heisst unbekannt, sonst eine
 *  ganze Zahl von 1 bis 200. Zwilling des Checks `tt_spielerzahl`; die
 *  Meldung ist an Oberfläche und KI wortgleich (AK 7). */
export function spielerzahlProblem(n: unknown): { feld: "erwartete_spielerzahl"; text: string } | null {
  if (n === null) return null;
  return typeof n === "number" && Number.isInteger(n) && n >= SPIELERZAHL_MIN && n <= SPIELERZAHL_MAX
    ? null
    : { feld: "erwartete_spielerzahl", text: TERMIN_TEXT.spielerzahl };
}

/** Eine getippte Zahl: leer heisst unbekannt (`null`), sonst die Zahl — auch
 *  eine ungültige, damit `spielerzahlProblem` sie meldet. */
export function zahlOderNull(text: string | null | undefined): number | null {
  const t = (text ?? "").trim();
  return t === "" ? null : Number(t);
}

/** Die erwartete Spielerzahl zum Anzeigen: «12 Spieler:innen», «1 Spieler:in». */
export function spielerzahlText(n: number): string {
  return `${n} ${n === 1 ? "Spieler:in" : "Spieler:innen"}`;
}

/** Der Grund eines Ausfalls folgt den Regeln der Bemerkung (#327 AK 4);
 *  Zwilling des Checks `tt_ausfall_grund`. */
export function ausfallProblem(grund: string | null | undefined): { feld: "grund"; text: string } | null {
  return (leerZuNull(grund) ?? "").length > BEMERKUNG_MAX ? { feld: "grund", text: TERMIN_TEXT.grundLang } : null;
}

/** Was sich gegenüber den Startwerten des Dialogs geändert hat — sonst nichts
 *  (PO 17): Der Dialog sendet nur diese Felder, damit eine gleichzeitige
 *  Änderung eines anderen Feldes durch ein anderes Mitglied nicht still mit
 *  dem alten Stand überschrieben wird. Beginn und Ende gehen als Paar (ändert
 *  sich eines, stehen beide drin); ein leerer Text heisst «leeren».
 *  `null`, wenn sich nichts geändert hat — dann braucht es keinen Aufruf.
 *  Gleich sind zwei Texte, wenn sie nach `leerZuNull` gleich sind, zwei
 *  Angaben zu den Feldern, wenn ihre gespeicherte Form gleich ist
 *  (`gleicheFelder`); geänderte Felder gehen als ganze Liste, `null` heisst
 *  «entfernen» — ebenso bei der erwarteten Spielerzahl. */
export function geaenderteFelder(neu: TerminFelder, start: TerminFelder): Partial<TerminFelder> | null {
  const gleich = (a: string | null | undefined, b: string | null | undefined) => leerZuNull(a) === leerZuNull(b);
  const aenderung: Partial<TerminFelder> = {};
  if (neu.datum !== start.datum) aenderung.datum = neu.datum;
  if (!gleich(neu.beginn, start.beginn) || !gleich(neu.ende, start.ende)) {
    aenderung.beginn = neu.beginn ?? "";
    aenderung.ende = neu.ende ?? "";
  }
  // Ort und Kartenlink gehen als Paar (#533): Der Kern leert den Link, wenn
  // sich der Ort ohne ihn ändert, und die Serie braucht beide zusammen.
  if (!gleich(neu.ort, start.ort) || !gleich(neu.ortLink, start.ortLink)) {
    aenderung.ort = neu.ort ?? "";
    aenderung.ortLink = neu.ortLink ?? "";
  }
  if (!gleich(neu.bemerkung, start.bemerkung)) aenderung.bemerkung = neu.bemerkung ?? "";
  if (!gleich(neu.hinweisEltern, start.hinweisEltern)) aenderung.hinweisEltern = neu.hinweisEltern ?? "";
  if (!gleicheFelder(neu.felder, start.felder)) aenderung.felder = neu.felder ?? null;
  if ((neu.spielerzahl ?? null) !== (start.spielerzahl ?? null)) aenderung.spielerzahl = neu.spielerzahl ?? null;
  if (neu.mindestbesetzung !== undefined && !gleicheBesetzung(neu.mindestbesetzung, start.mindestbesetzung ?? null))
    aenderung.mindestbesetzung = neu.mindestbesetzung;
  if (!gleich(neu.bezeichnung, start.bezeichnung)) aenderung.bezeichnung = neu.bezeichnung ?? "";
  if ((neu.richtwertMin ?? null) !== (start.richtwertMin ?? null)) aenderung.richtwertMin = neu.richtwertMin ?? null;
  if ((neu.richtwertMax ?? null) !== (start.richtwertMax ?? null)) aenderung.richtwertMax = neu.richtwertMax ?? null;
  // Die Frist nur, wenn sie selbst geändert wurde: Eine Verlegung nimmt sie
  // im selben Abstand mit (#463 PC 3).
  if (!gleich(neu.meldefrist, start.meldefrist)) aenderung.meldefrist = leerZuNull(neu.meldefrist);
  // Die Treffpunkte ebenso (#465 PC 2): gleich sind sie, wenn sie denselben
  // Abstand zum jeweiligen Anpfiff haben.
  if (neu.treffpunkte && !gleicheTreffpunkte(neu, start)) aenderung.treffpunkte = neu.treffpunkte;
  // Der Treffpunkt eines Trainings ebenso (#561 PC 1): gleich bei gleichem
  // Ort und Abstand zum jeweiligen Beginn; `undefined` heisst unverändert.
  if (neu.treffpunkt !== undefined && !gleicherTreffpunkt(neu, start)) aenderung.treffpunkt = neu.treffpunkt;
  return Object.keys(aenderung).length > 0 ? aenderung : null;
}

/** Haben zwei Stände denselben Treffpunkt — je zu ihrem Beginn? Ein
 *  ungültiger ist nie gleich: Er geht zur Prüfung mit. */
function gleicherTreffpunkt(neu: TerminFelder, start: TerminFelder): boolean {
  const form = (f: TerminFelder) => {
    if (!f.treffpunkt) return "ohne";
    const zeit = leerZuNull(f.treffpunkt.zeit);
    const beginn = leerZuNull(f.beginn);
    if (zeit === null || beginn === null || !istUhrzeit(zeit) || !istUhrzeit(beginn)) return null;
    return `${treffpunktVorlauf(beginn, zeit)}|${leerZuNull(f.treffpunkt.ort) ?? ""}`;
  };
  const a = form(neu);
  return a !== null && a === form(start);
}

/** Haben zwei Stände dieselben Treffpunkte — je zu ihrem Anpfiff? Eine
 *  ungültige Liste ist nie gleich: Sie geht zur Prüfung mit. */
function gleicheTreffpunkte(neu: TerminFelder, start: TerminFelder): boolean {
  const form = (f: TerminFelder) => {
    const r = treffpunkteNormal(f.treffpunkte ?? [], f.datum, f.beginn ?? "");
    return r.ok ? JSON.stringify([...r.zeilen].sort((a, b) => a.anreise.localeCompare(b.anreise))) : null;
  };
  const a = form(neu);
  return a !== null && a === form(start);
}

/** Die Erfolgsmeldung nach dem Zuordnen — von überall dieselbe. Dass der
 *  Termin still eine eigene Kopie bekommt, sagt sie nicht (PO 2026-10-06). */
export const ZUORDNEN_ERFOLG = "Training zugeordnet.";

/** Was mit einem Training geschieht, das seinen Termin verliert (lösen,
 *  ersetzen, Termin entfernen, Serienänderung): Ein Termin-Training wird
 *  gelöscht, ein älteres Training aus dem Bestand bleibt dort (PO 2026-10-06).
 *  Eine Formulierung für alle Dialoge. */
export function trainingOhneTermin(terminTraining: boolean): string {
  return terminTraining ? "wird gelöscht" : "bleibt im Team-Bestand";
}

/** Die Zeit eines Termins zum Anzeigen: «18:30–20:00». */
export function zeitText(beginn: string, ende: string): string {
  return `${beginn}–${ende}`;
}

/** Die Sätze zu den Markern der Datenebene (Migration termine_ohne_training)
 *  — dieselben, die der Fachkern vorab verwendet. */
export const TERMIN_MELDUNG = {
  TERMIN_NICHT_GEFUNDEN: "Termin nicht gefunden.",
  TRAINING_NICHT_GEFUNDEN: "Training nicht gefunden.",
  TERMIN_BELEGUNG_GEAENDERT:
    "Am Termin hat sich inzwischen etwas geändert: Ihm wurde ein anderes Training zugeordnet " +
    "oder sein Training gelöst. Sieh ihn dir noch einmal an.",
  TERMIN_TRAINING_FREMDES_TEAM:
    "Einem Termin lassen sich nur Trainings seines Teams oder deine persönlichen Trainings zuordnen.",
  /** Rückhalt der Datenebene: Zugeordnet wird nur eine frische Kopie. */
  TRAINING_SCHON_EINGEPLANT: "Dieses Training gehört schon einem Termin.",
  TERMIN_AUSGEFALLEN:
    "Einem ausgefallenen Termin lässt sich kein Training zuordnen. Nimm den Ausfall zuerst zurück.",
  NICHT_AUSGEFALLEN: "Dieser Termin ist nicht ausgefallen.",
  AUSFALL_GEAENDERT:
    "Der Termin ist inzwischen ausgefallen oder sein Ausfall wurde zurückgenommen. Sieh ihn dir noch einmal an.",
  NICHT_MEHR_MITGLIED:
    "Mindestens eine gewählte Person ist nicht mehr Mitglied des Teams. Sieh dir die Mitglieder noch einmal an.",
  /** #561 AK 5: Rückhalt der Datenebene, wenn der Fachkern umgangen wird. */
  TREFFPUNKT_TERMINTAG: TERMIN_TEXT.treffpunktTermintag,
} as const;

export type TerminMarker = keyof typeof TERMIN_MELDUNG;

/** Marker, die «seit der Auswahl geändert» heissen (PO 17) — der Fachkern
 *  ordnet sie als `konflikt` ein, nicht als Regel. Die Sätze der Serien-Marker
 *  stehen in `SERIE_MELDUNG` (lib/serie.ts); `istVeraltet` (lib/veraltet.ts)
 *  löst beide Tabellen auf. */
export const KONFLIKT_MARKER: readonly string[] = [
  "TERMIN_BELEGUNG_GEAENDERT",
  "AUSFALL_GEAENDERT",
  "SERIE_GEAENDERT",
  "SERIE_BELEGUNG_GEAENDERT",
  "SERIE_VERFALL_GEAENDERT",
];

/** Ein Zusatz zu jeder Meldung, deren Kopie nicht aufgeräumt werden konnte
 *  (Story 2 PC 9, Story 7 PC 8) — in der Oberfläche und beim Assistenten. */
export function kopieGebliebenText(name: string): string {
  return `Eine unvollständige Kopie «${name}» ist im Team-Bestand geblieben; du kannst sie dort entfernen.`;
}
