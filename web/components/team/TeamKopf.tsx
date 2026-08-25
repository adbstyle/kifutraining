"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button, Dialog, IconButton, Snackbar, TextField, Tooltip } from "@/components/ui";
import { benenneTeamUm } from "@/lib/actions/teams";

/* Team-Kopf mit Umbenennen (Story 3 AK 5). Jedes Mitglied darf umbenennen —
   im Team sind alle gleichberechtigt. */
export function TeamKopf({ teamId, name }: { teamId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [wert, setWert] = useState(name);
  const [fehler, setFehler] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);

  function speichern() {
    setFehler(undefined);
    startTransition(async () => {
      const res = await benenneTeamUm(teamId, wert);
      if (res.ok) {
        setOpen(false);
        router.refresh();
        setNotice("Teamname geändert.");
      } else {
        setFehler(res.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <h1 className="type-headline-large truncate text-on-surface">{name}</h1>
        {/* `shrink-0` gehört an den Tooltip: er ist das Flex-Kind, nicht der
            Button. Sonst schrumpft der Wrapper neben dem langen, truncateten
            Teamnamen und der Button ragt über dessen Ellipse. */}
        <Tooltip label="Teamnamen bearbeiten" className="shrink-0">
          <IconButton
            icon={Pencil}
            label="Teamnamen bearbeiten"
            size="sm"
            onClick={() => {
              setWert(name);
              setFehler(undefined);
              setOpen(true);
            }}
          />
        </Tooltip>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Team umbenennen"
        actions={
          <>
            <Button variant="text" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={speichern} disabled={pending}>
              Speichern
            </Button>
          </>
        }
      >
        <TextField
          label="Teamname"
          value={wert}
          maxLength={60}
          onChange={(e) => setWert(e.target.value)}
          error={!!fehler}
          supportingText={fehler}
        />
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
