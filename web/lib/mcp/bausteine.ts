// Bausteine für die Schemas der KI-Werkzeuge (Story #142, Vorlage für
// #192–#199).
//
// Ausgabekonvention: JEDE geführte Angabe erscheint als `Wert` —
// `{ slug, label }` —, nie als nackter Slug mit einem getrennten
// `…_label`-Feld daneben. So liest der Assistent jede Angabe gleich, und der
// Klartext ist immer der, den die Oberfläche zeigt. Nur die Sichtbarkeit
// bleibt ein Enum (`oeffentlich` | `entwurf`): sie ist ein Zustand, keine
// Angabe aus dem Vokabular. Beide stehen neutral in lib/wert.ts, weil auch der
// Fachkern sie braucht.
//
// Dazu die Beschreibungsbausteine, die mehrere Werkzeuge teilen (Altersstufen,
// Trainingsschema, Einordnung, Alterskategorien) — aus dem Vokabular erzeugt:
// Ein neuer Wert in data/vokabular.yaml erscheint in jeder Beschreibung ohne
// Zutun.
//
// REIN: keine Server-Importe — `check:ki-zugang` lädt diese Datei mit tsx.
import { z } from "zod";
import { UUID_FORMAT } from "@/lib/kennung";
import { altersstufe as altersstufeLabels, hauptteilkategorieSlugs } from "@/lib/vocab";
import {
  ALTERSSTUFEN,
  einordnungenFuer,
  einordnungsSlugsFuer,
  kategorienFuer,
  traegtHauptteilkategorie,
  type Altersstufe,
} from "@/lib/altersstufe";
import { kategorieStufe } from "@/lib/labels";
import { HAUPTTEILKATEGORIEN } from "@/lib/training";

/** Ein nicht-leeres Vokabular als zod-Enum. Leer hiesse: das Vokabular ist
 *  kaputt generiert — dann soll das Laden scheitern, nicht still alles
 *  zulassen. */
export function alsEnum<T extends string>(werte: readonly T[]) {
  if (werte.length === 0) throw new Error("Leeres Vokabular");
  return z.enum(werte as unknown as [T, ...T[]]);
}

import { Sichtbarkeit, Wert } from "@/lib/wert";
export { Sichtbarkeit, Wert, sichtbarkeitVon, wert, wertOderNull } from "@/lib/wert";

/** Eine Option einer Filterleiste (lib/filter-optionen.ts). */
type Option = { value: string; label: string; group?: string };

/** Ein Suchfilter mit genau den Werten einer Filterleiste des Katalogs: als
 *  Enum (nie ein freier String — die Werte landen teils interpoliert in einer
 *  PostgREST-`or=`-Klausel) und mit einer aus denselben Optionen erzeugten
 *  Beschreibung, nach Altersstufe gruppiert wie in der Oberfläche. */
export function katalogFilter(optionen: readonly Option[], vorspann: string) {
  const gruppen = [...new Set(optionen.map((o) => o.group ?? ""))];
  const liste = gruppen
    .map((g) => {
      const werte = optionen
        .filter((o) => (o.group ?? "") === g)
        .map((o) => `${o.value} (${o.label})`)
        .join(", ");
      return g ? `${g}: ${werte}` : werte;
    })
    .join(". ");
  return z
    .array(alsEnum(optionen.map((o) => o.value)))
    .max(optionen.length)
    .optional()
    .describe(`${vorspann} Mehrere Werte wirken als ODER. ${liste}.`);
}

const liste = (werte: readonly { slug: string; label: string }[]) =>
  werte.map((w) => `${w.slug} (${w.label})`).join(", ");

/** Die Altersstufen mit Klartext, etwa «kinderfussball (Kinderfussball), …». */
export const ALTERSSTUFEN_TEXT = ALTERSSTUFEN.map((s) => `${s} (${altersstufeLabels[s]})`).join(", ");

/** Das Trainingsschema einer Altersstufe als ein Satz: Teile, Blöcke,
 *  Hauptteilkategorien — damit der Assistent die Einordnung nicht rät. */
function schemaText(stufe: Altersstufe): string {
  const teile = einordnungenFuer(stufe).map((g) => {
    if (g.bloecke.length > 0) return `${g.label}: ${liste(g.bloecke)}`;
    const hkat = traegtHauptteilkategorie(stufe, g.teil)
      ? ` - Hauptteilkategorie Pflicht: ${liste(HAUPTTEILKATEGORIEN)}`
      : "";
    return `${g.teil} (${g.label}${hkat})`;
  });
  return `${altersstufeLabels[stufe]}: ${teile.join("; ")}.`;
}

export const SCHEMA_TEXT = ALTERSSTUFEN.map(schemaText).join(" ");

export const PFLICHT_SATZ =
  "Im Kinderfussball-Hauptteil ist die Hauptteilkategorie Pflicht; ausserhalb davon bleibt sie leer.";

/** Alle Einordnungen beider Altersstufen — welche passt, entscheidet der Kern
 *  an der Altersstufe (des Trainings bzw. der Übung) und nennt sonst die
 *  zulässigen. */
export const Einordnung = alsEnum([...new Set(ALTERSSTUFEN.flatMap(einordnungsSlugsFuer))]).describe(
  `Wohin die Übung gehört: im Kinderfussball der Trainingsteil, im Juniorenfussball der Block. ${SCHEMA_TEXT}`,
);
export const Hauptteilkategorie = alsEnum(hauptteilkategorieSlugs)
  .optional()
  .describe(`${PFLICHT_SATZ} Werte: ${liste(HAUPTTEILKATEGORIEN)}.`);

/** Die Alterskategorien je Altersstufe als ein Satz, etwa «Kinderfussball: G
 *  (G-Junior:innen), F (…)» — für jede Beschreibung, die Kategorien annimmt. */
export function kategorienText(stufen: readonly Altersstufe[]): string {
  return stufen
    .map(
      (s) =>
        `${altersstufeLabels[s]}: ${kategorienFuer(s)
          .map((k) => `${k} (${kategorieStufe[k as keyof typeof kategorieStufe] ?? k})`)
          .join(", ")}`,
    )
    .join(". ");
}

/** Eine Kennung (UUID) als Eingabe — im Format von `istUuid` (lib/kennung.ts)
 *  statt `z.uuid()`, das streng nach RFC-Version und -Variante prüft.
 *
 *  Kleingeschrieben an dieser EINEN Stelle: Postgres liefert Kennungen klein,
 *  und der Kern vergleicht sie als Text (etwa die Gruppen eines Durchlaufs
 *  gegen die des Trainings). Eine grossgeschriebene Kennung vom Assistenten
 *  wäre sonst «fremd», obwohl sie dieselbe ist. `toLowerCase()` statt
 *  `transform`, damit das Eingabeschema als JSON-Schema darstellbar bleibt. */
export function kennung(beschreibung: string) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .regex(UUID_FORMAT, "Keine gültige Kennung (UUID).")
    .describe(beschreibung);
}

/** Was jede Übung in jedem Werkzeug trägt — die Angaben der Katalog-Karte
 *  (#142 AK 7). Treffer und volle Übung erweitern diesen Kopf, statt ihn
 *  zweimal zu beschreiben. */
export const UebungKopf = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  /** Die Seite der Übung in KiFu. */
  url: z.string(),
  altersstufe: Wert,
  /** Kinderfussball: der Trainingsteil; Juniorenfussball: der Block. */
  einordnung: Wert,
  hauptteilkategorie: Wert.nullable(),
  feldtyp: Wert.nullable(),
  spielfeld: z.object({ laenge_m: z.number(), breite_m: z.number() }).nullable(),
  anzahl_kinder: z
    .object({ min: z.number().nullable(), max: z.number().nullable() })
    .nullable(),
  /** Kifu-Manual, Community (öffentlich) oder Entwurf (privat) — dieselbe
   *  Plakette wie auf der Karte. */
  herkunft: Wert,
  sichtbarkeit: Sichtbarkeit,
  bild_url: z.string().nullable(),
  hat_diagramm: z.boolean(),
});
