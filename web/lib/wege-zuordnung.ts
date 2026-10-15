/**
 * Wege je Figur (#430): Zu welcher Figur gehört ein Laufweg, ein Dribbling
 * oder ein Pass/Schuss? KiFu zeichnet ihn dann in ihrer Farbe.
 *
 * Die Zuordnung wird nie gespeichert, sondern bei jeder Anzeige aus der
 * Zeichnung abgeleitet — so gilt sie sofort für jedes bestehende Diagramm,
 * auch für die Manual-Vorlagen und vom KI-Assistenten gesetzte (PC 1).
 * Gespeichert wird nur, was der Trainer korrigiert hat: die Kennung der Figur
 * am Weg (`PfadElement.figur`).
 *
 * Reihenfolge der Regeln:
 * 1. Die Korrektur des Trainers, solange ihre Figur noch auf der Fläche steht
 *    (PC 4, PC 5).
 * 2. Die Figur, an der der Weg beginnt (AK 8).
 * 3. Die Figur des Laufwegs oder Dribblings, an dessen Ende der Weg beginnt
 *    (AK 9): Dribbling, dann Pass; Lauf, dann Schuss. Ein Pass zählt hier
 *    nicht — an seinem Ende kommt der Ball an, nicht der Spieler.
 * 4. Sonst die nächstgelegene Figur (AK 10).
 */

import {
  FIGUR_TYPEN,
  type DiagrammElement,
  type PfadElement,
  type PfadTyp,
  type Punkt,
  type SymbolElement,
} from "./diagramm";

/** Die Wege, die eine Figur zurücklegt; die freie Linie ist eine Markierung. */
export const BEWEGUNGS_TYPEN: ReadonlySet<PfadTyp> = new Set(["laufweg", "dribbling", "pass"]);

export const istBewegung = (e: DiagrammElement): e is PfadElement =>
  e.art === "pfad" && BEWEGUNGS_TYPEN.has(e.typ);

/** Spieler, Torhüter und Trainer (AK 7). */
export const istFigur = (e: DiagrammElement): e is SymbolElement =>
  e.art === "symbol" && FIGUR_TYPEN.has(e.typ);

/** Bis hierhin vom Mittelpunkt der Figur beginnt ein Weg «an» ihr: die halbe
 *  Figurhöhe (145) und etwas Luft — die Manual-Pfeile setzen oft knapp neben
 *  dem Symbol an. */
export const AN_FIGUR = 90;
/** Bis hierhin vom Ende eines Laufwegs oder Dribblings beginnt ein Folgeweg. */
export const AN_WEGENDE = 60;

const abstand = (a: Punkt, b: Punkt) => Math.hypot(a.x - b.x, a.y - b.y);
const anfang = (w: PfadElement) => w.punkte[0];
const ende = (w: PfadElement) => w.punkte[w.punkte.length - 1];

/** Kennung des Weges → Kennung seiner Figur. Leer ohne Figuren. */
export function wegeJeFigur(elemente: readonly DiagrammElement[]): Map<string, string> {
  const figuren = elemente.filter(istFigur);
  const wege = elemente.filter(istBewegung);
  const zu = new Map<string, string>();
  if (figuren.length === 0) return zu;

  const figurIds = new Set(figuren.map((f) => f.id));
  const naechste = (p: Punkt) => {
    let beste = figuren[0];
    for (const f of figuren) if (abstand(f, p) < abstand(beste, p)) beste = f;
    return { figur: beste, d: abstand(beste, p) };
  };

  for (const w of wege) {
    if (w.figur && figurIds.has(w.figur)) {
      zu.set(w.id, w.figur);
      continue;
    }
    const n = naechste(anfang(w));
    if (n.d <= AN_FIGUR) zu.set(w.id, n.figur.id);
  }

  /** Der Laufweg oder das Dribbling, an dessen Ende `w` beginnt. */
  const vorgaenger = (w: PfadElement, unter: readonly PfadElement[]) =>
    unter.find((v) => v.id !== w.id && v.typ !== "pass" && abstand(ende(v), anfang(w)) <= AN_WEGENDE);

  let offen = wege.filter((w) => !zu.has(w.id));
  while (offen.length > 0) {
    // Folgewege erben die Figur ihres Vorgängers, Kette um Kette: je Runde
    // gegen die bis dahin zugeordneten Wege, bis keine Runde mehr etwas findet.
    for (let neu = true; neu; ) {
      neu = false;
      const bekannt = wege.filter((x) => zu.has(x.id));
      for (const w of offen) {
        const v = vorgaenger(w, bekannt);
        if (v) {
          zu.set(w.id, zu.get(v.id)!);
          neu = true;
        }
      }
      offen = offen.filter((w) => !zu.has(w.id));
    }
    if (offen.length === 0) break;
    // Der Anfang einer Kette, die an keiner Figur beginnt, geht an die
    // nächstgelegene; seine Folgewege erben sie in der nächsten Runde. Ein
    // Ring ohne Anfang beginnt beim ersten Weg.
    const start = offen.find((w) => !vorgaenger(w, offen)) ?? offen[0];
    zu.set(start.id, naechste(anfang(start)).figur.id);
    offen = offen.filter((w) => w !== start);
  }
  return zu;
}

/** Wie viele Wege der Trainer wirksam einer Figur zugeordnet hat: an einem
 *  Laufweg, Dribbling oder Pass und auf eine Figur, die es gibt. */
export function wirksameKorrekturen(elemente: readonly DiagrammElement[]): number {
  const figuren = new Set(elemente.filter(istFigur).map((f) => f.id));
  return elemente.filter((e) => istBewegung(e) && e.figur !== undefined && figuren.has(e.figur)).length;
}

/** Die Wege, die KiFu von den Wegen anderer Figuren abhebt: Kennung des Weges
 *  → Kennung seiner Figur. Leer, solange höchstens eine Figur Wege hat
 *  (PC 2: dann bleibt das Diagramm, wie es ist). */
export function unterschiedeneWege(elemente: readonly DiagrammElement[]): Map<string, string> {
  const zuordnung = wegeJeFigur(elemente);
  return new Set(zuordnung.values()).size >= 2 ? zuordnung : new Map();
}
