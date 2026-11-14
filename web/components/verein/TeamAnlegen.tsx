"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Dialog, SectionMessage, TextField } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { legeTeamAnAktion } from "@/lib/actions/verein";
import { teamNameProblem } from "@/lib/team";
import { VEREIN_MELDUNG, VEREIN_TEAMS_MAX } from "@/lib/verein";

/* «Team anlegen» auf der Übersicht des Vereins (Epic Vereine #575, Story
   #581 AK 17, 18, 20, 21): ein Knopf mit Dialog, nur für die Vereinsverwaltung.
   Die Verwaltung wird beim Anlegen nicht Trainer:in — Trainer:innen, auch sie
   selbst, nimmt sie danach im Team auf.

   Bei `VEREIN_TEAMS_MAX` Teams ist der Knopf gesperrt; der Satz dazu steht
   sichtbar daneben, nicht im Tooltip eines gesperrten Knopfs (der reagiert nicht
   auf Zeiger). Das Rennen deckt die Datenebene mit dem Marker. Ein vergebener
   Name wird am Feld abgewiesen und nennt das Team, das ihn trägt. */
export function TeamAnlegen({ vereinId, anzahlTeams }: { vereinId: string; anzahlTeams: number }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<{ feld: boolean; text: string } | null>(null);
  const formId = useId();
  const voll = anzahlTeams >= VEREIN_TEAMS_MAX;
  // Nie eine negative Restzahl, auch wenn der Verein über der Grenze steht (PC 7).
  const rest = Math.max(0, VEREIN_TEAMS_MAX - anzahlTeams);

  function oeffnen() {
    setName("");
    setFehler(null);
    setOffen(true);
  }

  function schliessen() {
    if (!pending) setOffen(false);
  }

  function anlegen() {
    const problem = teamNameProblem(name);
    if (problem) return setFehler({ feld: true, text: problem });
    setFehler(null);
    startTransition(async () => {
      const r = await legeTeamAnAktion(vereinId, name);
      if (!r.ok) return setFehler({ feld: r.feld === "name", text: r.error });
      setOffen(false);
      router.refresh();
      melde(`Das Team ${r.name} ist angelegt.`);
    });
  }

  return (
    <>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button variant="filled" disabled={voll} aria-describedby={voll ? "teams-voll" : undefined} aria-haspopup="dialog" onClick={oeffnen}>
          <Plus size={18} strokeWidth={2} aria-hidden />
          Team anlegen
        </Button>
        {voll && (
          <p id="teams-voll" className="type-body-small max-w-xs text-on-surface-mittel sm:text-right">
            {VEREIN_MELDUNG.VEREIN_TEAMS_VOLL}
          </p>
        )}
      </div>

      <Dialog
        open={offen}
        onClose={schliessen}
        title="Team anlegen"
        actions={
          <>
            <Button type="button" variant="outlined" onClick={schliessen} disabled={pending}>
              Abbrechen
            </Button>
            <Button type="submit" form={formId} variant="filled" disabled={pending}>
              Team anlegen
            </Button>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            anlegen();
          }}
        >
          {fehler && !fehler.feld && <SectionMessage appearance="error">{fehler.text}</SectionMessage>}
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            autoFocus
            error={!!fehler?.feld}
            supportingText={fehler?.feld ? fehler.text : "Im Verein eindeutig"}
          />
          <p className="type-body-small text-on-surface-mittel">
            Du wirst dabei nicht Trainer:in. Trainer:innen, auch dich selbst, nimmst du danach im Team auf.{" "}
            {rest === 1 ? "Noch 1 Team möglich." : `Noch ${rest} Teams möglich.`}
          </p>
        </form>
      </Dialog>
    </>
  );
}
