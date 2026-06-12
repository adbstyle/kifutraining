import Image from "next/image";
import { aktivesBild, parseDiagramm } from "@/lib/diagramm";
import { DiagrammView } from "@/components/diagramm/DiagrammView";
import { FieldPlaceholder } from "./FieldPlaceholder";

/**
 * Die EINE Bild-Weiche einer Übung (#56): zeigt das aktive Anzeige-Bild —
 * gezeichnetes Diagramm (als SVG aus der Struktur, Symbol-Updates wirken
 * sofort), hochgeladenes Foto oder die Platzhalter-Skizze. Wird von Karte,
 * Detailseite, Trainings-Thumbnail, Durchführung und Druck verwendet.
 * Erwartet einen relativen Container mit fixem Seitenverhältnis.
 */
export function UebungsBild({
  name,
  bildUrl,
  diagramm,
  bildQuelle,
  sizes,
}: {
  name: string;
  bildUrl?: string | null;
  diagramm?: unknown;
  bildQuelle?: "foto" | "diagramm" | null;
  /** `sizes` für das Foto (next/image). */
  sizes: string;
}) {
  const aktiv = aktivesBild({
    bildQuelle: bildQuelle ?? null,
    bildUrl: bildUrl ?? null,
    diagramm,
  });
  if (aktiv === "diagramm") {
    return (
      <DiagrammView
        diagramm={parseDiagramm(diagramm)!}
        title={`Feld-Diagramm: ${name}`}
      />
    );
  }
  if (aktiv === "foto") {
    return (
      <Image
        src={bildUrl!}
        alt={`Feld-Diagramm: ${name}`}
        fill
        sizes={sizes}
        className="object-contain"
      />
    );
  }
  return <FieldPlaceholder className="h-full w-full" />;
}
