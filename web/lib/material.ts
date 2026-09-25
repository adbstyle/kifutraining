/**
 * Material einer Übung (Epic #266) — reine Fachlogik ohne Server- und
 * React-Bezug, damit Formular, Anzeige, Server Actions, KI-Auskunft, Seed und
 * Prüfskripte dieselben Regeln rechnen.
 *
 * Eine Übung trägt ihr Material zweigeteilt:
 *   - die LISTE (`material_liste`): Material, das sich im Feld-Diagramm
 *     zeichnen lässt, nach Art, Farbe und Menge — nur sie wird gezählt und
 *     verrechnet;
 *   - die freie ERGÄNZUNG (`material`, text[]): alles, was das Diagramm nicht
 *     kennt (Pfeife, Stoppuhr …), und der Freitext aus der Zeit vor der Liste.
 *
 * Der VORSCHLAG ist die Liste, die das Diagramm zeigt. Übernommen wird er nur
 * auf Wunsch des Trainers — es gibt kein live abgeleitetes Material. Die BASIS
 * (`material_basis`) ist der Vorschlag im Moment der letzten Übernahme; weicht
 * der heutige Vorschlag davon ab, hat eine Diagrammänderung das Material
 * verändert (Story #269).
 */
import { farbSlugs, parseDiagramm, type DiagrammData, type FarbSlug } from "@/lib/diagramm";
import { zaehle } from "@/lib/labels";

/** Die Diagramm-Symbole, die Material sind — in der Reihenfolge, in der die
 *  Liste sie führt: Tore, Markiermaterial, Leibchen, Bälle. Figuren sind kein
 *  Material. */
export const MATERIAL_ARTEN = [
  "tor",
  "minitor",
  "pylone",
  "teller",
  "stange",
  "reifen",
  "huerde",
  "leibchen",
  "fussball",
  "handball",
  "tennisball",
] as const;
export type MaterialArt = (typeof MATERIAL_ARTEN)[number];

export type MaterialArtInfo = {
  einzahl: string;
  mehrzahl: string;
  /** Färbbar im Diagramm — dann unterscheidet die Liste nach Farbe. */
  farbig: boolean;
  /** Die Farbe, die das Diagramm zeichnet, wenn am Element keine steht. */
  standardFarbe: FarbSlug | null;
};

/** Der Material-Katalog. `farbig` und `standardFarbe` sind die Werte des
 *  Symbol-Registers (components/diagramm/symbols.tsx: `faerbbar`,
 *  `defaultFarbe`) — bewusst als Werte gespiegelt statt importiert, damit diese
 *  Datei ohne React-Code ladbar bleibt. `npm run check:material` hält beide
 *  gleich. */
export const MATERIAL_KATALOG: Record<MaterialArt, MaterialArtInfo> = {
  tor: { einzahl: "Tor", mehrzahl: "Tore", farbig: false, standardFarbe: null },
  minitor: { einzahl: "Minitor", mehrzahl: "Minitore", farbig: false, standardFarbe: null },
  pylone: { einzahl: "Pylone", mehrzahl: "Pylonen", farbig: true, standardFarbe: "orange" },
  teller: {
    einzahl: "Markierungsteller",
    mehrzahl: "Markierungsteller",
    farbig: true,
    standardFarbe: "gelb",
  },
  stange: { einzahl: "Stange", mehrzahl: "Stangen", farbig: true, standardFarbe: "weiss" },
  reifen: { einzahl: "Reifen", mehrzahl: "Reifen", farbig: true, standardFarbe: "blau" },
  huerde: { einzahl: "Hürde", mehrzahl: "Hürden", farbig: false, standardFarbe: null },
  leibchen: {
    einzahl: "Überziehleibchen",
    mehrzahl: "Überziehleibchen",
    farbig: true,
    standardFarbe: "rot",
  },
  fussball: { einzahl: "Fussball", mehrzahl: "Fussbälle", farbig: false, standardFarbe: null },
  handball: { einzahl: "Handball", mehrzahl: "Handbälle", farbig: false, standardFarbe: null },
  tennisball: {
    einzahl: "Tennisball",
    mehrzahl: "Tennisbälle",
    farbig: false,
    standardFarbe: null,
  },
};

/** Die Farben in Worten, klein wie im Satz («4 Pylonen, rot»). */
export const FARBE_LABEL: Record<FarbSlug, string> = {
  rot: "rot",
  blau: "blau",
  gelb: "gelb",
  gruen: "grün",
  orange: "orange",
  weiss: "weiss",
  schwarz: "schwarz",
};

/** Grösste Menge je Posten — schützt vor Tippfehlern und entarteten Payloads,
 *  weit über jedem Trainingsbedarf. */
export const MATERIAL_MENGE_MAX = 999;

/** Ein Posten der Liste. `farbe` ist genau bei färbbarem Material gesetzt. */
export type MaterialPosten = {
  art: MaterialArt;
  farbe: FarbSlug | null;
  menge: number;
};

export function istMaterialArt(v: unknown): v is MaterialArt {
  return typeof v === "string" && (MATERIAL_ARTEN as readonly string[]).includes(v);
}

function istFarbe(v: unknown): v is FarbSlug {
  return typeof v === "string" && (farbSlugs as readonly string[]).includes(v);
}

/** Schlüssel eines Postens: Art und Farbe bestimmen, was zusammengezählt wird. */
function schluessel(art: MaterialArt, farbe: FarbSlug | null): string {
  return `${art}:${farbe ?? ""}`;
}

/** Die Farbe, unter der ein Posten geführt wird: färbbares Material immer mit
 *  Farbe (ohne Angabe die des Diagramms), alles andere nie. */
function wirksameFarbe(art: MaterialArt, farbe: unknown): FarbSlug | null {
  const info = MATERIAL_KATALOG[art];
  if (!info.farbig) return null;
  return istFarbe(farbe) ? farbe : info.standardFarbe;
}

/** Posten gleicher Art und Farbe zusammenfassen und in Katalog-, dann
 *  Farbreihenfolge bringen — die eine Normalform, in der Listen gespeichert,
 *  verglichen und angezeigt werden. */
export function normalisiere(posten: readonly MaterialPosten[]): MaterialPosten[] {
  const summen = new Map<string, MaterialPosten>();
  for (const p of posten) {
    const k = schluessel(p.art, p.farbe);
    const bisher = summen.get(k);
    summen.set(k, {
      ...p,
      menge: Math.min(MATERIAL_MENGE_MAX, (bisher?.menge ?? 0) + p.menge),
    });
  }
  const rang = (p: MaterialPosten) =>
    MATERIAL_ARTEN.indexOf(p.art) * 100 + (p.farbe ? farbSlugs.indexOf(p.farbe) + 1 : 0);
  return [...summen.values()].sort((a, b) => rang(a) - rang(b));
}

/** JSONB bzw. Formularwert -> gültige Liste in Normalform. Trust-Boundary wie
 *  `parseDiagramm`: ein unbrauchbarer Posten fällt weg, nie das Ganze.
 *  Unbekannte Arten, Mengen unter 1 und nicht ganzzahlige Mengen sind
 *  unbrauchbar; zu grosse Mengen werden gekappt. */
export function parseMaterialListe(json: unknown): MaterialPosten[] {
  if (!Array.isArray(json)) return [];
  const gueltig: MaterialPosten[] = [];
  for (const roh of json) {
    if (!roh || typeof roh !== "object") continue;
    const r = roh as Record<string, unknown>;
    if (!istMaterialArt(r.art)) continue;
    const menge = r.menge;
    if (typeof menge !== "number" || !Number.isInteger(menge) || menge < 1) continue;
    gueltig.push({
      art: r.art,
      farbe: wirksameFarbe(r.art, r.farbe),
      menge: Math.min(MATERIAL_MENGE_MAX, menge),
    });
  }
  return normalisiere(gueltig);
}

/** Wie `parseMaterialListe`, aber `null` bleibt `null` — die Basis kennt den
 *  Zustand «nie übernommen». */
export function parseMaterialBasis(json: unknown): MaterialPosten[] | null {
  return json == null ? null : parseMaterialListe(json);
}

/** Der Material-Vorschlag eines Diagramms: jedes gezeichnete Material-Symbol
 *  einzeln gezählt, nach Art und Farbe (Story #267 AK 1). Einzelteile werden
 *  nicht zu zusammengesetzten Gegenständen verbunden — vier Pylonen bleiben
 *  vier Pylonen, auch wenn sie ein Tor bilden (Epic Out of Scope 5). Dazu
 *  kommen die Überziehleibchen der farbig eingeteilten Feldspieler. */
export function materialVorschlag(diagramm: DiagrammData | null): MaterialPosten[] {
  if (!diagramm) return [];
  const posten: MaterialPosten[] = [];
  for (const el of diagramm.elemente) {
    if (el.art !== "symbol" || !istMaterialArt(el.typ)) continue;
    posten.push({ art: el.typ, farbe: wirksameFarbe(el.typ, el.farbe), menge: 1 });
  }
  return normalisiere([...posten, ...leibchenAusSpielern(diagramm)]);
}

/** Die Farbe, die eine Feldspielerfigur trägt: gesetzt oder die des
 *  Diagramms. Spiegelt `defaultFarbe` des Spielers im Symbol-Register
 *  (`check:material`). */
export const SPIELER_STANDARDFARBE: FarbSlug = "rot";

/** Überziehleibchen aus farbig eingeteilten Feldspielern (Story #268): Sind die
 *  Feldspielerfiguren in mindestens zwei Farben eingeteilt, braucht jede ein
 *  Leibchen ihrer Farbe — ein Team in eigener Kleidung nimmt die Anwendung
 *  nicht an. Tragen alle dieselbe Farbe, ist die Farbe keine Einteilung und
 *  ergibt kein Leibchen. Torwart und Trainer zählen nie. Gezeichnete Leibchen
 *  zählt `materialVorschlag` zusätzlich — auch eines, das eine Figur hält. */
function leibchenAusSpielern(diagramm: DiagrammData): MaterialPosten[] {
  const farben: FarbSlug[] = [];
  for (const el of diagramm.elemente) {
    if (el.art !== "symbol" || el.typ !== "spieler") continue;
    farben.push(istFarbe(el.farbe) ? el.farbe : SPIELER_STANDARDFARBE);
  }
  if (new Set(farben).size < 2) return [];
  return farben.map((farbe) => ({ art: "leibchen", farbe, menge: 1 }));
}

/** Der Vorschlag eines gespeicherten Diagramms (JSONB) — die Basis, die eine
 *  Server Action beim Übernehmen oder Beibehalten schreibt. Sie rechnet ihn
 *  selbst aus dem gespeicherten Diagramm, statt ihn dem Formular zu glauben. */
export function materialBasisAusDiagramm(diagramm: unknown): MaterialPosten[] {
  return materialVorschlag(parseDiagramm(diagramm));
}

/** Sind zwei Listen gleich? Beide in Normalform erwartet. */
export function gleicheListe(a: readonly MaterialPosten[], b: readonly MaterialPosten[]): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => p.art === b[i].art && p.farbe === b[i].farbe && p.menge === b[i].menge)
  );
}

/** Die Bezeichnung eines Postens ohne Menge — «Pylone, orange» bzw. im Plural
 *  «Pylonen, orange». */
export function postenBezeichnung(p: Pick<MaterialPosten, "art" | "farbe">, menge = 1): string {
  const info = MATERIAL_KATALOG[p.art];
  const name = menge === 1 ? info.einzahl : info.mehrzahl;
  return p.farbe ? `${name}, ${FARBE_LABEL[p.farbe]}` : name;
}

/** Ein Posten als Text — «4 Pylonen, orange», «1 Tor». */
export function postenText(p: MaterialPosten): string {
  const info = MATERIAL_KATALOG[p.art];
  const gezaehlt = zaehle(p.menge, info.einzahl, info.mehrzahl);
  return p.farbe ? `${gezaehlt}, ${FARBE_LABEL[p.farbe]}` : gezaehlt;
}

/** Hat die Übung überhaupt Material — in der Liste oder als Ergänzung? */
export function hatMaterial(liste: readonly MaterialPosten[], ergaenzung: readonly string[]): boolean {
  return liste.length > 0 || ergaenzung.length > 0;
}
