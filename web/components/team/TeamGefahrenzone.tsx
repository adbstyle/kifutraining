"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LogOut, Trash2 } from "lucide-react";
import { Banner, Button, Dialog } from "@/components/ui";
import { loeseTeamAuf, verlasseTeam } from "@/lib/actions/teams";

/* Team verlassen und Team auflösen (Story 13).
   Beide Wege enden im selben Zustand, wenn nur noch eine Person da ist —
   darum fängt der Austritt genau diesen Fall ab und fragt stattdessen nach
   der Auflösung, mit dem, was dabei verloren geht.

   Scheitert einer der beiden Wege, bleibt sein Dialog offen und nennt den
   Grund als Banner — dort, wo der Trainer erneut bestätigen oder abbrechen
   kann. Eine Snackbar läge unter dem Dialog (Material, #234). */
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
  const [fehler, setFehler] = useState<string | null>(null);

  const letzte = anzahlMitglieder <= 1;

  function oeffnen(welcher: "verlassen" | "aufloesen") {
    setFehler(null);
    setVerlassenOffen(welcher === "verlassen");
    setAufloesenOffen(welcher === "aufloesen");
  }

  function schliessen() {
    setVerlassenOffen(false);
    setAufloesenOffen(false);
  }

  function verlassen(bestaetigt: boolean) {
    startTransition(async () => {
      const res = await verlasseTeam(teamId, bestaetigt);
      if (res.status === "aufloesung_noetig") {
        // Zwischen Anzeige und Ausführung sind die anderen ausgetreten:
        // nicht still auflösen, sondern die Tragweite zeigen.
        oeffnen("aufloesen");
        return;
      }
      if (res.status === "fehler") {
        setFehler(res.error);
        return;
      }
      router.push("/teams");
    });
  }

  function aufloesen() {
    startTransition(async () => {
      const res = await loeseTeamAuf(teamId);
      if (!res.ok) {
        setFehler(res.error ?? "Fehlgeschlagen.");
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
          onClick={() => oeffnen(letzte ? "aufloesen" : "verlassen")}
        >
          <LogOut size={18} strokeWidth={2} aria-hidden />
          Team verlassen
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => oeffnen("aufloesen")}
        >
          <Trash2 size={18} strokeWidth={2} aria-hidden />
          Team auflösen
        </Button>
      </div>

      <Dialog
        open={verlassenOffen}
        onClose={schliessen}
        title="Team verlassen?"
        actions={
          <>
            <Button variant="text" onClick={schliessen}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={() => verlassen(false)} disabled={pending}>
              Verlassen
            </Button>
          </>
        }
      >
        {fehler && (
          <Banner tone="fehler" className="mb-4">
            {fehler}
          </Banner>
        )}
        <p>
          Du siehst die Trainings und Termine dieses Teams danach nicht mehr.
          Das Team bleibt für die übrigen Mitglieder bestehen. Deine
          persönlichen Trainings — auch Kopien, die du zu dir übernommen hast —
          bleiben unberührt.
        </p>
      </Dialog>

      <Dialog
        open={aufloesenOffen}
        onClose={schliessen}
        title="Team auflösen?"
        actions={
          <>
            <Button variant="text" onClick={schliessen}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={aufloesen} disabled={pending}>
              Endgültig auflösen
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {fehler && <Banner tone="fehler">{fehler}</Banner>}
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
    </>
  );
}
