"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { NameFeld, TrainingStufenFeld, ZielFeld } from "./editor/TrainingKopf";
import { renameTraining, setTrainingStufen, setTrainingZiel } from "@/lib/actions/trainings";
import type { Altersstufe } from "@/lib/altersstufe";
import type { Variante } from "@/lib/varianten";

/* Name, Ziel und Alterskategorien in der Ansicht eines Trainings ändern
   (Epic #369, Story #375) — für alle, die das Training bearbeiten dürfen. Es
   sind dieselben Felder wie beim Zusammenstellen, und sie speichern wie dort
   je Angabe beim Verlassen bzw. bei der Wahl, ohne das Training als Ganzes zu
   sichern (PC 1). Scheitert eine Änderung, springt das Feld zurück und die
   Snackbar sagt, warum (PC 2). Danach frischt die Seite auf: Lesende sehen
   den neuen Stand (PC 4). */

/** Der Name als Überschrift-Feld — anstelle der Überschrift (AK 1). */
export function AnsichtName({ trainingId, name }: { trainingId: string; name: string }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [, startTransition] = useTransition();
  // Lokal über dem Serverstand, bis das Auffrischen zurück ist — sonst stünde
  // kurz wieder der alte Name im Feld.
  const [wert, setWert] = useState(name);

  return (
    <NameFeld
      name={wert}
      onSpeichern={(naechster) => {
        const vorher = wert;
        setWert(naechster);
        startTransition(async () => {
          const r = await renameTraining(trainingId, naechster);
          if (!r.ok) {
            setWert(vorher);
            melde(r.error ?? "Speichern fehlgeschlagen.");
            return;
          }
          router.refresh();
        });
      }}
    />
  );
}

/** Das Ziel in der Spalte (AK 2). */
export function AnsichtZiel({ trainingId, ziel }: { trainingId: string; ziel: string | null }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [, startTransition] = useTransition();
  const [wert, setWert] = useState(ziel ?? "");

  return (
    <ZielFeld
      ziel={wert}
      onChange={setWert}
      onSpeichern={() => {
        if (wert.trim() === (ziel ?? "")) return;
        startTransition(async () => {
          const r = await setTrainingZiel(trainingId, wert);
          if (!r.ok) {
            setWert(ziel ?? "");
            melde(r.error ?? "Speichern fehlgeschlagen.");
            return;
          }
          router.refresh();
        });
      }}
    />
  );
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
  const router = useRouter();
  const melde = useSnackbar();
  const [, startTransition] = useTransition();
  const [wert, setWert] = useState(stufen);
  const [abweichend, setAbweichend] = useState<
    { id: string; name: string; varianteId: string | null }[] | null
  >(null);

  function aendere(naechste: string[]) {
    const vorher = wert;
    setWert(naechste);
    startTransition(async () => {
      const r = await setTrainingStufen(trainingId, naechste);
      router.refresh();
      if (!r.ok) {
        setWert(vorher);
        melde(r.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      if (r.mismatched && r.mismatched.length > 0) setAbweichend(r.mismatched);
    });
  }

  return (
    <>
      <TrainingStufenFeld altersstufe={altersstufe} stufen={wert} onStufen={aendere} />
      <Dialog
        open={abweichend != null}
        onClose={() => setAbweichend(null)}
        title="Übungen ausserhalb der Stufen"
        actions={
          <Button variant="text" onClick={() => setAbweichend(null)}>
            Verstanden
          </Button>
        }
      >
        <p className="mb-3">
          Diese Übungen decken keine der gewählten Stufen ab. Entfernen kannst du sie beim
          Zusammenstellen.
        </p>
        {/* Wie beim Zusammenstellen: Bei mehreren Varianten trägt jede
            Hauptteil-Übung ihre Variante (#201 AK 11). */}
        <ul className="flex flex-col gap-1">
          {(abweichend ?? []).map((m) => {
            const variante =
              varianten.length > 1 ? varianten.find((v) => v.id === m.varianteId)?.name : undefined;
            return (
              <li key={m.id} className="type-body-medium text-on-surface">
                · {m.name}
                {variante && (
                  <span className="text-on-surface-mittel"> (Variante „{variante}")</span>
                )}
              </li>
            );
          })}
        </ul>
      </Dialog>
    </>
  );
}
