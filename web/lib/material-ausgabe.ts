// Das Material einer Übung in der Form, in der die KI-Werkzeuge es ausgeben
// (Story #267 PC 4): gegliedert in die Liste aus dem Diagramm-Vorrat und die
// freie Ergänzung — dieselbe Gliederung wie in der Oberfläche. Art und Farbe
// als `Wert` (`{ slug, label }`), wie jede geführte Angabe.
//
// Eine Quelle für «uebung_abrufen» (lib/mcp) und «training_abrufen»
// (lib/kern), damit beide dasselbe sagen.
//
// REIN: nur zod, lib/wert und lib/material — die Prüfskripte laden diese Datei
// mit tsx.
import { z } from "zod";
import { Wert, wert } from "@/lib/wert";
import { FARBE_LABEL, MATERIAL_KATALOG, type MaterialPosten } from "@/lib/material";

/** Das Ausgabe-Schema; `streng` nimmt `z.strictObject` auf allen Ebenen (siehe
 *  lib/kern/auskunft-schema.ts). */
export function materialSchema(streng = false) {
  const obj = streng ? z.strictObject : z.object;
  const W = streng ? z.strictObject(Wert.shape) : Wert;
  return obj({
    /** Material aus dem Diagramm-Vorrat; `menge` zählt Stück. */
    liste: z.array(obj({ art: W, farbe: W.nullable(), menge: z.number().int() })),
    /** Was das Diagramm nicht kennt, als freier Text. */
    ergaenzung: z.array(z.string()),
  });
}
export type MaterialAusgabe = z.infer<ReturnType<typeof materialSchema>>;

const ART_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(MATERIAL_KATALOG).map(([art, info]) => [art, info.einzahl]),
);

export function materialAusgabe(
  liste: readonly MaterialPosten[],
  ergaenzung: readonly string[],
): MaterialAusgabe {
  return {
    liste: liste.map((p) => ({
      art: wert(ART_LABEL, p.art),
      farbe: p.farbe ? wert(FARBE_LABEL, p.farbe) : null,
      menge: p.menge,
    })),
    ergaenzung: [...ergaenzung],
  };
}
