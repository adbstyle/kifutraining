/**
 * Prüfung eines Feld-Diagramms (#145, #146) — rein, ohne Server- und
 * Datenbankbezug. Die eine Quelle der Regeln für jedes gespeicherte Diagramm,
 * gleich ob in der Übungsmaske gezeichnet oder vom KI-Assistenten gesetzt
 * (#145 NFR 1), und für die Manual-Vorlagen (Seed, `check:diagramme`).
 *
 * Sie trennt zwei Arten von Befund:
 * - GRENZE — was die Zeichenfläche nicht führen kann: kaputter Aufbau,
 *   unbekannte Art, Typen, Farben, Drehungen oder Posen, ungültige Werte,
 *   fehlende oder doppelte id, mehr als `MAX_ELEMENTE`, ein Element ausserhalb
 *   der Fläche. Ein Diagramm mit Grenzverletzung wird nicht gespeichert.
 * - MANGEL — inhaltliche Befunde an zeichenbaren Elementen: ein Leibchen
 *   neben einer Figur, aber nicht an der Hand; ein Tor, das vom Feld weg
 *   öffnet; wirkungslose Angaben; ein Symbol, das über den Rand ragt; leerer
 *   Text. Das Diagramm wird trotzdem gespeichert (PO-Entscheid 2026-09-29,
 *   Story #145: wirkungslose Angaben speichern und melden).
 *
 * «Auf der Fläche» misst den Anker, wie der Editor ihn klemmt
 * (DiagrammZeichnen: beim Ziehen eines Symbols oder Texts die Mitte, nicht
 * den Rahmen): Die Grenze darf nie ablehnen, was der Editor erzeugt. Ein
 * Symbolrahmen über dem Rand ist darum nur ein Mangel.
 *
 * Nie aus lib/diagramm.ts importieren: diese Datei lädt das Symbol-Register,
 * und das importiert lib/diagramm.ts.
 */
import {
  DIAGRAMM_VERSION,
  DREHBARE_TYPEN,
  FIGUR_TYPEN,
  FLAECHE,
  FORM_TYPEN,
  MAX_ELEMENTE,
  MAX_TEXT_LAENGE,
  PFAD_TYPEN,
  POSEN_TYPEN,
  ROTATIONEN,
  SPIELER_POSEN,
  SYMBOL_TYPEN,
  bbox,
  farbSlugs,
  istPunkt,
  istZahl,
  migriereLegacy,
  parseDiagramm,
  type DiagrammData,
  type DiagrammElement,
  type FormElement,
  type PfadElement,
  type Punkt,
  type SymbolElement,
  type TextElement,
} from "@/lib/diagramm";
import { SYMBOLE, symbolMasse } from "@/components/diagramm/symbols";
import { haende, type FigurArt } from "@/components/diagramm/figur";

export const BEFUND_CODES = [
  "aufbau",
  "unbekannt",
  "wert",
  "id",
  "anzahl",
  "ausserhalb",
  "leibchen",
  "tor_richtung",
  "wirkungslos",
  "ragt_hinaus",
  "text_leer",
] as const;
export type BefundCode = (typeof BEFUND_CODES)[number];

/** Die Codes einer Grenze; alle übrigen benennen einen Mangel. */
export const GRENZ_CODES = [
  "aufbau",
  "unbekannt",
  "wert",
  "id",
  "anzahl",
  "ausserhalb",
] as const satisfies readonly BefundCode[];

export type Befund = {
  art: "grenze" | "mangel";
  code: BefundCode;
  /** 0-basiert in «elemente»; fehlt bei Befunden zum ganzen Diagramm. */
  index?: number;
  /** Die id des Elements, soweit lesbar. */
  element?: string;
  /** Die betroffene Angabe am Element («typ», «farbe», «x» …). */
  angabe?: string;
  /** Ein vollständiger Satz, der das Element nennt und sagt, was zu tun ist. */
  meldung: string;
  zulaessig?: readonly string[];
};

/** `daten` ist genau dann null, wenn `grenzen` nicht leer ist — sonst das
 *  normalisierte Diagramm. `maengel` gilt den Elementen ohne Grenzverletzung,
 *  auch wenn andere Elemente eine haben. */
export type Pruefung = { grenzen: Befund[]; daten: DiagrammData | null; maengel: Befund[] };

/** Die Angaben, die ein Element je Art führen kann. Alles andere wird beim
 *  Normalisieren verworfen und als wirkungslos gemeldet — darum muss hier
 *  jedes Feld der Element-Typen stehen (`check:diagramm-regeln`). */
export const ELEMENT_ERLAUBT = {
  symbol: ["id", "art", "typ", "x", "y", "rotation", "farbe", "pose", "spiegeln"],
  pfad: ["id", "art", "typ", "punkte", "farbe", "gestrichelt"],
  form: ["id", "art", "form", "x", "y", "breite", "hoehe", "punkte", "farbe", "gefuellt"],
  text: ["id", "art", "x", "y", "text"],
} as const satisfies {
  symbol: readonly (keyof SymbolElement)[];
  pfad: readonly (keyof PfadElement)[];
  form: readonly (keyof FormElement)[];
  text: readonly (keyof TextElement)[];
};
export type ElementArt = keyof typeof ELEMENT_ERLAUBT;
const ARTEN = Object.keys(ELEMENT_ERLAUBT) as ElementArt[];

/** Punktzahlen: ein Pfad braucht mindestens 2, ein Polygon mindestens 3, ein
 *  Dreieck mit «punkte» genau 3 (ohne sie spannt es sein Rahmen auf). */
export const PUNKTE = { pfad: 2, polygon: 3, dreieck: 3 } as const;

/** Die Drehung eines Tors je Feldkante, an der es steht.
 *
 *  Drehrichtung des Tor-Symbols, am Symbol nachgerechnet und am Render
 *  bestätigt (die zwei runden Pfostenenden markieren den Tormund): **0 = Mund
 *  unten, 90 = Mund links, 180 = Mund oben, 270 = Mund rechts.** Auf die
 *  Oberkante eines Feldes gehört also 0, auf die Unterkante 180, an die linke
 *  Kante 270 und an die rechte 90.
 *
 *  Ohne Prüfung fällt das kaum auf — ein Tor von hinten sieht einem von vorn
 *  ähnlich —, gezeigt wird aber ein Tor, das vom Feld weg öffnet: so standen
 *  18 Tore an Unterkanten falsch, bis diese Regel sie fand. Links/rechts waren
 *  hier zuerst vertauscht, und die Regel hat damit 56 falsch gedrehte
 *  Seitentore abgesegnet — erst der Vergleich der Pfostenenden im Render hat
 *  es gezeigt. Wer die Werte ändert, prüft sie an einem Render, nicht am Kopf. */
export const KANTEN_SOLL = { oben: 0, unten: 180, links: 270, rechts: 90 } as const;

/** Spielraum am Flächenrand gegen Float-Rauschen aus `DOMPoint` im Editor. */
const RAND_TOLERANZ = 0.5;
const FLAECHE_TEXT = `(x 0…${FLAECHE.breite}, y 0…${FLAECHE.hoehe})`;

type Roh = Record<string, unknown>;
type Stelle = { index: number; element?: string; wer: string };
type Eintrag<E extends DiagrammElement = DiagrammElement> = { stelle: Stelle; e: E };

const istObjekt = (v: unknown): v is Roh => !!v && typeof v === "object" && !Array.isArray(v);
const eines = <T>(v: unknown, werte: readonly T[]): v is T => (werte as readonly unknown[]).includes(v);
/** Ein Wert in einer Meldung: Text in «», alles andere, wie es geschrieben
 *  stand (Zahlen auch als Infinity, das JSON.stringify zu null machte). */
const zeige = (v: unknown) =>
  typeof v === "string" ? `«${v}»` : typeof v === "number" ? String(v) : String(JSON.stringify(v) ?? v);
/** Zahlen in Meldungen: höchstens eine Nachkommastelle. */
const zahl = (v: number) => String(Math.round(v * 10) / 10);
const punktText = (p: Punkt) => `x=${zahl(p.x)}, y=${zahl(p.y)}`;
const ausserhalb = (p: Punkt) =>
  p.x < -RAND_TOLERANZ ||
  p.y < -RAND_TOLERANZ ||
  p.x > FLAECHE.breite + RAND_TOLERANZ ||
  p.y > FLAECHE.hoehe + RAND_TOLERANZ;
function undListe(teile: readonly string[]): string {
  return teile.length < 2 ? teile.join("") : `${teile.slice(0, -1).join(", ")} und ${teile.at(-1)}`;
}

function stelleVon(index: number, id: unknown): Stelle {
  const element = typeof id === "string" && id.trim() !== "" ? id : undefined;
  const wer = element !== undefined ? `Element «${element}» (elemente[${index}])` : `Element elemente[${index}]`;
  return { index, element, wer };
}

function befund(
  code: BefundCode,
  stelle: Stelle | null,
  text: string,
  angabe?: string,
  zulaessig?: readonly (string | number)[],
): Befund {
  return {
    art: eines(code, GRENZ_CODES) ? "grenze" : "mangel",
    code,
    ...(stelle && { index: stelle.index }),
    ...(stelle?.element !== undefined && { element: stelle.element }),
    ...(angabe && { angabe }),
    meldung: stelle ? `${stelle.wer}: ${text}` : text,
    ...(zulaessig && { zulaessig: zulaessig.map(String) }),
  };
}

/** Die Grenzen eines Elements; ohne Verletzung zusätzlich das normalisierte
 *  Element und seine eigenen Mängel (die Mängel zwischen Elementen rechnet
 *  `pruefeDiagramm`). */
function pruefeElement(
  roh: unknown,
  index: number,
  ersteStelle: Map<string, number>,
): { grenzen: Befund[]; eintrag: Eintrag | null; maengel: Befund[] } {
  if (!istObjekt(roh)) {
    const b = befund("aufbau", stelleVon(index, undefined), "Ein Element ist ein Objekt mit «id» und «art».");
    return { grenzen: [b], eintrag: null, maengel: [] };
  }
  const e = migriereLegacy(roh) as Roh;
  const stelle = stelleVon(index, e.id);
  const grenzen: Befund[] = [];
  const grenze = (code: BefundCode, angabe: string | undefined, text: string, zulaessig?: readonly (string | number)[]) =>
    grenzen.push(befund(code, stelle, text, angabe, zulaessig));

  if (stelle.element === undefined) {
    grenze("id", "id", "«id» fehlt oder ist leer — jedes Element braucht eine eigene Kennung als Text.");
  } else if (ersteStelle.has(stelle.element)) {
    grenze("id", "id", `Die id «${stelle.element}» steht schon bei elemente[${ersteStelle.get(stelle.element)}] — jede id gilt nur einmal.`);
  } else {
    ersteStelle.set(stelle.element, index);
  }

  if (typeof e.art !== "string") {
    grenze("aufbau", "art", "«art» fehlt.", ARTEN);
    return { grenzen, eintrag: null, maengel: [] };
  }
  if (!eines(e.art, ARTEN)) {
    grenze("unbekannt", "art", `Die Art ${zeige(e.art)} gibt es nicht.`, ARTEN);
    return { grenzen, eintrag: null, maengel: [] };
  }
  const art = e.art;

  const zahlen = (...felder: string[]) => {
    let ok = true;
    for (const f of felder) {
      if (istZahl(e[f])) continue;
      grenze("wert", f, `«${f}» muss eine Zahl sein.`);
      ok = false;
    }
    return ok;
  };
  const jaNein = (f: string) => {
    if (e[f] !== undefined && typeof e[f] !== "boolean") grenze("wert", f, `«${f}» muss true oder false sein.`);
  };
  const farbe = () => {
    if (e.farbe !== undefined && !eines(e.farbe, farbSlugs))
      grenze("unbekannt", "farbe", `Die Farbe ${zeige(e.farbe)} gibt es nicht.`, farbSlugs);
  };
  const typ = (angabe: "typ" | "form", werte: readonly string[], was: string) => {
    if (eines(e[angabe], werte)) return true;
    grenze("unbekannt", angabe, e[angabe] === undefined ? `«${angabe}» fehlt.` : `${was} ${zeige(e[angabe])} gibt es nicht.`, werte);
    return false;
  };
  const punkte = (): Punkt[] | null => {
    if (Array.isArray(e.punkte) && e.punkte.every(istPunkt)) return e.punkte;
    grenze("wert", "punkte", "«punkte» ist eine Liste von Punkten, jeder mit «x» und «y» als Zahl.");
    return null;
  };
  const mindestens = (liste: Punkt[] | null, min: number, was: string): liste is Punkt[] => {
    if (!liste) return false;
    if (liste.length >= min) return true;
    grenze("wert", "punkte", `${was} braucht mindestens ${min} Punkte, «punkte» hat ${liste.length}.`);
    return false;
  };
  const mitteAufFlaeche = () => {
    const p = { x: e.x as number, y: e.y as number };
    if (ausserhalb(p))
      grenze("ausserhalb", undefined, `Die Mitte liegt bei ${punktText(p)} und damit ausserhalb der Zeichenfläche ${FLAECHE_TEXT}.`);
  };
  const punkteAufFlaeche = (liste: Punkt[]) => {
    const draussen = liste.flatMap((p, i) => (ausserhalb(p) ? [`der ${i + 1}. Punkt (${punktText(p)})`] : []));
    if (draussen.length === 0) return;
    const satz = undListe(draussen);
    grenze(
      "ausserhalb",
      "punkte",
      `${satz[0].toUpperCase()}${satz.slice(1)} ${draussen.length === 1 ? "liegt" : "liegen"} ausserhalb der Zeichenfläche ${FLAECHE_TEXT}.`,
    );
  };
  /** Rahmen aus x/y (obere linke Ecke), breite und hoehe. */
  const rahmen = () => {
    if (!zahlen("x", "y", "breite", "hoehe")) return;
    const { x, y, breite, hoehe } = e as { x: number; y: number; breite: number; hoehe: number };
    let positiv = true;
    for (const [f, v] of [["breite", breite], ["hoehe", hoehe]] as const) {
      if (v > 0) continue;
      grenze("wert", f, `«${f}» muss grösser als 0 sein.`);
      positiv = false;
    }
    if (positiv && [{ x, y }, { x: x + breite, y: y + hoehe }].some(ausserhalb))
      grenze(
        "ausserhalb",
        undefined,
        `Der Rahmen reicht von x=${zahl(x)} bis ${zahl(x + breite)} und y=${zahl(y)} bis ${zahl(y + hoehe)} und damit über die Zeichenfläche hinaus ${FLAECHE_TEXT}.`,
      );
  };

  switch (art) {
    case "symbol": {
      typ("typ", SYMBOL_TYPEN, "Das Symbol");
      if (zahlen("x", "y")) mitteAufFlaeche();
      if (e.rotation !== undefined && !eines(e.rotation, ROTATIONEN))
        grenze("unbekannt", "rotation", `Die Drehung ${zeige(e.rotation)} gibt es nicht.`, ROTATIONEN);
      farbe();
      if (e.pose !== undefined && !eines(e.pose, SPIELER_POSEN))
        grenze("unbekannt", "pose", `Die Pose ${zeige(e.pose)} gibt es nicht.`, SPIELER_POSEN);
      jaNein("spiegeln");
      break;
    }
    case "pfad": {
      typ("typ", PFAD_TYPEN, "Den Pfadtyp");
      const liste = punkte();
      if (mindestens(liste, PUNKTE.pfad, "Ein Pfad")) punkteAufFlaeche(liste);
      farbe();
      jaNein("gestrichelt");
      break;
    }
    case "form": {
      const bekannt = typ("form", FORM_TYPEN, "Die Form");
      farbe();
      jaNein("gefuellt");
      if (!bekannt) break;
      if (e.form === "polygon") {
        const liste = punkte();
        if (mindestens(liste, PUNKTE.polygon, "Ein Polygon")) punkteAufFlaeche(liste);
      } else if (e.form === "dreieck" && !(e.punkte === undefined || (Array.isArray(e.punkte) && e.punkte.length === 0))) {
        const liste = punkte();
        if (liste && liste.length !== PUNKTE.dreieck)
          grenze(
            "wert",
            "punkte",
            `Ein Dreieck hat genau ${PUNKTE.dreieck} «punkte» oder keine (dann spannen x, y, breite und hoehe es auf), «punkte» hat ${liste.length}.`,
          );
        else if (liste) punkteAufFlaeche(liste);
      } else {
        rahmen();
      }
      break;
    }
    case "text": {
      if (zahlen("x", "y")) mitteAufFlaeche();
      if (typeof e.text !== "string") grenze("wert", "text", "«text» muss ein Text sein.");
      else if (e.text.length > MAX_TEXT_LAENGE)
        grenze("wert", "text", `Der Text hat ${e.text.length} Zeichen; erlaubt sind höchstens ${MAX_TEXT_LAENGE}.`);
      break;
    }
  }

  if (grenzen.length) return { grenzen, eintrag: null, maengel: [] };
  const eintrag = { stelle, e: normalisiere(e, art) };
  return { grenzen, eintrag, maengel: elementMaengel(e, art, eintrag) };
}

/** Nur die Angaben aus `ELEMENT_ERLAUBT`. Polygone und Dreiecke mit Punkten
 *  bekommen x, y, breite und hoehe immer aus der Hülle ihrer Punkte, wie der
 *  Editor sie nachführt — ein Assistent kann sie nicht zuverlässig rechnen.
 *  Rechteck und Ellipse tragen keine Punkte. Wirkungslose, aber gültige Werte
 *  bleiben erhalten (PO-Entscheid 2026-09-29, Story #145: speichern und
 *  melden). */
function normalisiere(e: Roh, art: ElementArt): DiagrammElement {
  const n: Roh = {};
  for (const k of ELEMENT_ERLAUBT[art]) if (e[k] !== undefined) n[k] = e[k];
  if (art === "form") {
    const liste = n.punkte as Punkt[] | undefined;
    if (n.form === "rechteck" || n.form === "ellipse" || liste?.length === 0) delete n.punkte;
    else if (liste) {
      n.punkte = liste.map((p) => ({ x: p.x, y: p.y }));
      const h = bbox(liste);
      Object.assign(n, { x: h.minX, y: h.minY, breite: h.maxX - h.minX, hoehe: h.maxY - h.minY });
    }
  }
  if (art === "pfad") n.punkte = (n.punkte as Punkt[]).map((p) => ({ x: p.x, y: p.y }));
  return n as DiagrammElement;
}

/** Die Mängel, die ein Element für sich trägt: wirkungslose Angaben, ein
 *  Symbolrahmen über dem Rand, leerer Text. `roh` ist das Element vor dem
 *  Normalisieren — nur dort stehen verworfene Angaben noch. */
function elementMaengel(roh: Roh, art: ElementArt, { stelle, e }: Eintrag): Befund[] {
  const maengel: Befund[] = [];
  const mangel = (code: BefundCode, angabe: string | undefined, text: string, zulaessig?: readonly string[]) =>
    maengel.push(befund(code, stelle, text, angabe, zulaessig));

  for (const k of Object.keys(roh)) {
    if (!eines(k, ELEMENT_ERLAUBT[art]))
      mangel("wirkungslos", k, `«${k}» gibt es an der Art «${art}» nicht und wird nicht gespeichert.`, ELEMENT_ERLAUBT[art]);
  }

  switch (e.art) {
    case "symbol": {
      const def = SYMBOLE[e.typ];
      // Eine Figur zeichnet KiFu nie gedreht (symbolRotation); jedes andere
      // Symbol dreht der Renderer zwar, vorgesehen ist es aber nur an den
      // drehbaren — der Editor bietet es sonst nicht an.
      if (e.rotation !== undefined && e.rotation !== 0 && !DREHBARE_TYPEN.has(e.typ))
        mangel(
          "wirkungslos",
          "rotation",
          (FIGUR_TYPEN.has(e.typ)
            ? `Eine Figur dreht KiFu nicht — die Drehung ${e.rotation} bleibt an «${e.typ}» ohne Wirkung; die Blickrichtung setzt «spiegeln».`
            : `Eine Drehung ist am Symbol «${e.typ}» nicht vorgesehen — drehbar sind nur ${[...DREHBARE_TYPEN].join(", ")}.`) +
            " Lass «rotation» weg.",
        );
      if (e.pose !== undefined && !POSEN_TYPEN.has(e.typ))
        mangel("wirkungslos", "pose", `«pose» wirkt nur am Symbol ${[...POSEN_TYPEN].map((t) => `«${t}»`).join(", ")}. Lass «pose» weg.`);
      if (e.farbe !== undefined && !def.faerbbar)
        mangel("wirkungslos", "farbe", `«farbe» wirkt am Symbol «${e.typ}» nicht — es hat eine feste Farbe. Lass «farbe» weg.`);
      if (e.spiegeln === true && !FIGUR_TYPEN.has(e.typ))
        mangel("wirkungslos", "spiegeln", `«spiegeln» wirkt nur an den Figuren ${[...FIGUR_TYPEN].join(", ")}. Lass «spiegeln» weg.`);

      const { breite, hoehe } = symbolMasse(e.typ, e.rotation);
      const raender = [
        e.x - breite / 2 < -RAND_TOLERANZ && "linken",
        e.y - hoehe / 2 < -RAND_TOLERANZ && "oberen",
        e.x + breite / 2 > FLAECHE.breite + RAND_TOLERANZ && "rechten",
        e.y + hoehe / 2 > FLAECHE.hoehe + RAND_TOLERANZ && "unteren",
      ].filter((r): r is string => !!r);
      if (raender.length)
        mangel(
          "ragt_hinaus",
          undefined,
          `Das Symbol «${e.typ}» ragt über den ${undListe(raender)} Rand hinaus. Für den Rahmen ${zahl(breite)}×${zahl(hoehe)} ` +
            `muss die Mitte bei x ${zahl(breite / 2)}…${zahl(FLAECHE.breite - breite / 2)} und y ${zahl(hoehe / 2)}…${zahl(FLAECHE.hoehe - hoehe / 2)} liegen.`,
        );
      break;
    }
    case "pfad":
      // Farbe und Strichelung wertet nur die Linie aus; Laufweg, Dribbling
      // und Pass zeichnen in fester Optik (DiagrammView.PfadGrafik).
      if (e.typ !== "linie" && e.farbe !== undefined)
        mangel("wirkungslos", "farbe", `«farbe» wirkt nur an einer «linie»; «${e.typ}» zeichnet KiFu in fester Farbe. Lass «farbe» weg.`);
      if (e.typ !== "linie" && e.gestrichelt !== undefined)
        mangel("wirkungslos", "gestrichelt", `«gestrichelt» wirkt nur an einer «linie»; «${e.typ}» hat einen festen Linienstil. Lass «gestrichelt» weg.`);
      break;
    case "form":
      if ((e.form === "rechteck" || e.form === "ellipse") && roh.punkte !== undefined)
        mangel(
          "wirkungslos",
          "punkte",
          `«punkte» wirkt an der Form «${e.form}» nicht und wird nicht gespeichert — Lage und Grösse stehen in «x», «y», «breite» und «hoehe».`,
        );
      break;
    case "text":
      if (e.text.trim() === "")
        mangel("text_leer", "text", "Der Text ist leer — die Textbox zeigt nichts. Schreib einen Text hinein oder lass das Element weg.");
      break;
  }
  return maengel;
}

/** Gehaltene Gegenstände (Leibchen) gehören an eine Hand. Geprüft wird die
 *  Beziehung, nicht die absolute Lage: liegt das Tuch nahe an einer Figur,
 *  muss es an deren Hand sitzen. Sonst löst eine globale Geometrie-Änderung
 *  (etwa eine korrigierte Ankerhöhe) gehaltene Gegenstände still von der
 *  Hand — genau das ist bei der Fusskorrektur passiert, ohne dass eine
 *  Prüfung anschlug. */
export const HAND_TOLERANZ = 28;
export const FIGUR_NAEHE = 120;

function leibchenMaengel(eintraege: readonly Eintrag[]): Befund[] {
  const figuren = eintraege.filter(
    (g): g is Eintrag<SymbolElement> => g.e.art === "symbol" && FIGUR_TYPEN.has(g.e.typ),
  );
  const maengel: Befund[] = [];
  for (const { stelle, e } of eintraege) {
    if (e.art !== "symbol" || e.typ !== "leibchen") continue;
    let figur = Infinity;
    let hand = { abstand: Infinity, x: 0, y: 0, von: "" };
    for (const f of figuren) {
      figur = Math.min(figur, Math.hypot(e.x - f.e.x, e.y - f.e.y));
      for (const h of haende(f.e.typ as FigurArt, f.e.pose, f.e.spiegeln)) {
        const x = f.e.x + h.x;
        const y = f.e.y + h.y;
        const abstand = Math.hypot(e.x - x, e.y - y);
        if (abstand < hand.abstand) hand = { abstand, x, y, von: f.stelle.wer.replace(/^Element /, "") };
      }
    }
    if (hand.abstand > HAND_TOLERANZ && figur < FIGUR_NAEHE)
      maengel.push(
        befund(
          "leibchen",
          stelle,
          `Das Leibchen liegt ${Math.round(figur)} Einheiten neben einer Figur, aber ${Math.round(hand.abstand)} von der nächsten Hand ` +
            `(die Hand von ${hand.von}, bei x=${Math.round(hand.x)}, y=${Math.round(hand.y)}). Setze es höchstens ` +
            `${HAND_TOLERANZ} Einheiten neben eine Hand oder lege es mindestens ${FIGUR_NAEHE} Einheiten von jeder Figur entfernt ab.`,
        ),
      );
  }
  return maengel;
}

/** Tore öffnen ins Feld (Drehwerte siehe `KANTEN_SOLL`). Als Feld gilt ein
 *  Rechteck ab FELD_MINDESTFLAECHE; kleine Zonen (Schusszone, Kiste) sind
 *  keine Feldkante. */
const FELD_MINDESTFLAECHE = 200_000;
const KANTEN_NAEHE = 45;

function torRichtungMaengel(eintraege: readonly Eintrag[]): Befund[] {
  const felder = eintraege.filter(
    (g): g is Eintrag<FormElement> =>
      g.e.art === "form" && g.e.form === "rechteck" && g.e.breite * g.e.hoehe >= FELD_MINDESTFLAECHE,
  );
  const tore = eintraege.filter(
    (g): g is Eintrag<SymbolElement> => g.e.art === "symbol" && (g.e.typ === "tor" || g.e.typ === "minitor"),
  );
  const maengel: Befund[] = [];
  for (const { stelle: feld, e: f } of felder) {
    for (const { stelle, e: t } of tore) {
      const rot = t.rotation ?? 0;
      // Diagonal gedrehte Tore (Ecktore) beurteilt die Regel nicht: sie öffnen
      // schräg ins Feld, und keiner der vier rechten Winkel wäre richtig.
      if (rot % 90 !== 0) continue;

      // Innerhalb der Feldausdehnung? Die Achse gehört zur Kante (dritter
      // Wert) und wird NICHT aus dem Meldungstext abgeleitet — sonst dreht
      // eine umformulierte Meldung still die geprüfte Achse.
      const laengs = t.y >= f.y - 20 && t.y <= f.y + f.hoehe + 20;
      const quer = t.x >= f.x - 20 && t.x <= f.x + f.breite + 20;
      const kanten: { name: string; auf: boolean; soll: number }[] = [
        { name: "Oberkante", auf: Math.abs(t.y - f.y) < KANTEN_NAEHE && quer, soll: KANTEN_SOLL.oben },
        { name: "Unterkante", auf: Math.abs(t.y - (f.y + f.hoehe)) < KANTEN_NAEHE && quer, soll: KANTEN_SOLL.unten },
        { name: "linken Feldkante", auf: Math.abs(t.x - f.x) < KANTEN_NAEHE && laengs, soll: KANTEN_SOLL.links },
        { name: "rechten Feldkante", auf: Math.abs(t.x - (f.x + f.breite)) < KANTEN_NAEHE && laengs, soll: KANTEN_SOLL.rechts },
      ];

      // Ein Tor in der Feldecke liegt an zwei Kanten; dort ist jede der beiden
      // Richtungen zulässig, sonst wäre die Forderung unerfüllbar.
      const treffer = kanten.filter((k) => k.auf);
      if (treffer.length === 0 || treffer.some((k) => k.soll === rot)) continue;
      const soll = treffer.map((k) => k.soll).join(" oder ");
      maengel.push(
        befund(
          "tor_richtung",
          stelle,
          `Das ${SYMBOLE[t.typ].label} steht auf der ${treffer.map((k) => k.name).join(" und der ")} von ` +
            `${feld.wer.replace(/^Element /, "")}, hat aber die Drehung ${rot} statt ${soll} — es öffnet vom Feld weg. Drehe es auf ${soll}.`,
          "rotation",
        ),
      );
    }
  }
  return maengel;
}

/** Prüft ein Diagramm, wie es von aussen kommt (Formular, KI-Assistent,
 *  Datenbank). Leer ist gültig: `{ elemente: [] }` hat keinen Befund. */
export function pruefeDiagramm(roh: unknown): Pruefung {
  if (!istObjekt(roh) || !Array.isArray(roh.elemente)) {
    const b = befund("aufbau", null, "Das Diagramm braucht eine Liste «elemente» mit den Zeichnungselementen.");
    return { grenzen: [b], daten: null, maengel: [] };
  }
  const grenzen: Befund[] = [];
  const maengel: Befund[] = [];
  if (roh.elemente.length > MAX_ELEMENTE)
    grenzen.push(
      befund(
        "anzahl",
        null,
        `Das Diagramm hat ${roh.elemente.length} Elemente; erlaubt sind höchstens ${MAX_ELEMENTE}. Geprüft sind nur die ersten ${MAX_ELEMENTE}.`,
      ),
    );

  const eintraege: Eintrag[] = [];
  const ersteStelle = new Map<string, number>();
  roh.elemente.slice(0, MAX_ELEMENTE).forEach((el, index) => {
    const r = pruefeElement(el, index, ersteStelle);
    grenzen.push(...r.grenzen);
    maengel.push(...r.maengel);
    if (r.eintrag) eintraege.push(r.eintrag);
  });
  maengel.push(...leibchenMaengel(eintraege), ...torRichtungMaengel(eintraege));
  maengel.sort((a, b) => (a.index ?? -1) - (b.index ?? -1));

  return {
    grenzen,
    daten: grenzen.length ? null : { version: DIAGRAMM_VERSION, elemente: eintraege.map((g) => g.e) },
    maengel,
  };
}

/** Alle Befunde eines Diagramms als lesbare Zeilen; leer = in Ordnung. Für
 *  die von uns *verfassten* Manual-Vorlagen (Seed, `check:diagramme`) ist
 *  jeder Befund ein Fehler, auch ein Mangel. `rohAnzahl` ist die Elementzahl
 *  VOR `parseDiagramm` — weicht sie ab, hat der Parser strukturell Kaputtes
 *  verworfen, was in einer Vorlage ein Fehler ist. */
export function diagrammProbleme(daten: DiagrammData, rohAnzahl?: number): string[] {
  const probleme: string[] = [];
  if (rohAnzahl !== undefined && rohAnzahl !== daten.elemente.length) {
    probleme.push(
      `${rohAnzahl - daten.elemente.length} Element(e) von parseDiagramm verworfen ` +
        `(strukturell ungültig: fehlende id/Koordinaten, unbekannte Pose oder Rotation)`,
    );
  }
  if (daten.elemente.length === 0) probleme.push("keine Elemente");
  const { grenzen, maengel } = pruefeDiagramm(daten);
  probleme.push(...[...grenzen, ...maengel].map((b) => b.meldung));
  return probleme;
}

/** Die Meldung der Oberfläche, wenn das Diagramm aus der Maske eine Grenze
 *  verletzt. */
export const DIAGRAMM_ABGELEHNT =
  "Das Feld-Diagramm enthält Elemente, die sich nicht speichern lassen — etwa einen «?»-Platzhalter oder ein Element ausserhalb der Fläche. Entferne oder verschiebe sie und speichere erneut.";

/** Die in der Maske gezeichnete Zeichnung aus dem Formular (#246, #247), nach
 *  denselben Grenzen wie ein vom KI-Assistenten gesetztes Diagramm
 *  (PO-Entscheid 2026-09-29, Story #145: die Grenzen gelten auch beim
 *  Speichern aus der Maske). `undefined`: das Formular trägt keine
 *  Zeichnung, die gespeicherte bleibt unberührt. `null`: eine leere
 *  Zeichnung — die Übung trägt dann keine, wie eine nie gezeichnete.
 *
 *  Das Formular schickt bei jedem Speichern das ganze Diagramm mit. Ist es
 *  unverändert gegenüber `gespeichert`, wird es nicht neu beanstandet — sonst
 *  liesse sich eine Übung mit einem Altbestand-Element nicht einmal mehr
 *  umbenennen. Es wird dann nachsichtig gelesen wie bisher. */
export function diagrammAusFormular(
  form: FormData,
  gespeichert?: unknown,
): DiagrammData | null | undefined | "ungueltig" {
  const roh = form.get("diagramm");
  if (typeof roh !== "string" || roh === "") return undefined;
  let json: unknown;
  try {
    json = JSON.parse(roh);
  } catch {
    return "ungueltig";
  }
  const { daten, grenzen } = pruefeDiagramm(json);
  if (daten) return daten.elemente.length > 0 ? daten : null;

  const nachsichtig = parseDiagramm(json);
  if (
    gespeichert !== undefined &&
    nachsichtig &&
    JSON.stringify(nachsichtig.elemente) === JSON.stringify(parseDiagramm(gespeichert)?.elemente)
  )
    return nachsichtig.elemente.length > 0 ? nachsichtig : null;

  console.warn("[diagramm] Speichern abgelehnt:", grenzen.map((b) => b.meldung));
  return "ungueltig";
}
