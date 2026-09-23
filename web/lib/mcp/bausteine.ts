// Bausteine für die Schemas der KI-Werkzeuge (Story #142, Vorlage für
// #192–#199).
//
// Ausgabekonvention: JEDE geführte Angabe erscheint als `Wert` —
// `{ slug, label }` —, nie als nackter Slug mit einem getrennten
// `…_label`-Feld daneben. So liest der Assistent jede Angabe gleich, und der
// Klartext ist immer der, den die Oberfläche zeigt. Nur die Sichtbarkeit
// bleibt ein Enum: sie ist ein Zustand, keine Angabe aus dem Vokabular.
//
// REIN: keine Server-Importe — `check:ki-zugang` lädt diese Datei mit tsx.
import { z } from "zod";

/** Ein nicht-leeres Vokabular als zod-Enum. Leer hiesse: das Vokabular ist
 *  kaputt generiert — dann soll das Laden scheitern, nicht still alles
 *  zulassen. */
export function alsEnum<T extends string>(werte: readonly T[]) {
  if (werte.length === 0) throw new Error("Leeres Vokabular");
  return z.enum(werte as unknown as [T, ...T[]]);
}

/** Ein geführter Wert samt Klartext. */
export const Wert = z.object({ slug: z.string(), label: z.string() });
export type WertT = z.infer<typeof Wert>;

/** Slug → Wert. Fehlt ein Label, steht der Slug selbst da — derselbe
 *  Rückfall überall, damit nie ein leeres Label ausgegeben wird. */
export function wert(labels: Readonly<Record<string, string>>, slug: string): WertT {
  return { slug, label: labels[slug] || slug };
}

export function wertOderNull(
  labels: Readonly<Record<string, string>>,
  slug: string | null | undefined,
): WertT | null {
  return slug ? wert(labels, slug) : null;
}

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ist das eine UUID? Guard für Kennungen von aussen, bevor sie eine
 *  uuid-Spalte erreichen (dort gäbe es sonst einen Datenbankfehler). */
export function istUuid(wert: unknown): wert is string {
  return typeof wert === "string" && UUID.test(wert);
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
  /** Kifu-Manual, Community (öffentlich) oder Entwurf (privat) — dieselbe
   *  Plakette wie auf der Karte. */
  herkunft: Wert,
  sichtbarkeit: z.enum(["public", "private"]),
  bild_url: z.string().nullable(),
  hat_diagramm: z.boolean(),
});
