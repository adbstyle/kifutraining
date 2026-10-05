"use client";

import { Button, Dialog } from "@/components/ui";
import { NameFeld, StufenEigenschaft, ZielEigenschaft } from "./editor/TrainingKopf";
import {
  AbweichendeUebungenListe,
  useNameSpeichern,
  useStufenAendern,
  useZielSpeichern,
} from "./useTrainingAngaben";
import type { Altersstufe } from "@/lib/altersstufe";
import type { Variante } from "@/lib/varianten";

/* Name, Ziel und Alterskategorien in der Ansicht eines Trainings ändern
   (Epic #369, Story #375) — für alle, die das Training bearbeiten dürfen. Es
   sind dieselben Felder und dieselbe Speicherregel wie beim Zusammenstellen
   (`useTrainingAngaben`). */

/** Der Name als Überschrift-Feld — anstelle der Überschrift (AK 1). */
export function AnsichtName({ trainingId, name }: { trainingId: string; name: string }) {
  const n = useNameSpeichern(trainingId, name);
  return <NameFeld name={n.name} onSpeichern={n.speichere} />;
}

/** Das Ziel in der Spalte (AK 2), als bearbeitbare Eigenschaft. */
export function AnsichtZiel({ trainingId, ziel }: { trainingId: string; ziel: string | null }) {
  const z = useZielSpeichern(trainingId, ziel);
  return <ZielEigenschaft ziel={z.ziel} onSpeichern={z.speichere} />;
}

/** Die Alterskategorien in der Spalte (AK 2). Passen danach Übungen nicht
 *  mehr dazu, nennt die Ansicht sie bloss (PC 3): Entfernt werden sie beim
 *  Zusammenstellen (OOS 2). */
export function AnsichtStufen({
  trainingId,
  altersstufe,
  stufen,
  varianten,
}: {
  trainingId: string;
  altersstufe: Altersstufe;
  stufen: string[];
  varianten: Variante[];
}) {
  const s = useStufenAendern(trainingId, stufen);
  return (
    <StufenEigenschaft
      altersstufe={altersstufe}
      stufen={s.stufen}
      onStufen={s.aendere}
      zusatz={
        <Dialog
          open={s.abweichend != null}
          onClose={() => s.setAbweichend(null)}
          title="Übungen ausserhalb der Stufen"
          actions={
            <Button variant="text" onClick={() => s.setAbweichend(null)}>
              Verstanden
            </Button>
          }
        >
          <p className="mb-3">
            Diese Übungen decken keine der gewählten Stufen ab. Entfernen kannst du sie beim
            Zusammenstellen.
          </p>
          <AbweichendeUebungenListe liste={s.abweichend ?? []} varianten={varianten} />
        </Dialog>
      }
    />
  );
}
