"use client";

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button, Dialog, IconButton, Tooltip } from "@/components/ui";
import { UebungImTraining } from "./UebungImTraining";
import { FassungInSpalte } from "./FassungInSpalte";
import type { OffeneUebung } from "./useOffeneUebung";
import type { Altersstufe } from "@/lib/altersstufe";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

/**
 * Was in der Spalte neben den Übungen eines Trainings steht (Epic #369) —
 * beim Zusammenstellen wie in der Ansicht: die geöffnete Übung zum Bearbeiten
 * (#372/#374) oder zum Ansehen (#371), sonst die Eigenschaften des Trainings
 * (#370).
 *
 * `offen`: die geöffnete Übung, wie die Seite sie gerade zeigt — `undefined`,
 * wenn keine offen ist oder die geöffnete nicht mehr angezeigt wird.
 * `durchlauf`: die Gruppen in Wechselreihenfolge; beim Zusammenstellen der
 * laufende, noch ungesicherte Stand (#371 PC 1).
 * `variante`: die angezeigte Variante — Ziel einer Übung, die beim Sichern
 * von ausserhalb in den Hauptteil wandert.
 * `aktionen`: was im Detail zusätzlich neben Bearbeiten und Schliessen steht.
 */
export function OffeneUebungSpalte({
  steuerung,
  offen,
  altersstufe,
  variante,
  durchlauf,
  aktionen,
  eigenschaften,
}: {
  steuerung: OffeneUebung;
  offen: TrainingExerciseItem | undefined;
  altersstufe: Altersstufe;
  variante: string | undefined;
  durchlauf: readonly { id: string; name: string }[];
  aktionen?: ReactNode;
  eigenschaften: ReactNode;
}) {
  if (!offen) return eigenschaften;

  if (steuerung.bearbeiten)
    return (
      <FassungInSpalte
        key={offen.id}
        item={offen}
        altersstufe={altersstufe}
        variante={variante}
        onUngesichert={steuerung.setUngesichert}
        onGesichert={steuerung.gesichert}
        onVerwerfen={() => steuerung.zeige(offen.id)}
        onSchliessen={steuerung.schliesse}
      />
    );

  return (
    <UebungImTraining
      item={offen}
      altersstufe={altersstufe}
      dauer={offen.durationMin}
      notiz={offen.notiz}
      durchlauf={durchlauf}
      aktionen={
        <>
          {aktionen}
          {steuerung.bearbeitbar && (
            <Tooltip label="Übung bearbeiten">
              <IconButton
                icon={Pencil}
                label={`${offen.name} bearbeiten`}
                onClick={() => steuerung.oeffne(offen.id, true)}
              />
            </Tooltip>
          )}
        </>
      }
      onSchliessen={steuerung.schliesse}
    />
  );
}

/** Die Rückfrage, bevor ein Vorgang ungesicherte Änderungen an der geöffneten
 *  Übung verlässt (#372 AK 4, #374 AK 5) — derselbe Wortlaut wie in der Maske:
 *  weiter bearbeiten oder verwerfen. */
export function VerwerfenRueckfrage({
  steuerung,
  name,
}: {
  steuerung: OffeneUebung;
  /** Der Name der geöffneten Übung. */
  name: string | undefined;
}) {
  return (
    <Dialog
      open={steuerung.rueckfrage.offen}
      onClose={steuerung.rueckfrage.bleiben}
      title="Änderungen verwerfen?"
      actions={
        <>
          <Button variant="text" onClick={steuerung.rueckfrage.bleiben}>
            Weiter bearbeiten
          </Button>
          <Button variant="danger" onClick={steuerung.rueckfrage.verwerfen}>
            Verwerfen
          </Button>
        </>
      }
    >
      <p>
        Deine Änderungen an „{name ?? "der Übung"}" sind noch nicht gesichert. Wenn du
        weitermachst, gehen sie verloren.
      </p>
    </Dialog>
  );
}
