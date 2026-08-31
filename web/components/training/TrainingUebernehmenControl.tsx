"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, UserRound, Users } from "lucide-react";
import { Button, Menu, Snackbar } from "@/components/ui";
import { uebernimmTraining } from "@/lib/actions/team-trainings";
import type { TeamUebersicht } from "@/lib/queries/teams";

/* „Übernehmen" an einem öffentlichen Training (Team-Epic Story 11).
   Ziel ist entweder man selbst oder eines der eigenen Teams. Ohne Team
   erscheint gar kein Menü, sondern direkt der Knopf — eine Auswahl mit nur
   einer Option ist nur ein Klick mehr. */
export function TrainingUebernehmenControl({
  quelleId,
  teams,
}: {
  quelleId: string;
  teams: TeamUebersicht[];
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function uebernehmen(ziel: { art: "persoenlich" } | { art: "team"; teamId: string }, wohin: string) {
    startTransition(async () => {
      const res = await uebernimmTraining(quelleId, ziel);
      setOffen(false);
      if (res.ok && res.trainingId) {
        // PO-Entscheid Übungswelten-Epic: nach der Übernahme direkt zur Kopie —
        // bei Trainings wie bei Übungen.
        router.push(`/training/${res.trainingId}?uebernommen=1`);
      } else if (res.ok) {
        router.refresh();
        setNotice(`Kopie liegt jetzt ${wohin}.`);
      } else {
        setNotice(res.error);
      }
    });
  }

  if (teams.length === 0) {
    return (
      <>
        <Button
          variant="tonal"
          size="sm"
          disabled={pending}
          onClick={() => uebernehmen({ art: "persoenlich" }, "bei dir")}
        >
          <Download size={18} strokeWidth={2} aria-hidden />
          Übernehmen
        </Button>
        <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <Button
          ref={triggerRef}
          variant="tonal"
          size="sm"
          disabled={pending}
          aria-haspopup="menu"
          aria-expanded={offen}
          onClick={() => setOffen((o) => !o)}
        >
          <Download size={18} strokeWidth={2} aria-hidden />
          Übernehmen
        </Button>
        <Menu
          open={offen}
          onClose={() => setOffen(false)}
          triggerRef={triggerRef}
          items={[
            {
              label: "Für mich",
              icon: UserRound,
              onSelect: () => uebernehmen({ art: "persoenlich" }, "bei dir"),
            },
            ...teams.map((t) => ({
              label: `Ins Team ${t.name}`,
              icon: Users,
              onSelect: () => uebernehmen({ art: "team", teamId: t.id }, `im Team „${t.name}"`),
            })),
          ]}
        />
      </div>
      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
