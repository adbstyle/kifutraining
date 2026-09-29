/**
 * Die Spalten einer Übung, wenn der KI-Assistent ihr Feld-Diagramm setzt
 * (#145) — beim Anlegen wie an einer bestehenden Übung. Rein, ohne Server-
 * und Datenbankbezug; `daten` ist das von `pruefeDiagramm` normalisierte
 * Diagramm.
 *
 * - Bild: Hatte die Übung keines, wird das Diagramm ihr Bild (PC 3); ein
 *   angezeigtes Foto bleibt es. Massgeblich ist das heute angezeigte Bild
 *   (`aktivesBild`), nicht allein `bild_quelle` — bei einer Übung ohne
 *   `bild_quelle`, aber mit Foto und altem Diagramm zeigt die App das
 *   Diagramm, und das bleibt so.
 * - Material: Die gezählte Liste wird die aus dem Diagramm gezählte, und sie
 *   ist zugleich die Basis (PC 4, Epic #266). Die freie Ergänzung
 *   (`material`) fasst das Setzen nie an (PC 5).
 */
import { aktivesBild, bildQuelleZurZeichnung, type DiagrammData } from "@/lib/diagramm";
import { materialVorschlag, type MaterialPosten } from "@/lib/material";

export function diagrammSpalten(
  bisher: { bild_quelle: string | null; bild_url: string | null; diagramm: unknown },
  daten: DiagrammData,
): {
  diagramm: DiagrammData;
  bild_quelle: "foto" | "diagramm" | null;
  material_liste: MaterialPosten[];
  material_basis: MaterialPosten[];
} {
  const angezeigt = aktivesBild({
    bildQuelle: bisher.bild_quelle,
    bildUrl: bisher.bild_url,
    diagramm: bisher.diagramm,
  });
  const material = materialVorschlag(daten);
  return {
    diagramm: daten,
    bild_quelle: bildQuelleZurZeichnung(angezeigt, daten, false),
    material_liste: material,
    material_basis: material,
  };
}
