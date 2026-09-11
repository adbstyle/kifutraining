/**
 * Gruppen eines Trainings (Story #149) — reine Fachlogik ohne Server-Bezug.
 *
 * Eine Gruppe ist eine Bezeichnung am Training, mehr nicht: die Anwendung führt
 * keine Kinder und keine Kinderzahl. Was hier steht, entscheidet ausschliesslich,
 * welche Bezeichnung zulässig ist.
 *
 * Jede Regel nennt ihren SQL-Zwilling aus der Migration `training_gruppen`. Die
 * Datenbank ist die Trust-Boundary — diese Datei ist die frühe, sprechende
 * Antwort im Formular, nicht die Absicherung.
 *
 * Die Namensregel selbst steht seit #201 in `lib/bezeichnung.ts`: Die Variante
 * des Hauptteils trägt dieselbe. Was hier davon übrig ist, sind Namen mit
 * Gruppen-Bezug — die Aufrufer (und der SQL-Zwilling, den sie nennen) reden von
 * Gruppen, nicht von «Bezeichnungen».
 */
import {
  MELDUNG_VERGEBEN,
  bezeichnungProblem,
  bezeichnungSchluessel,
} from "@/lib/bezeichnung";

export { MELDUNG_VERGEBEN };

/** Längstmögliche Bezeichnung einer Gruppe (getrimmt gezählt).
 *  SQL-Zwilling: `tg_name_laenge` an `training_gruppen`. */
export const GRUPPE_NAME_MAX = 40;

/**
 * Der Schlüssel, unter dem zwei Bezeichnungen als dieselbe gelten (AK 7).
 *
 * SQL-Zwilling: `lower(btrim(name))` im Unique-Index `tg_name_je_training`.
 * `toLocaleLowerCase("de")` statt `toLowerCase()`, damit die Kleinschreibung
 * derselben Sprache folgt wie die Anzeige — bei deutschen Bezeichnungen fallen
 * beide zusammen, aber die Absicht steht so im Code.
 */
export function gruppenSchluessel(name: string): string {
  return bezeichnungSchluessel(name);
}

/**
 * Was einer Bezeichnung im Weg steht — `null`, wenn sie sich speichern lässt.
 *
 * `bestehende` sind alle Gruppen desselben Trainings. `eigeneId` schaltet beim
 * Umbenennen die eigene Zeile aus der Kollisionsprüfung aus: sonst wäre
 * «Gruppe 1» → «gruppe 1» ein Fehler gegen sich selbst (AK 8).
 *
 * Die Meldungen sind der Text am Feld, nicht ein Protokolleintrag — sie sagen,
 * was zu tun ist, und nennen die Regel, nicht die Spalte.
 */
export function nameProblem(
  name: string,
  bestehende: readonly { id: string; name: string }[],
  eigeneId?: string,
): string | null {
  return bezeichnungProblem(name, bestehende, { eigeneId, max: GRUPPE_NAME_MAX });
}

// ── Verteilung: welche Gruppe wann an welcher Übung (Story #150) ────────────

/**
 * Die Einordnungen, in denen Gruppen gelten — der Hauptteil beider
 * Altersstufen (AK 10 / Epic Out of Scope 1).
 *
 * Im Kinderfussball ist der Hauptteil EIN Trainingsteil, im Juniorenfussball
 * zerfällt er in die beiden Blöcke «Spielformen und unterstützende Übungen»
 * und «Spiel» — die Einordnung einer Junioren-Fassung ist der Block, darum
 * stehen hier drei Werte. Über beide Blöcke hinweg gilt derselbe Durchlauf
 * (AK 5).
 *
 * SQL-Zwilling: `einordnung_traegt_gruppen(text)` in der Migration
 * `gruppen_zuweisung`.
 */
const HAUPTTEIL_EINORDNUNGEN = ["hauptteil", "jun-spielformen", "jun-spiel"];

/** Trägt diese Einordnung Gruppen? Speist `EditorBlock.traegtGruppen`. */
export function istHauptteil(einordnung: string): boolean {
  return HAUPTTEIL_EINORDNUNGEN.includes(einordnung);
}

/**
 * Die Verteilung eines Trainings: seine Hauptteil-Fassungen in Anzeigereihenfolge,
 * jede mit der Folge der Gruppen, die sie durchlaufen.
 *
 * `gruppen` sind Gruppen-IDs in WECHSELREIHENFOLGE — der Index ist der Wechsel
 * (AK 11): das Zeitfenster, das über alle Übungen des Hauptteils dasselbe
 * meint. Die leere Folge heisst «alle gemeinsam» (AK 7), nicht «noch nichts
 * eingetragen».
 *
 * `dauer` ist die erfasste Dauer der Übung in Minuten oder `null`. Eine Übung
 * ohne Dauer zählt beim Vergleich nicht mit — sie liesse sich nicht vergleichen,
 * und eine fehlende Dauer meldet der Editor bereits an anderer Stelle.
 */
export type Verteilung = {
  id: string;
  name: string;
  einordnung: string;
  dauer: number | null;
  gruppen: string[];
}[];

/** Wie viele Wechsel der Hauptteil hat: die längste Folge. Der Durchlauf einer
 *  einzelnen Übung kann kürzer sein — sie steht dann nicht in jedem Wechsel. */
export function wechselZahl(v: Verteilung): number {
  return v.reduce((max, f) => Math.max(max, f.gruppen.length), 0);
}

/** Ein gemeldeter Konflikt der Verteilung. Gemeldet, nie gesperrt (AK 15). */
export type Konflikt = { art: "doppelt" | "ungleich"; text: string };

/** Was `konfliktBefund` zurückgibt — eine Rechnung, drei Anzeigeorte. */
export type Befund = {
  /** Die Meldungen am Kartenfuss des Hauptteils, doppelt vor ungleich. */
  konflikte: Konflikt[];
  /** Chips, die einen Konflikt tragen. Schlüssel: `${fassungId}|${gruppeId}`. */
  chipWarnung: Set<string>;
  /** Fassungen, deren Dauer in einem ungleichen Wechsel steht (Fassungs-IDs). */
  dauerWarnung: Set<string>;
  /** Der Kurztext für die Gruppenzeile, je Gruppen-ID. */
  gruppenWarnung: Map<string, string>;
};

/** Zahlwörter bis neun — «an zwei Übungen» liest sich als Satz, «an 2 Übungen»
 *  als Tabelle. Darüber hinaus die Ziffer; so viele Übungen im selben Wechsel
 *  gibt es in der Praxis nicht. */
const ZAHLWORT = ["null", "eine", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
const zahlwort = (n: number) => ZAHLWORT[n] ?? String(n);

/** «1. Wechsel», «1. und 2. Wechsel», «1., 2. und 3. Wechsel»; darüber
 *  abgekürzt, damit die Zeile eine Zeile bleibt. `ws` sind 0-basierte Indizes
 *  in aufsteigender Folge. */
function wechselAufzaehlung(ws: number[]): string {
  const n = ws.map((w) => `${w + 1}.`);
  if (n.length === 1) return `${n[0]} Wechsel`;
  if (n.length === 2) return `${n[0]} und ${n[1]} Wechsel`;
  if (n.length === 3) return `${n[0]}, ${n[1]} und ${n[2]} Wechsel`;
  return `${n.slice(0, 3).join(", ")} Wechsel und weiteren`;
}

/** «10 und 15 min», «10, 15 und 20 min» — die Einheit einmal am Ende. */
function dauerAufzaehlung(dauern: number[]): string {
  const kopf = dauern.slice(0, -1).join(", ");
  const letzte = dauern[dauern.length - 1];
  return `${kopf} und ${letzte} min`;
}

/** Haben zwei aufsteigend sortierte Dauermengen denselben Inhalt? */
function gleicheDauern(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

/**
 * Was an einer Verteilung nicht aufgeht (AK 13/14).
 *
 * Zwei Befunde, beide am Wechsel — dem Zeitfenster, das über alle Übungen des
 * Hauptteils dasselbe meint:
 *
 * - **doppelt**: Eine Gruppe steht im selben Wechsel an mehr als einer Übung.
 *   Sie kann nicht an zwei Orten gleichzeitig sein.
 * - **ungleich**: Die Übungen eines Wechsels sind unterschiedlich lang. Dann
 *   endet eine Gruppe früher als die andere, und der Wechsel geht nicht auf.
 *
 * Aufeinanderfolgende ungleiche Wechsel mit derselben Dauermenge werden zu
 * einer Zeile verdichtet: Es ist dieselbe Sachlage, und drei Zeilen mit
 * demselben Wortlaut sind schwerer zu lesen als eine.
 *
 * Was NICHT gemeldet wird (Out of Scope 2): eine Übung ohne Gruppen und eine
 * Gruppe, die weniger Übungen durchläuft als eine andere. Beides kann gewollt
 * sein.
 *
 * `gruppen` liefert die Bezeichnungen und zugleich die Reihenfolge der
 * Meldungen — so steht die Liste stabil, statt mit der Übungsreihenfolge zu
 * springen.
 */
export function konfliktBefund(
  v: Verteilung,
  gruppen: { id: string; name: string }[],
): Befund {
  const konflikte: Konflikt[] = [];
  const chipWarnung = new Set<string>();
  const dauerWarnung = new Set<string>();
  const gruppenWarnung = new Map<string, string>();
  const wechsel = wechselZahl(v);

  // ── doppelt ───────────────────────────────────────────────────────────────
  for (let w = 0; w < wechsel; w++) {
    for (const g of gruppen) {
      const treffer = v.filter((f) => f.gruppen[w] === g.id);
      if (treffer.length < 2) continue;
      const wo = `im ${w + 1}. Wechsel an ${zahlwort(treffer.length)} Übungen`;
      konflikte.push({ art: "doppelt", text: `${g.name} steht ${wo}.` });
      for (const f of treffer) chipWarnung.add(`${f.id}|${g.id}`);
      // Die Gruppenzeile trägt einen Kurztext, keine Sammlung: der erste
      // Konflikt sagt bereits, dass an dieser Gruppe etwas zu richten ist.
      if (!gruppenWarnung.has(g.id)) gruppenWarnung.set(g.id, `Steht ${wo}.`);
    }
  }

  // ── ungleich ──────────────────────────────────────────────────────────────
  // Erst je Wechsel die beteiligten Dauern, dann die Verdichtung: getrennt,
  // weil die Verdichtung nur Nachbarn mit derselben Dauermenge zusammenzieht
  // und dafür die Rohbefunde in Wechselreihenfolge braucht.
  const roh: { w: number; dauern: number[] }[] = [];
  for (let w = 0; w < wechsel; w++) {
    const beteiligt = v.filter((f) => f.gruppen[w] != null && f.dauer != null);
    const dauern = [...new Set(beteiligt.map((f) => f.dauer as number))].sort((a, b) => a - b);
    if (dauern.length < 2) continue;
    roh.push({ w, dauern });
    for (const f of beteiligt) dauerWarnung.add(f.id);
  }

  const verdichtet: { wechsel: number[]; dauern: number[] }[] = [];
  for (const r of roh) {
    const letzte = verdichtet[verdichtet.length - 1];
    const anschluss =
      letzte &&
      letzte.wechsel[letzte.wechsel.length - 1] === r.w - 1 &&
      gleicheDauern(letzte.dauern, r.dauern);
    if (anschluss) letzte.wechsel.push(r.w);
    else verdichtet.push({ wechsel: [r.w], dauern: r.dauern });
  }

  for (const e of verdichtet) {
    konflikte.push({
      art: "ungleich",
      text: `Im ${wechselAufzaehlung(e.wechsel)} sind die Übungen ungleich lang (${dauerAufzaehlung(e.dauern)}).`,
    });
  }

  return { konflikte, chipWarnung, dauerWarnung, gruppenWarnung };
}

// ── Zeitsumme je Gruppe (Story #151) ────────────────────────────────────────

/** Was eine Gruppe im Hauptteil zusammenzählt. `mitDauer` steht neben den
 *  Minuten, weil ohne es «0 min» und «noch keine Dauer erfasst» dieselbe Zahl
 *  wären — und das eine ist eine Auskunft, das andere eine Lücke. */
export type Zeitsumme = {
  /** Summe der erfassten Dauern in Minuten. */
  minuten: number;
  /** Wie viele der zugewiesenen Übungen eine Dauer tragen. */
  mitDauer: number;
};

/**
 * Wie lange jede Gruppe im Hauptteil beschäftigt ist (AK 1).
 *
 * Gezählt wird über die ganze Verteilung, im Juniorenfussball also über beide
 * Hauptteil-Blöcke hinweg — dieselbe Reichweite wie beim Wechsel (AK 5): Die
 * Blöcke gliedern die Übungen, nicht die Zeit.
 *
 * Eine Übung ohne erfasste Dauer zählt nicht mit; die Gruppe steht deswegen
 * aber trotzdem in der Map — mit `mitDauer = 0`, was «zugewiesen, aber keine
 * Dauer erfasst» heisst. Eine Übung ohne Zuweisung zählt bei keiner Gruppe —
 * sie machen alle gemeinsam, und das ist keine Aussage über eine einzelne
 * Gruppe.
 *
 * Gruppen ohne Zuweisung stehen NICHT in der Map. `zeitText` beantwortet das
 * fehlende Ergebnis gleich wie die Null-Summe; darum lohnt kein Vorbelegen.
 */
export function zeitJeGruppe(v: Verteilung): Map<string, Zeitsumme> {
  const summen = new Map<string, Zeitsumme>();
  for (const f of v) {
    // Über die Menge statt über die Folge: Stünde dieselbe Gruppe an einer
    // Übung zweimal, wäre das ein Datenfehler und keine doppelte Zeit.
    for (const id of new Set(f.gruppen)) {
      const s = summen.get(id) ?? { minuten: 0, mitDauer: 0 };
      if (f.dauer != null) {
        s.minuten += f.dauer;
        s.mitDauer++;
      }
      summen.set(id, s);
    }
  }
  return summen;
}

/**
 * Die Zeitsumme als kurze Angabe — «40 min» oder «—».
 *
 * Der Gedankenstrich steht für «lässt sich nicht sagen»: keine Übung
 * zugewiesen, oder keine der zugewiesenen trägt eine Dauer. «0 min» stünde
 * dort wie ein Messergebnis und wäre keines.
 *
 * Minuten ohne Stunden-Schreibweise (kein `formatDuration`): Die Angabe steht
 * neben den Angaben der anderen Gruppen und wird mit ihnen verglichen — «75»
 * und «90» liest man nebeneinander, «1 h 15 min» und «1 h 30 min» rechnet man.
 */
export function zeitKurz(s?: Zeitsumme): string {
  if (!s || s.mitDauer === 0) return "—";
  return `${s.minuten} min`;
}

/** Dieselbe Angabe als Satzanfang für die Gruppenzeile: «Zugewiesen 40 min». */
export function zeitText(s?: Zeitsumme): string {
  return `Zugewiesen ${zeitKurz(s)}`;
}
