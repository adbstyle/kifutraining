// Der Diagramm-Katalog für den KI-Assistenten (#145 AK 1): welche Elemente
// ein Feld-Diagramm führen kann, welche Werte sie annehmen und wie gross die
// Zeichenfläche ist — dazu, wo die Figuren ihre Hände haben, damit ein
// gehaltenes Leibchen keinen Mangel ergibt (#146).
//
// Hier wird NICHTS von Hand gezählt. Typen, Farben, Drehungen, Posen, Masse,
// Färb- und Drehbarkeit, Grenzen und Punktzahlen stammen aus lib/diagramm.ts,
// dem Symbol-Register (components/diagramm/symbols.tsx), der Prüfung
// (lib/diagramm-pruefung.ts: erlaubte Felder, Tor-Drehung je Feldkante,
// Hand-Toleranz), den Figuren (components/diagramm/figur.tsx: Hände) und
// lib/material.ts. Von Hand stehen nur die erklärenden Sätze.
// `check:diagramm-regeln` hält den Katalog gegen diese Quellen und prüft, dass
// die Beispiele befundfrei sind.
//
// REIN: keine Server-Importe.
import { z } from "zod";
import {
  DREHBARE_TYPEN,
  FIGUR_TYPEN,
  FLAECHE,
  FORM_DEFAULT_FARBE,
  FORM_TYPEN,
  LINIE_DEFAULT_FARBE,
  MAX_ELEMENTE,
  MAX_TEXT_LAENGE,
  PFAD_TYPEN,
  POSEN_TYPEN,
  ROTATIONEN,
  SPIELER_POSEN,
  SYMBOL_TYPEN,
  farbSlugs,
  type FormTyp,
  type PfadTyp,
} from "@/lib/diagramm";
import { SYMBOLE } from "@/components/diagramm/symbols";
import { haende, type FigurArt } from "@/components/diagramm/figur";
import {
  ELEMENT_ERLAUBT,
  FIGUR_NAEHE,
  HAND_TOLERANZ,
  KANTEN_SOLL,
  PUNKTE,
  type ElementArt,
} from "@/lib/diagramm-pruefung";
import { FARBE_LABEL, SPIELER_STANDARDFARBE, istMaterialArt } from "@/lib/material";
import { Wert, wert } from "@/lib/mcp/bausteine";

const ARTEN = Object.keys(ELEMENT_ERLAUBT) as [ElementArt, ...ElementArt[]];

/** Farbe eines Elements: wählbar, und welche ohne Angabe gilt. */
const Farbwahl = z.object({ waehlbar: z.boolean(), standard: z.string().nullable() });

export const DiagrammKatalogSchema = z.object({
  flaeche: z.object({ breite: z.number(), hoehe: z.number() }),
  koordinaten: z.string(),
  /** Die Arten in Zeichenreihenfolge, von unten nach oben. */
  ebenen: z.array(z.enum(ARTEN)),
  richtung: z.string(),
  grenzen: z.object({ max_elemente: z.number().int(), max_text_laenge: z.number().int() }),
  arten: z.array(z.object({ art: z.enum(ARTEN), felder: z.array(z.string()) })),
  farben: z.array(Wert),
  rotationen: z.array(z.number().int()),
  symbole: z.array(
    z.object({
      typ: z.string(),
      label: z.string(),
      masse: z.object({ breite: z.number(), hoehe: z.number() }),
      material: z.boolean(),
      farbe: Farbwahl,
      drehbar: z.boolean(),
      blickrichtung: z.boolean(),
      posen: z.array(z.string()),
    }),
  ),
  pfade: z.array(
    z.object({
      typ: z.string(),
      beschreibung: z.string(),
      farbe: Farbwahl,
      gestrichelt_waehlbar: z.boolean(),
      min_punkte: z.number().int(),
    }),
  ),
  formen: z.array(z.object({ form: z.string(), beschreibung: z.string(), farbe: Farbwahl })),
  /** Die Hände je Figur und Pose, relativ zur Mitte der Figur (#146). */
  haende: z.object({
    hinweis: z.string(),
    je_figur: z.array(
      z.object({
        typ: z.string(),
        pose: z.string().nullable(),
        punkte: z.array(z.object({ dx: z.number(), dy: z.number() })),
      }),
    ),
  }),
  material: z.string(),
  beispiele: z.array(z.looseObject({ id: z.string(), art: z.enum(ARTEN) })),
});

type DiagrammKatalog = z.infer<typeof DiagrammKatalogSchema>;

const B = FLAECHE.breite;
const H = FLAECHE.hoehe;
const eineStelle = (v: number) => Math.round(v * 10) / 10;

/** Nur die Linie wertet Farbe und Strichelung aus; Laufweg, Dribbling und
 *  Pass zeichnet KiFu in fester Optik (DiagrammView.PfadGrafik). */
const FREIE_LINIE: PfadTyp = "linie";

const PFAD_BESCHREIBUNG: Record<PfadTyp, string> = {
  laufweg: "Lauf ohne Ball: gestrichelte Linie mit Pfeil auf den letzten Punkt.",
  dribbling: "Lauf mit Ball: Wellenlinie mit Pfeil auf den letzten Punkt.",
  pass: "Pass oder Schuss: gerade Linie mit Pfeil auf den letzten Punkt.",
  linie: "Freie Linie ohne Pfeil, etwa eine Markierung; Farbe und Strichelung wählbar.",
};

const FORM_BESCHREIBUNG: Record<FormTyp, string> = {
  rechteck: "Rechteck aus x/y (obere linke Ecke), «breite» und «hoehe» - etwa ein Spielfeld oder eine Zone.",
  ellipse: "Ellipse in ihrem Rahmen aus x/y (obere linke Ecke), «breite» und «hoehe».",
  dreieck:
    `Dreieck: entweder genau ${PUNKTE.dreieck} «punkte» als Ecken oder ohne «punkte» ein Rahmen aus x/y ` +
    "(obere linke Ecke), «breite» und «hoehe» mit der Spitze oben mittig.",
  polygon: `Vieleck aus mindestens ${PUNKTE.polygon} «punkte».`,
};

/** Je ein befundfreies Element der vier Arten, dazu Rechteck und Polygon —
 *  zusammen ein kleines Spielfeld. Das Polygon trägt bewusst kein x, y,
 *  breite und hoehe: die rechnet KiFu aus den Punkten. */
const BEISPIELE: z.infer<typeof DiagrammKatalogSchema>["beispiele"] = [
  { id: "feld", art: "form", form: "rechteck", x: 200, y: 150, breite: 1200, hoehe: 700, farbe: "weiss" },
  { id: "tor-oben", art: "symbol", typ: "tor", x: 800, y: 150, rotation: KANTEN_SOLL.oben },
  { id: "kind-1", art: "symbol", typ: "spieler", x: 600, y: 600, farbe: "blau", pose: "dribbeln" },
  { id: "dribbling-1", art: "pfad", typ: "dribbling", punkte: [{ x: 640, y: 560 }, { x: 760, y: 320 }] },
  {
    id: "schusszone",
    art: "form",
    form: "polygon",
    punkte: [{ x: 1000, y: 650 }, { x: 1300, y: 600 }, { x: 1250, y: 820 }, { x: 1050, y: 800 }],
    farbe: "gelb",
    gefuellt: true,
  },
  { id: "hinweis", art: "text", x: 800, y: 940, text: "Abschluss nach dem Dribbling" },
];

/** Der ganze Katalog. Rein und deterministisch — er hängt an keinem Konto. */
export function baueDiagrammKatalog(): DiagrammKatalog {
  return {
    flaeche: { breite: B, hoehe: H },
    koordinaten:
      `Die Zeichenfläche misst ${B}×${H} Einheiten: x von 0 (links) bis ${B}, y von 0 (oben) bis ${H}. ` +
      "Symbole und Texte stehen mit ihrer Mitte auf x/y; die Mitte muss auf der Fläche liegen. Ragt der " +
      "Rahmen eines Symbols («masse», mit der Drehung gedreht) über den Rand, speichert KiFu das Diagramm " +
      "trotzdem und meldet in «maengel», wo die Mitte liegen muss. " +
      "Rechteck, Ellipse und Dreieck ohne «punkte»: x/y ist die obere linke Ecke, dazu «breite» und «hoehe» " +
      "(grösser als 0); der ganze Rahmen muss auf der Fläche liegen. Pfade, Polygone und Dreiecke mit «punkte»: " +
      "jeder Punkt muss auf der Fläche liegen, x, y, breite und hoehe rechnet KiFu selbst daraus. " +
      "Ein Pfeil zeigt auf den letzten Punkt. Jedes Element braucht eine eigene «id» (Text).",
    ebenen: ["form", "pfad", "symbol", "text"],
    richtung:
      `«rotation» dreht ein Symbol im Uhrzeigersinn in 45°-Schritten (${ROTATIONEN.join(", ")}); ` +
      `vorgesehen ist sie nur an Symbolen mit «drehbar»: true. Bei 0 öffnet ein Tor nach unten. Ein Tor auf der Oberkante eines Feldes ` +
      `steht auf ${KANTEN_SOLL.oben}, auf der Unterkante auf ${KANTEN_SOLL.unten}, an der linken Kante auf ` +
      `${KANTEN_SOLL.links}, an der rechten auf ${KANTEN_SOLL.rechts} - so öffnet es ins Feld. Figuren drehen nicht: ` +
      "«spiegeln»: true lässt sie nach links statt nach rechts blicken.",
    grenzen: { max_elemente: MAX_ELEMENTE, max_text_laenge: MAX_TEXT_LAENGE },
    arten: ARTEN.map((art) => ({ art, felder: [...ELEMENT_ERLAUBT[art]] })),
    farben: farbSlugs.map((slug) => wert(FARBE_LABEL, slug)),
    rotationen: [...ROTATIONEN],
    symbole: SYMBOL_TYPEN.map((typ) => {
      const def = SYMBOLE[typ];
      return {
        typ,
        label: def.label,
        masse: { breite: def.breite, hoehe: def.hoehe },
        material: istMaterialArt(typ),
        farbe: { waehlbar: def.faerbbar, standard: def.faerbbar ? (def.defaultFarbe ?? null) : null },
        drehbar: DREHBARE_TYPEN.has(typ),
        blickrichtung: FIGUR_TYPEN.has(typ),
        posen: POSEN_TYPEN.has(typ) ? [...SPIELER_POSEN] : [],
      };
    }),
    pfade: PFAD_TYPEN.map((typ) => ({
      typ,
      beschreibung: PFAD_BESCHREIBUNG[typ],
      farbe: { waehlbar: typ === FREIE_LINIE, standard: typ === FREIE_LINIE ? LINIE_DEFAULT_FARBE : null },
      gestrichelt_waehlbar: typ === FREIE_LINIE,
      min_punkte: PUNKTE.pfad,
    })),
    formen: FORM_TYPEN.map((form) => ({
      form,
      beschreibung: FORM_BESCHREIBUNG[form],
      farbe: { waehlbar: true, standard: FORM_DEFAULT_FARBE },
    })),
    haende: {
      hinweis:
        `Ein gehaltenes Leibchen liegt höchstens ${HAND_TOLERANZ} Einheiten neben einer Hand: Mitte der Figur ` +
        "plus dx/dy; mit «spiegeln»: true ist dx umgekehrt, ohne «pose» gilt «stehen». Liegt ein Leibchen " +
        `näher als ${FIGUR_NAEHE} Einheiten an einer Figur, aber an keiner Hand, meldet KiFu einen Mangel.`,
      je_figur: [...FIGUR_TYPEN].flatMap((typ) =>
        (POSEN_TYPEN.has(typ) ? SPIELER_POSEN : [null]).map((pose) => ({
          typ,
          pose,
          punkte: haende(typ as FigurArt, pose ?? undefined).map((h) => ({ dx: eineStelle(h.x), dy: eineStelle(h.y) })),
        })),
      ),
    },
    material:
      "Aus dem Diagramm zählt KiFu das Material selbst: jedes Symbol mit «material»: true einmal, nach Art und " +
      "Farbe (ohne «farbe» die Standardfarbe). Figuren sind kein Material. Tragen die Feldspieler (spieler) " +
      "mindestens zwei Farben, kommt je Feldspieler ein Überziehleibchen seiner Farbe dazu; ein Spieler ohne " +
      `«farbe» trägt ${FARBE_LABEL[SPIELER_STANDARDFARBE]}. Torwart und Trainer zählen dabei nie.`,
    beispiele: BEISPIELE,
  };
}
