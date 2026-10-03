"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { benenneTeamUm } from "@/lib/actions/teams";
import { TEAM_NAME_MAX, teamNameProblem } from "@/lib/team";
import { useBlurSpeichern } from "@/lib/use-blur-speichern";

/* Der Teamname als Feld (Story 3 AK 5). Jedes Mitglied darf umbenennen — im
   Team sind alle gleichberechtigt.

   Gespeichert wird beim Verlassen des Felds, ohne Knopf und ohne Bestätigung
   — wie der Trainingsname im Editor. Eine leere Eingabe oder eine, die der
   Server abweist, fällt auf den gespeicherten Namen zurück und meldet sich am
   Bildschirmrand. Den neuen Namen zeigt danach die Brotkrume. */
export function TeamNameFeld({ teamId, name }: { teamId: string; name: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const melde = useSnackbar();
  const { entwurf, setEntwurf, beiVerlassen } = useBlurSpeichern({
    wert: name,
    pruefe: teamNameProblem,
    speichere: (naechster) =>
      startTransition(async () => {
        const res = await benenneTeamUm(teamId, naechster);
        if (!res.ok) {
          setEntwurf(name);
          melde(res.error ?? "Speichern fehlgeschlagen.");
          return;
        }
        router.refresh();
      }),
    onFehler: melde,
  });

  return (
    <TextField
      label="Teamname"
      maxLength={TEAM_NAME_MAX}
      value={entwurf}
      onChange={(e) => setEntwurf(e.target.value)}
      onBlur={beiVerlassen}
    />
  );
}
