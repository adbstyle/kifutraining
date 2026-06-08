import { FileQuestion } from "lucide-react";
import { ButtonLink } from "@/components/ui";

/* Einheitliche „nicht verfügbar"-Rückmeldung für Plan-Ansichten (Story #15 AC8):
   ein privater fremder und ein nicht existenter Plan sind ununterscheidbar
   (Postcondition 2). */
export function PlanNotAvailable() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-20 text-center">
      <FileQuestion size={48} strokeWidth={1.5} className="text-on-surface-variant" aria-hidden />
      <h1 className="type-headline-small text-on-surface">Plan nicht verfügbar</h1>
      <p className="type-body-medium max-w-sm text-on-surface-variant">
        Dieser Trainingsplan existiert nicht oder ist nicht öffentlich geteilt.
      </p>
      <ButtonLink href="/plaene" variant="tonal" className="mt-2">
        Öffentliche Pläne entdecken
      </ButtonLink>
    </main>
  );
}
