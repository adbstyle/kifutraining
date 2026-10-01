import { FileQuestion } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";

/* Einheitliche „nicht verfügbar"-Rückmeldung für Trainings-Ansichten (Story #15 AC8):
   ein privates fremdes und ein nicht existentes Training sind ununterscheidbar
   (Postcondition 2). */
export function TrainingNotAvailable() {
  return (
    <Seitenrahmen
      breite="xl"
      krumen={[{ label: "Trainings", href: "/trainings" }, { label: "Nicht verfügbar" }]}
    >
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <FileQuestion size={48} strokeWidth={1.5} className="text-on-surface-mittel" aria-hidden />
        <h1 className="type-headline-small text-on-surface">Training nicht verfügbar</h1>
        <p className="type-body-medium max-w-sm text-on-surface-mittel">
          Dieses Training existiert nicht oder ist nicht öffentlich geteilt.
        </p>
        <ButtonLink href="/trainings" variant="tonal" className="mt-2">
          Öffentliche Trainings entdecken
        </ButtonLink>
      </div>
    </Seitenrahmen>
  );
}
