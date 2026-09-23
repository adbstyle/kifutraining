// Geführte Angaben und die Sichtbarkeit in der Form, in der jedes Werkzeug-
// Ergebnis sie ausgibt (Story #142, #193).
//
// - `Wert` — `{ slug, label }`: JEDE geführte Angabe erscheint so, nie als
//   nackter Slug mit einem getrennten `…_label`-Feld daneben.
// - `Sichtbarkeit` — `oeffentlich` | `entwurf`: die Wörter der Oberfläche
//   («Öffentlich», «Entwurf»), nicht die Spaltenwerte `public`/`private`. Ein
//   Zustand, keine Angabe aus dem Vokabular, darum ein Enum ohne Label.
//
// Neutral abgelegt, weil ausser den Werkzeugen (lib/mcp/bausteine.ts
// exportiert alles weiter) auch der Fachkern Auskünfte in dieser Form baut
// (lib/kern/auskunft.ts) — und der Kern nichts aus lib/mcp importiert.
//
// REIN: nur zod — die Prüfskripte laden diese Datei mit tsx.
import { z } from "zod";

export const Wert = z.object({ slug: z.string(), label: z.string() });
export type Wert = z.infer<typeof Wert>;

/** Slug → Wert. Fehlt ein Label, steht der Slug selbst da — derselbe
 *  Rückfall überall, damit nie ein leeres Label ausgegeben wird. */
export function wert(labels: Readonly<Record<string, string>>, slug: string): Wert {
  return { slug, label: labels[slug] || slug };
}

export function wertOderNull(
  labels: Readonly<Record<string, string>>,
  slug: string | null | undefined,
): Wert | null {
  return slug ? wert(labels, slug) : null;
}

export const Sichtbarkeit = z.enum(["oeffentlich", "entwurf"]);
export type Sichtbarkeit = z.infer<typeof Sichtbarkeit>;

/** Spaltenwert → Sichtbarkeit, wie die Oberfläche sie nennt. */
export function sichtbarkeitVon(visibility: "public" | "private"): Sichtbarkeit {
  return visibility === "public" ? "oeffentlich" : "entwurf";
}
