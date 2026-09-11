"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { AltersstufeField, Button, Dialog, TextField } from "@/components/ui";
import { StufenField } from "@/components/training/StufenField";
import { kategorienFuer, type Altersstufe } from "@/lib/altersstufe";
import { erstelleTeamTraining } from "@/lib/actions/team-trainings";

/* Ein Training direkt im Team anlegen (Story 5 AK 5). Es gehört von Anfang an
   dem Team — niemand muss es erst „stellen".

   Dieselben Pflichtangaben wie beim persönlichen Anlegen (Story 5 AK 1/2,
   Übungswelten): Die Altersstufe wird hier gewählt — bewusst ohne Vorbelegung,
   weil sie lebenslang bindet — und dazu mindestens eine Alterskategorie ihrer
   Stufe. */
export function TeamTrainingErstellenButton({ teamId }: { teamId: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [altersstufe, setAltersstufe] = useState<Altersstufe | null>(null);
  const [stufen, setStufen] = useState<string[]>([]);
  const [fehler, setFehler] = useState<{
    name?: string;
    altersstufe?: string;
    stufen?: string;
  }>({});

  function waehleAltersstufe(next: Altersstufe) {
    setAltersstufe(next);
    setStufen([]);
    setFehler({});
  }

  function anlegen() {
    if (!name.trim()) {
      setFehler({ name: "Bitte einen Namen angeben." });
      return;
    }
    if (!altersstufe) {
      setFehler({ altersstufe: "Bitte die Altersstufe wählen." });
      return;
    }
    if (stufen.length === 0) {
      setFehler({ stufen: "Bitte mindestens eine Alterskategorie wählen." });
      return;
    }
    setFehler({});
    startTransition(async () => {
      // Leitet bei Erfolg in den Editor weiter; nur ein Fehlschlag kehrt zurück.
      const res = await erstelleTeamTraining(teamId, name, altersstufe, stufen);
      if (res && !res.ok) setFehler({ name: res.error });
    });
  }

  return (
    <>
      <Button variant="tonal" size="sm" onClick={() => setOpen(true)}>
        <Plus size={18} strokeWidth={2.5} aria-hidden />
        Training erstellen
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Training im Team erstellen"
        actions={
          <>
            <Button variant="text" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={anlegen} disabled={pending}>
              Erstellen
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <p>Das Training gehört dem Team — jedes Mitglied darf es bearbeiten.</p>
          <TextField
            label="Name des Trainings"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!fehler.name}
            supportingText={fehler.name}
          />

          <AltersstufeField
            wert={altersstufe}
            onChange={waehleAltersstufe}
            hinweis="Nach welchem Manual das Team plant. Bestimmt Trainingsteile, Gliederung und Alterskategorien — und steht danach fest."
            fehler={fehler.altersstufe}
          />

          <div>
            <p className="mb-2 type-label-large text-on-surface">Alterskategorien</p>
            <p className="mb-3 type-body-small text-on-surface-mittel">
              {altersstufe
                ? "Mindestens eine ist nötig; ihr könnt die Auswahl später jederzeit ändern."
                : "Wähle zuerst die Altersstufe — sie bestimmt, welche Alterskategorien es hier gibt."}
            </p>
            {altersstufe && (
              <StufenField
                value={stufen}
                onChange={setStufen}
                kategorien={kategorienFuer(altersstufe)}
              />
            )}
            {fehler.stufen && (
              <p className="mt-2 type-body-small text-error">{fehler.stufen}</p>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
