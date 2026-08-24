"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Button, Dialog, Menu, Snackbar } from "@/components/ui";
import { stelleInsTeam } from "@/lib/actions/team-trainings";
import type { TeamUebersicht } from "@/lib/queries/teams";

/* „Ins Team stellen" am eigenen Training (Story 5 AK 1–4).
   Gestellt wird eine Kopie — das eigene Training bleibt unverändert bestehen.
   Genau das sagt der Bestätigungsdialog, weil „stellen" sonst nach Verschieben
   klingt. */
export function InTeamStellenControl({
  trainingId,
  teams,
}: {
  trainingId: string;
  teams: TeamUebersicht[];
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);
  const [ziel, setZiel] = useState<TeamUebersicht | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Ohne Team gibt es nichts zu stellen — der Weg dorthin führt über /teams.
  if (teams.length === 0) return null;

  function stellen(team: TeamUebersicht) {
    startTransition(async () => {
      const res = await stelleInsTeam(trainingId, team.id);
      setZiel(null);
      if (res.ok) {
        router.refresh();
        setNotice(`Kopie in „${team.name}" gestellt.`);
      } else {
        setNotice(res.error);
      }
    });
  }

  return (
    <>
      <div className="relative">
        <Button
          ref={triggerRef}
          variant="outlined"
          size="sm"
          disabled={pending}
          aria-haspopup="menu"
          aria-expanded={offen}
          onClick={() => setOffen((o) => !o)}
        >
          <Users size={18} strokeWidth={2} aria-hidden />
          Ins Team stellen
        </Button>
        <Menu
          open={offen}
          onClose={() => setOffen(false)}
          triggerRef={triggerRef}
          className="right-0"
          items={teams.map((t) => ({
            label: t.name,
            icon: Users,
            onSelect: () => {
              setOffen(false);
              setZiel(t);
            },
          }))}
        />
      </div>

      <Dialog
        open={ziel != null}
        onClose={() => setZiel(null)}
        title="Kopie ins Team stellen?"
        actions={
          <>
            <Button variant="text" onClick={() => setZiel(null)}>
              Abbrechen
            </Button>
            <Button
              variant="filled"
              onClick={() => ziel && stellen(ziel)}
              disabled={pending}
            >
              Ins Team stellen
            </Button>
          </>
        }
      >
        <p>
          Das Team <strong className="text-on-surface">{ziel?.name}</strong>{" "}
          bekommt eine eigenständige Kopie dieses Trainings. Jedes Mitglied darf
          sie bearbeiten und terminieren.
        </p>
        <p className="mt-3">
          Dein Training bleibt unverändert bei dir — spätere Änderungen wirken
          in keine Richtung.
        </p>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
