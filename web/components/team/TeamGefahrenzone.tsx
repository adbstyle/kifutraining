"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LogOut, Trash2 } from "lucide-react";
import { Button, Dialog, Snackbar } from "@/components/ui";
import { loeseTeamAuf, verlasseTeam } from "@/lib/actions/teams";

/* Team verlassen und Team auflösen (Story 13).
   Beide Wege enden im selben Zustand, wenn nur noch eine Person da ist —
   darum fängt der Austritt genau diesen Fall ab und fragt stattdessen nach
   der Auflösung, mit dem, was dabei verloren geht. */
export function TeamGefahrenzone({
  teamId,
  anzahlMitglieder,
  anzahlTrainings,
  anzahlTermine,
}: {
  teamId: string;
  anzahlMitglieder: number;
  anzahlTrainings: number;
  anzahlTermine: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [verlassenOffen, setVerlassenOffen] = useState(false);
  const [aufloesenOffen, setAufloesenOffen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const letzte = anzahlMitglieder <= 1;

  function verlassen(bestaetigt: boolean) {
    startTransition(async () => {
      const res = await verlasseTeam(teamId, bestaetigt);
      if (res.status === "aufloesung_noetig") {
        // Zwischen Anzeige und Ausführung sind die anderen ausgetreten:
        // nicht still auflösen, sondern die Tragweite zeigen.
        setVerlassenOffen(false);
        setAufloesenOffen(true);
        return;
      }
      if (res.status === "fehler") {
        setNotice(res.error);
        return;
      }
      router.push("/teams");
    });
  }

  function aufloesen() {
    startTransition(async () => {
      const res = await loeseTeamAuf(teamId);
      if (!res.ok) {
        setNotice(res.error ?? "Fehlgeschlagen.");
        return;
      }
      router.push("/teams");
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outlined"
          size="sm"
          disabled={pending}
          onClick={() => (letzte ? setAufloesenOffen(true) : setVerlassenOffen(true))}
        >
          <LogOut size={18} strokeWidth={2} aria-hidden />
          Team verlassen
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => setAufloesenOffen(true)}
        >
          <Trash2 size={18} strokeWidth={2} aria-hidden />
          Team auflösen
        </Button>
      </div>

      <Dialog
        open={verlassenOffen}
        onClose={() => setVerlassenOffen(false)}
        title="Team verlassen?"
        actions={
          <>
            <Button variant="text" onClick={() => setVerlassenOffen(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={() => verlassen(false)} disabled={pending}>
              Verlassen
            </Button>
          </>
        }
      >
        <p>
          Du siehst die Trainings und Termine dieses Teams danach nicht mehr.
          Das Team bleibt für die übrigen Mitglieder bestehen. Deine
          persönlichen Trainings — auch Kopien, die du zu dir übernommen hast —
          bleiben unberührt.
        </p>
      </Dialog>

      <Dialog
        open={aufloesenOffen}
        onClose={() => setAufloesenOffen(false)}
        title="Team auflösen?"
        actions={
          <>
            <Button variant="text" onClick={() => setAufloesenOffen(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={aufloesen} disabled={pending}>
              Endgültig auflösen
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2">
            <AlertTriangle
              size={18}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-error"
              aria-hidden
            />
            <span>
              {letzte
                ? "Du bist das letzte Mitglied — mit deinem Austritt löst sich das Team auf. Diese Aktion kann nicht rückgängig gemacht werden."
                : "Diese Aktion kann nicht rückgängig gemacht werden."}
            </span>
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {anzahlTrainings}{" "}
              {anzahlTrainings === 1 ? "Team-Training wird" : "Team-Trainings werden"} gelöscht.
            </li>
            <li>
              {anzahlTermine} {anzahlTermine === 1 ? "Termin entfällt" : "Termine entfallen"}.
            </li>
            <li>
              Persönliche Trainings der Mitglieder bleiben erhalten — auch
              Kopien aus diesem Team.
            </li>
          </ul>
        </div>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
