// Das Material einer Übung in der Form, in der die KI-Werkzeuge es ausgeben
// (Story #267 PC 4): gegliedert in die Liste aus dem Diagramm-Vorrat und die
// freie Ergänzung — dieselbe Gliederung wie in der Oberfläche. Art und Farbe
// als `Wert` (`{ slug, label }`), wie jede geführte Angabe.
//
// Eine Quelle für «uebung_abrufen» (lib/mcp) und «training_abrufen»
// (lib/kern), damit beide dasselbe sagen.
//
// REIN: nur zod, lib/wert und lib/material(-gesamt) — die Prüfskripte laden diese Datei
// mit tsx.
import { z } from "zod";
import { Wert, wert } from "@/lib/wert";
import { FARBE_LABEL, MATERIAL_KATALOG, type MaterialPosten } from "@/lib/material";
import type { GesamtMaterial } from "@/lib/material-gesamt";

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

/** Die Gesamt-Materialliste eines Trainings (Story #271) für
 *  «training_abrufen»: höchster gleichzeitiger Bedarf über alle Varianten,
 *  dazu die freien Ergänzungen je Übung. */
export function gesamtMaterialSchema(streng = false) {
  const obj = streng ? z.strictObject : z.object;
  return obj({
    /** Was das Training zu einem Zeitpunkt höchstens gleichzeitig braucht —
     *  parallele Gruppen zusammengezählt, nacheinander Laufendes und
     *  Varianten mit ihrem grössten Bedarf. */
    liste: materialSchema(streng).shape.liste,
    /** Die freien Ergänzungen je Übung, nicht verrechnet. */
    ergaenzungen: z.array(obj({ fassung_id: z.string(), uebung: z.string(), texte: z.array(z.string()) })),
  });
}

export function gesamtMaterialAusgabe(g: GesamtMaterial): z.infer<ReturnType<typeof gesamtMaterialSchema>> {
  return {
    liste: materialAusgabe(g.liste, []).liste,
    ergaenzungen: g.ergaenzungen.map((e) => ({ fassung_id: e.fassungId, uebung: e.uebung, texte: e.texte })),
  };
}
