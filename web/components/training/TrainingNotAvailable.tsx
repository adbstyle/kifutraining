import { FileQuestion } from "lucide-react";
import { ButtonLink, Leerzustand } from "@/components/ui";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";

/* Einheitliche „nicht verfügbar"-Rückmeldung für Trainings-Ansichten (Story #15 AC8):
   ein privates fremdes und ein nicht existentes Training sind ununterscheidbar
   (Postcondition 2). Dasselbe Leerfeld wie «Seite nicht gefunden». */
export function TrainingNotAvailable() {
  return (
    <Seitenrahmen
      breite="xl"
      krumen={[{ label: "Trainings", href: "/trainings" }, { label: "Nicht verfügbar" }]}
    >
      <Leerzustand
        icon={FileQuestion}
        titel="Training nicht verfügbar"
        ueberschrift="h1"
        aktion={
          <ButtonLink href="/trainings" variant="tonal">
            Öffentliche Trainings entdecken
          </ButtonLink>
        }
      >
        Dieses Training existiert nicht oder ist nicht öffentlich geteilt.
      </Leerzustand>
    </Seitenrahmen>
  );
}
