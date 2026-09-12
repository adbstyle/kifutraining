import Link from "next/link";
import { PenLine } from "lucide-react";
import { parseDiagramm } from "@/lib/diagramm";
import { DiagrammView } from "./DiagrammView";
import { Card } from "@/components/ui/Card";
import { FieldPlaceholder } from "@/components/ui/FieldPlaceholder";
import { buttonClasses } from "@/components/ui/Button";

/**
 * Einstieg in den Diagramm-Editor auf der Bearbeiten-Seite: zeigt eine
 * Vorschau des gezeichneten Diagramms — oder, wenn keines existiert, eine
 * Aufforderung zum Zeichnen. Die ganze Fläche ist ein Link in den Editor;
 * ein zusätzlich sichtbarer Button zeigt die Aktion an (er ist nur Optik,
 * der Link trägt den Klick — kein <button> in <a>). Zeigt bewusst immer das
 * Diagramm, nie das Foto.
 */
export function DiagrammVorschau({
  href,
  name,
  diagramm,
}: {
  /** Ziel des Editors — die Übung in der Bibliothek oder die Fassung im
   *  Training (Epic #72). */
  href: string;
  name: string;
  diagramm: unknown;
}) {
  const data = parseDiagramm(diagramm);
  // Wie hatDiagramm(): nur ein nicht-leeres, valides Diagramm zählt. `data`
  // wird unten zum Rendern gebraucht, daher hier direkt aus dem Parse-Ergebnis.
  const mitDiagramm = !!data && data.elemente.length > 0;
  const aktion = mitDiagramm ? "Diagramm bearbeiten" : "Diagramm zeichnen";

  return (
    /* Die Zustands-Ebene sitzt auf dem Link, nicht auf der Karte: Er deckt
       die ganze Fläche, und nur er meldet Fokus und Druck — auf dem <div>
       bliebe die Ebene beim Tabben stumm. */
    <Card className="group overflow-hidden">
      <Link
        href={href}
        aria-label={aktion}
        className="state focus-ring-inset block rounded-flaeche"
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-linie">
          {mitDiagramm && data ? (
            <DiagrammView diagramm={data} title={`Feld-Diagramm: ${name}`} />
          ) : (
            <>
              <FieldPlaceholder className="absolute inset-0" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                <PenLine size={28} strokeWidth={1.5} className="text-primary" aria-hidden />
                <p className="type-body-medium max-w-xs text-on-surface-mittel">
                  Spielfeld-Skizze mit Toren, Hütchen und Spielern direkt in der App zeichnen.
                </p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 p-3">
          <span className="type-label-small text-on-surface-mittel">
            {mitDiagramm ? "Spielfeld-Diagramm" : "Noch kein Diagramm"}
          </span>
          {/* Nur Optik — der Link trägt Klick und aria-label, daher vor AT versteckt. */}
          <span className={buttonClasses("tonal", "sm")} aria-hidden="true">
            {aktion}
          </span>
        </div>
      </Link>
    </Card>
  );
}
