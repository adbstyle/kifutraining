import { Clock } from "lucide-react";
import { KategorieLozenge, Lozenge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { altersstufe as altersstufeLabels, type KategorieSlug } from "@/lib/vocab";

/* Die Angaben unter dem Namen eines Trainings: Altersstufe, Alterskategorien,
   Dauer der angezeigten Variante und — falls vorhanden — das Ziel. Dieselben
   auf der Ansichtsseite und im Detail der Trainingsübersicht (#630); die
   Abstände setzt der Aufrufer. Das Ziel sehen auch Betrachter eines
   veröffentlichten Trainings (Story 10 PC 1); ohne Ziel entfällt die Zeile. */
export function TrainingKopfAngaben({
  altersstufe,
  stufen,
  dauerText,
  ziel,
  className,
  zielClassName = "mt-2",
}: {
  altersstufe: keyof typeof altersstufeLabels;
  stufen: readonly KategorieSlug[];
  dauerText: string;
  ziel: string | null;
  className?: string;
  /** Abstand der Ziel-Zeile nach oben. */
  zielClassName?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Lozenge>{altersstufeLabels[altersstufe]}</Lozenge>
        {stufen.map((k) => (
          <KategorieLozenge key={k} k={k} />
        ))}
        <span className="inline-flex items-center gap-1.5 type-label-large text-on-surface-mittel">
          <Clock size={16} strokeWidth={2} aria-hidden />
          {dauerText}
        </span>
      </div>
      {ziel && (
        <p className={cn("type-body-medium text-on-surface", zielClassName)}>
          <span className="type-label-small text-on-surface-mittel">Ziel: </span>
          {ziel}
        </p>
      )}
    </div>
  );
}
