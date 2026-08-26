"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Dialog, TextField } from "@/components/ui";
import { erstelleTeam } from "@/lib/actions/teams";

/* Neues Team anlegen (Story 3 AK 1–3). Gefragt wird nur der Name — wer anlegt,
   ist sofort Mitglied; Mitglieder kommen anschliessend im Team dazu. */
export function TeamErstellenButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | undefined>();

  function anlegen() {
    setFehler(undefined);
    startTransition(async () => {
      const res = await erstelleTeam(name);
      if (res.ok) {
        setOpen(false);
        setName("");
        router.push(`/team/${res.teamId}`);
      } else {
        setFehler(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="filled" className="shrink-0" onClick={() => setOpen(true)}>
        <Plus size={20} strokeWidth={2.5} aria-hidden />
        Neues Team
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Neues Team"
        actions={
          <>
            <Button variant="text" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={anlegen} disabled={pending}>
              Team anlegen
            </Button>
          </>
        }
      >
        <p className="mb-4">
          Gib dem Team einen Namen — zum Beispiel den der Mannschaft. Du bist
          sofort Mitglied und kannst weitere Trainer:innen dazunehmen.
        </p>
        <TextField
          label="Teamname"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          error={!!fehler}
          supportingText={fehler}
        />
      </Dialog>
    </>
  );
}
