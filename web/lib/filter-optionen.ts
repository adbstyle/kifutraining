import {
  altersstufe as altersstufeLabels,
  feldtyp as feldtypLabels,
  hauptteilkategorieSlugs,
  junioren_block as juniorenBlockLabels,
  trainingsteil as trainingsteilLabels,
  trainingsteilSlugs,
  uebungstyp as uebungstypLabels,
  type FeldtypSlug,
  type UebungstypSlug,
} from "@/lib/vocab";
import { ERSCHEINUNGSFORM_LABEL, kategorieStufe } from "@/lib/labels";
import {
  ALTERSSTUFEN,
  einordnungsSlugsFuer,
  erscheinungsformenFuer,
  kategorienFuer,
  traegtFeldtyp,
  traegtHauptteilkategorie,
  traegtUebungstyp,
  type Altersstufe,
} from "@/lib/altersstufe";
import { HAUPTTEILKATEGORIEN } from "@/lib/training";

/**
 * Die Werte, die die Filterleisten anbieten — eine Quelle für Übungskatalog
 * und Trainings-Übersicht.
 *
 * Zwei Regeln stecken hier drin:
 *
 * 1. **Jede Filter-Dimension zeigt ihre Werte nach Altersstufe gruppiert**
 *    (Story #131). Auch dort, wo alle Werte derselben Stufe gehören: Übungstyp
 *    ist Juniorenfussball, Feldtyp Kinderfussball — beide bekommen ihre EINE
 *    Gruppen-Beschriftung. Ein Muster, kein Sonderfall; und die Zugehörigkeit
 *    steht auch dann da, wenn der sichtbare Bestand gerade nichts davon
 *    enthält (AC 8).
 * 2. **Die Zugehörigkeit wird nicht hier zweitgeschrieben.** Sie kommt aus dem
 *    Feld-Gating in `lib/altersstufe.ts` — jene Funktionen sind die
 *    deklarierten Spiegel der SQL-CHECKs. Eine Parallel-Tabelle an dieser
 *    Stelle liefe früher oder später davon weg.
 *
 * Die Beschriftung der Gruppen ist das Label aus dem `altersstufe`-Vokabular,
 * überall dieselbe (Story #131 PC 3).
 */

/** Eine Filter-Option mit ihrer Gruppen-Beschriftung. Strukturell die
 *  `SelectOption` des Kits; hier eigens getippt, damit dieses Modul nicht an
 *  einer Client-Komponente hängt (es wird auch serverseitig gelesen). */
export type FilterOption = { value: string; label: string; group: string };

const gruppe = (stufe: Altersstufe) => altersstufeLabels[stufe];

/** Die eine Altersstufe, deren Übungen eine ganze Dimension überhaupt tragen.
 *
 *  Gefragt wird das Feld-Gating, nicht eine Liste hier: `traegtFeldtyp()` bzw.
 *  `traegtUebungstyp()` entscheiden es, und sie bleiben richtig, wenn dort ein
 *  Block dazukommt oder wegfällt. Trägt keine Stufe die Dimension — was nur
 *  ein Umbau des Gatings auslösen kann —, fällt die Beschriftung auf den
 *  Kinderfussball zurück, dieselbe Festlegung wie in `alsAltersstufe()`. */
function stufeDerDimension(traegt: (stufe: Altersstufe) => boolean): Altersstufe {
  return ALTERSSTUFEN.find(traegt) ?? "kinderfussball";
}

// ── Einordnung (Filter „Trainingsteil") ─────────────────────────────────────

/** Die wählbaren Einordnungen des Kinderfussballs — die Trainingsteile des
 *  Manuals Fussball Kinder, den Hauptteil aufgelöst in seine drei
 *  Hauptteilkategorien (Story #129 AC 1–3).
 *
 *  Fachlich ist die Hauptteilkategorie die zweite Ebene unter dem Hauptteil —
 *  genau die Rolle, die im Juniorenschema die Blöcke spielen. In beiden Welten
 *  wird darum die feinste Ebene gewählt, die das jeweilige Lehrmittel kennt;
 *  «Hauptteil» als Ganzes ist kein wählbarer Wert mehr. Die Reihenfolge
 *  innerhalb des Hauptteils ist die feste methodische des SFV (Abb. 14) aus
 *  `HAUPTTEILKATEGORIEN`. */
const kifuEinordnungen: { value: string; label: string }[] = trainingsteilSlugs.flatMap(
  (teil) =>
    traegtHauptteilkategorie("kinderfussball", teil)
      ? HAUPTTEILKATEGORIEN.map((h) => ({ value: h.slug as string, label: h.label }))
      : [{ value: teil as string, label: trainingsteilLabels[teil] }],
);

/** Die Optionen des Trainingsteil-Filters über beide Welten: die Einordnungen
 *  des Kinderfussballs und die sieben Blöcke des Juniorenschemas, in zwei nach
 *  Altersstufe beschrifteten Gruppen. Der Katalog filtert bewusst über BEIDE
 *  Altersstufen — er ist der eine Ort, an dem der ganze sichtbare Bestand
 *  nebeneinandersteht.
 *
 *  Das «Auffangen» kommt seit Story #128 in beiden Gruppen vor und heisst dort
 *  gleich. Unterschieden werden die zwei über ihre Gruppen-Beschriftung; ein
 *  Label-Zusatz wäre daneben doppelt gemoppelt (Entscheid Story #128 AC 12).
 *
 *  ACHTUNG: gruppensortiert lassen. Die Kopfzeile im MultiSelect entsteht
 *  positional (neue Gruppe = neue Kopfzeile) — durchmischte Optionen erzeugen
 *  dieselbe Kopfzeile mehrfach. */
export const einordnungFilterOptionen: FilterOption[] = [
  ...kifuEinordnungen.map((o) => ({ ...o, group: gruppe("kinderfussball") })),
  ...Object.entries(juniorenBlockLabels).map(([value, label]) => ({
    value,
    label: label as string,
    group: gruppe("juniorenfussball"),
  })),
];

const EINORDNUNG_FILTER_SLUGS = new Set(einordnungFilterOptionen.map((o) => o.value));
const HKAT_SLUGS = new Set<string>(hauptteilkategorieSlugs);

/** Rohe `?teil=`-Werte auf die wählbaren Angaben eindampfen.
 *
 *  Ohne diese Allowlist bliebe ein Wert aus einem früher geteilten Verweis als
 *  unsichtbarer, aber wirksamer Filter stehen — das MultiSelect wirft
 *  Unbekanntes in der ANZEIGE still weg, die Abfrage sähe es weiter. Betrifft
 *  namentlich `?teil=hauptteil`: der Hauptteil als Ganzes ist seit Story #129
 *  kein wählbarer Wert mehr. */
export function alsEinordnungsFilter(werte: string[]): string[] {
  return werte.filter((w) => EINORDNUNG_FILTER_SLUGS.has(w));
}

/** Die gewählten Angaben auf die beiden Spalten aufteilen, in denen sie
 *  stehen: Trainingsteile bzw. Junioren-Blöcke in `trainingsteil`, die drei
 *  Hauptteilkategorien in `hauptteilkategorie`. Der Query-Layer verknüpft die
 *  Zweige mit ODER (Story #129 AC 4/5). */
export function einordnungNachSpalten(werte: string[]): {
  teile: string[];
  hkats: string[];
} {
  return {
    teile: werte.filter((w) => !HKAT_SLUGS.has(w)),
    hkats: werte.filter((w) => HKAT_SLUGS.has(w)),
  };
}

/** Auf welchen Filterwert zeigt ein Verweis in den Katalog, der die Einordnung
 *  dieser Übung meint? Im Kinderfussball-Hauptteil ist das ihre
 *  Hauptteilkategorie — «Hauptteil» selbst ist kein wählbarer Wert mehr —,
 *  sonst die Einordnung unverändert.
 *
 *  Eine Stelle für alle Brotkrumen (Detail-, Bearbeiten- und Diagramm-Seite);
 *  die ANZEIGE der Einordnung bleibt davon unberührt, nur das Filterziel des
 *  Links ändert sich (Story #129, PO-Entscheid). */
export function katalogFilterZiel(ex: {
  altersstufe: Altersstufe;
  trainingsteil: string;
  hauptteilkategorie: string | null;
}): string {
  return traegtHauptteilkategorie(ex.altersstufe, ex.trainingsteil) &&
    ex.hauptteilkategorie
    ? ex.hauptteilkategorie
    : ex.trainingsteil;
}

// ── Übrige Dimensionen ──────────────────────────────────────────────────────

/** Alterskategorien G–A, aufgeteilt in die Kategorien der beiden Manuals.
 *  Reihenfolge innerhalb der Stufe unverändert (Story #131 AC 6). */
export const stufenOptionen: FilterOption[] = ALTERSSTUFEN.flatMap((stufe) =>
  kategorienFuer(stufe).map((k) => ({
    value: k,
    label: kategorieStufe[k as keyof typeof kategorieStufe],
    group: gruppe(stufe),
  })),
);

/** Erscheinungsformen beider Manuals als EINE Dimension: gewählte Werte wirken
 *  untereinander als ODER, gleich aus welcher Quelle — neu nur nach Altersstufe
 *  beschriftet. Innerhalb einer Stufe ohne weitere Untergliederung nach
 *  Spielphasen (Story #131 Out of Scope 6). */
export const formOptionen: FilterOption[] = ALTERSSTUFEN.flatMap((stufe) =>
  erscheinungsformenFuer(stufe).map((f) => ({
    value: f,
    label: ERSCHEINUNGSFORM_LABEL[f] ?? f,
    group: gruppe(stufe),
  })),
);

/** Feldtyp — Kleinfeld/Grossfeld/Freies Feld ist eine Kategorie des Manuals
 *  Fussball Kinder; das Junioren-Manual führt an seiner Stelle eine
 *  Spielfeldgrösse in Metern. Eine Gruppe, entsprechend beschriftet. */
export const feldOptionen: FilterOption[] = (
  Object.keys(feldtypLabels) as FeldtypSlug[]
).map((f) => ({
  value: f,
  label: feldtypLabels[f],
  group: gruppe(stufeDerDimension((stufe) => traegtFeldtyp(stufe))),
}));

/** Übungstyp — die Typologie des Manuals Fussball Jugendliche; der
 *  Kinderfussball kennt sie gar nicht. Eine Gruppe, entsprechend beschriftet.
 *
 *  Die Stufe wird erfragt, nicht gesetzt: Trägt IRGENDEINE Einordnung dieser
 *  Stufe einen Übungstyp, gehört die Dimension ihr. Damit hängt die
 *  Beschriftung nicht an einer hier wiederholten Blockliste. */
export const typOptionen: FilterOption[] = (
  Object.keys(uebungstypLabels) as UebungstypSlug[]
).map((t) => ({
  value: t,
  label: uebungstypLabels[t],
  group: gruppe(
    stufeDerDimension((stufe) =>
      einordnungsSlugsFuer(stufe).some((e) => traegtUebungstyp(stufe, e)),
    ),
  ),
}));
