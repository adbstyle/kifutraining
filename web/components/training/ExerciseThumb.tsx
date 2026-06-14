import { UebungsBild } from "@/components/ui";
import { cn } from "@/lib/cn";

/* Kompaktes Feld-Diagramm-Thumbnail für Übungszeilen in Trainings-Ansichten
   (Editor + read-only): Trainer erkennen die Übung schneller am Bild. Zeigt das
   aktive Bild (gezeichnetes Diagramm oder Foto) oder die Kreide-Platzhalter-
   skizze, im 16:10-Format wie die Übungs-Cards. Rein präsentational;
   Standardbreite per `className` übersteuerbar. */
export function ExerciseThumb({
  bildUrl,
  diagramm,
  bildQuelle,
  name,
  className,
}: {
  bildUrl: string | null | undefined;
  diagramm?: unknown;
  bildQuelle?: "foto" | "diagramm" | null;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative block aspect-[16/10] w-36 shrink-0 overflow-hidden rounded-[4px] border border-outline-variant bg-surface-container-low",
        className,
      )}
    >
      <UebungsBild
        name={name}
        bildUrl={bildUrl}
        diagramm={diagramm}
        bildQuelle={bildQuelle}
        sizes="144px"
      />
    </span>
  );
}
