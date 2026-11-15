"use client";

import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Dialog, NamenBestaetigen, namenStimmen } from "@/components/ui";

/* Der Baustein im Dialog, wie ihn «Team auflösen» braucht: Titel und Folgen
   stehen im Dialog, das Feld im Formular, der danger-Knopf hängt per `form` am
   Formular und ist erst frei, wenn der Name stimmt. */
export function NamenBestaetigenDemo() {
  const [offen, setOffen] = useState(false);
  const [wert, setWert] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [erledigt, setErledigt] = useState(false);
  const formId = useId();
  const name = "Da Junioren";

  function oeffnen() {
    setWert("");
    setFehler(null);
    setErledigt(false);
    setOffen(true);
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="danger" onClick={oeffnen}>
        <Trash2 size={18} strokeWidth={2} aria-hidden />
        Team auflösen…
      </Button>
      {erledigt && <p className="type-body-medium text-on-surface-mittel">Bestätigt - hier würde das Team aufgelöst.</p>}

      <Dialog
        open={offen}
        onClose={() => setOffen(false)}
        title="Team auflösen?"
        actions={
          <>
            <Button variant="outlined" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" form={formId} variant="danger" disabled={!namenStimmen(wert, name)}>
              Team auflösen
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
            if (!namenStimmen(wert, name)) return;
            setOffen(false);
            setErledigt(true);
          }}
        >
          <p>Mit dem Team verschwinden unwiderruflich:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>3 Team-Trainings</li>
            <li>12 Trainingstermine</li>
          </ul>
          <NamenBestaetigen name={name} wert={wert} onChange={setWert} label="Teamname" fehler={fehler} />
          {/* Nur zur Ansicht: so zeigt der Baustein eine Meldung vom Server. */}
          <button
            type="button"
            className="type-label-medium self-start text-primary underline"
            onClick={() => setFehler(fehler ? null : "Das Team heisst inzwischen «Da Junioren B». Gib diesen Namen ein, um fortzufahren.")}
          >
            {fehler ? "Servermeldung ausblenden" : "Servermeldung zeigen"}
          </button>
        </form>
      </Dialog>
    </div>
  );
}
