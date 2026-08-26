"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Button, Dialog, Snackbar } from "@/components/ui";
import { zieheEigeneVorlageZurueck } from "@/lib/actions/trainings";

/* „Zurückziehen" direkt an der öffentlichen Vorlage.

   Der reguläre Weg führt über den Editor des privaten Originals
   (`VorlagenControl`). Vorlagen ohne verlinktes Original — Alt-Bestand aus der
   Zeit vor dem Kopie-Modell und verwaiste Kopien — haben diesen Weg nicht: sie
   erscheinen in keiner eigenen Liste und sind eingefroren. Hier steht deshalb
   der einzige Knopf, der sie noch erreicht.

   Nach dem Rückzug gibt es die Seite, auf der dieser Knopf steht, nicht mehr —
   darum zurück in die Übersicht statt `router.refresh()`. */
export function VorlageZurueckziehenButton({ vorlageId }: { vorlageId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rueckzug, setRueckzug] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function zurueckziehen() {
    startTransition(async () => {
      const res = await zieheEigeneVorlageZurueck(vorlageId);
      setRueckzug(false);
      if (res.ok) {
        router.push("/trainings");
      } else {
        setNotice(res.error ?? "Fehlgeschlagen.");
      }
    });
  }

  return (
    <>
      <Button variant="text" size="sm" onClick={() => setRueckzug(true)} disabled={pending}>
        <Undo2 size={18} strokeWidth={2} aria-hidden />
        Zurückziehen
      </Button>

      <Dialog
        open={rueckzug}
        onClose={() => setRueckzug(false)}
        title="Vorlage zurückziehen?"
        actions={
          <>
            <Button variant="text" onClick={() => setRueckzug(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={zurueckziehen} disabled={pending}>
              Zurückziehen
            </Button>
          </>
        }
      >
        <p>
          Die Vorlage verschwindet aus der Öffentlichkeit und wird gelöscht.
          Kopien, die andere bereits übernommen haben, bleiben bestehen — sie
          sind eigenständig.
        </p>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
