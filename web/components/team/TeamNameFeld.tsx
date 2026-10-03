"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { benenneTeamUm } from "@/lib/actions/teams";
import { TEAM_NAME_MAX, teamNameProblem } from "@/lib/team";
import { useBlurSpeichern } from "@/lib/use-blur-speichern";

/* Der Teamname als Feld (Story 3 AK 5). Jedes Mitglied darf umbenennen — im
   Team sind alle gleichberechtigt.

   Gespeichert wird beim Verlassen des Felds, ohne Knopf und ohne Rückfrage
   — wie der Trainingsname im Editor. Eine leere Eingabe oder eine, die der
   Server abweist, fällt auf den gespeicherten Namen zurück und meldet sich am
   Bildschirmrand; ein gelungenes Speichern ebenfalls, denn ausser der
   Brotkrume ändert sich auf der Seite sonst nichts.

   Der Name gilt sofort (`gilt`), nicht erst, wenn frische Serverdaten da
   sind: Sonst wäre bis dahin der alte Name der Vergleichswert, und wer ihn in
   dieser Lücke wieder eintippt, speicherte nichts. */
export function TeamNameFeld({ teamId, name }: { teamId: string; name: string }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [gilt, setGilt] = useState(name);
  const [gesehen, setGesehen] = useState(name);
  if (name !== gesehen) {
    // Frische Serverdaten — etwa nach einer Umbenennung durch ein anderes
    // Mitglied — lösen den eigenen Stand ab.
    setGesehen(name);
    setGilt(name);
  }

  async function speichere(naechster: string) {
    const vorher = gilt;
    setGilt(naechster);
    const res = await benenneTeamUm(teamId, naechster);
    if (!res.ok) {
      setGilt(vorher);
      melde(res.error ?? "Speichern fehlgeschlagen.");
      return;
    }
    melde("Teamname gespeichert.");
    router.refresh();
  }

  const { entwurf, setEntwurf, beiVerlassen } = useBlurSpeichern({
    wert: gilt,
    pruefe: teamNameProblem,
    speichere: (naechster) => void speichere(naechster),
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
