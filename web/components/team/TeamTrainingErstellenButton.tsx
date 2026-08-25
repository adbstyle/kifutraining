"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button, Dialog, TextField } from "@/components/ui";
import { erstelleTeamTraining } from "@/lib/actions/team-trainings";

/* Ein Training direkt im Team anlegen (Story 5 AK 5). Es gehört von Anfang an
   dem Team — niemand muss es erst „stellen". */
export function TeamTrainingErstellenButton({ teamId }: { teamId: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | undefined>();

  function anlegen() {
    if (!name.trim()) {
      setFehler("Bitte einen Namen angeben.");
      return;
    }
    setFehler(undefined);
    startTransition(async () => {
      // Leitet bei Erfolg in den Editor weiter; nur ein Fehlschlag kehrt zurück.
      const res = await erstelleTeamTraining(teamId, name);
      if (res && !res.ok) setFehler(res.error);
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
        <p className="mb-4">
          Das Training gehört dem Team — jedes Mitglied darf es bearbeiten.
        </p>
        <TextField
          label="Name des Trainings"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={!!fehler}
          supportingText={fehler}
        />
      </Dialog>
    </>
  );
}
