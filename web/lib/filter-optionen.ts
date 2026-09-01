import {
  altersstufe as altersstufeLabels,
  feldtyp as feldtypLabels,
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
  traegtUebungstyp,
  type Altersstufe,
} from "@/lib/altersstufe";

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
