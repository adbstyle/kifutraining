import Image from "next/image";
import { FieldPlaceholder } from "@/components/ui";
import { cn } from "@/lib/cn";

/* Kompaktes Feld-Diagramm-Thumbnail für Übungszeilen in Trainings-Ansichten
   (Editor + read-only): Trainer erkennen die Übung schneller am Bild. Zeigt das
   Diagramm oder die Kreide-Platzhalterskizze, im 16:10-Format wie die
   Übungs-Cards. Rein präsentational; Standardbreite per `className` übersteuerbar. */
export function ExerciseThumb({
  bildUrl,
  name,
  className,
}: {
  bildUrl: string | null | undefined;
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
      {bildUrl ? (
        <Image
          src={bildUrl}
          alt={`Feld-Diagramm: ${name}`}
          fill
          sizes="144px"
          className="object-contain"
        />
      ) : (
        <FieldPlaceholder className="h-full w-full" />
      )}
    </span>
  );
}
