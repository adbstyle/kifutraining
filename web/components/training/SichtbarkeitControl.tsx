"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Undo2 } from "lucide-react";
import { Dialog, Snackbar, Button } from "@/components/ui";
import {
  setzeTrainingAufEntwurf,
  veroeffentlicheTraining,
} from "@/lib/actions/trainings";
import {
  bedingungText,
  type FehlendeBedingung,
} from "@/lib/training-bedingungen";
import type { Variante } from "@/lib/varianten";

/* Sichtbarkeit des eigenen Trainings im Editor-Kopf (Story A).

   Veröffentlichen ist ein Zustand, keine Kopie: derselbe Datensatz wird sichtbar
   und bleibt bearbeitbar. Zwei Zustände, ein Weg hin und zurück — Entwurf
   (Veröffentlichen) und öffentlich (Auf Entwurf setzen). */
export function SichtbarkeitControl({
  trainingId,
  oeffentlich,
  /** Was dem Training zum Veröffentlichen fehlt. Ist etwas offen, erscheint
   *  gar keine Tragweite-Bestätigung, sondern direkt der Hinweis. Die Action
   *  prüft es serverseitig erneut. */
  fehlend = [],
  /** Die Varianten des Hauptteils — nur zum Benennen des Fehlenden (#204
   *  AK 2). Bei genau einer bleibt sie ungenannt: Dann ist «die Variante» kein
   *  Begriff, den der Trainer je gesehen hat (#201 PC 5). */
  varianten = [],
}: {
  trainingId: string;
  oeffentlich: boolean;
  fehlend?: FehlendeBedingung[];
  varianten?: Variante[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [incomplete, setIncomplete] = useState<FehlendeBedingung[] | null>(null);
  const [tragweite, setTragweite] = useState(false);
  const [rueckzug, setRueckzug] = useState(false);

  const mehrereVarianten = varianten.length > 1;
  /** Der Name zur Variante, oder `undefined` wenn es nichts zu unterscheiden
   *  gibt. Eine unbekannte ID (die Variante wurde in einem anderen Fenster
   *  entfernt) bleibt ebenfalls ungenannt — die Bedingung selbst stimmt weiter. */
  function varianteName(id: string | null): string | undefined {
    if (!mehrereVarianten || !id) return undefined;
    return varianten.find((v) => v.id === id)?.name;
  }

  function starten() {
    if (fehlend.length > 0) {
      setIncomplete(fehlend);
      return;
    }
    setTragweite(true);
  }

  function veroeffentlichen() {
    startTransition(async () => {
      const res = await veroeffentlicheTraining(trainingId);
      setTragweite(false);
      router.refresh();
      if (res.status === "published") {
        setNotice("Das Training ist jetzt öffentlich.");
      } else if (res.status === "incomplete") {
        setIncomplete(res.missing);
      } else {
        setNotice(res.error);
      }
    });
  }

  function aufEntwurf() {
    startTransition(async () => {
      const res = await setzeTrainingAufEntwurf(trainingId);
      setRueckzug(false);
      router.refresh();
      setNotice(
        res.ok
          ? "Das Training ist wieder ein Entwurf."
          : (res.error ?? "Fehlgeschlagen."),
      );
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {oeffentlich ? (
          <Button variant="outlined" size="sm" onClick={() => setRueckzug(true)} disabled={pending}>
            <Undo2 size={18} strokeWidth={2} aria-hidden />
            Auf Entwurf setzen
          </Button>
        ) : (
          <Button variant="tonal" size="sm" onClick={starten} disabled={pending}>
            <Globe size={18} strokeWidth={2} aria-hidden />
            Veröffentlichen
          </Button>
        )}
      </div>

      {/* Bedingungen noch nicht erfüllt */}
      <Dialog
        open={incomplete != null}
        onClose={() => setIncomplete(null)}
        title="Noch nicht veröffentlichbar"
        actions={
          <Button variant="filled" onClick={() => setIncomplete(null)}>
            Verstanden
          </Button>
        }
      >
        <p className="mb-3">Zum Veröffentlichen fehlt noch:</p>
        <ul className="flex flex-col gap-1">
          {(incomplete ?? []).map((b) => (
            <li
              key={`${b.bedingung}|${b.varianteId ?? ""}`}
              className="type-body-medium text-on-surface"
            >
              · {bedingungText(b.bedingung, varianteName(b.varianteId))}
            </li>
          ))}
        </ul>
      </Dialog>

      {/* Bestätigung der Tragweite — bei jedem Veröffentlichen (AK 2). */}
      <Dialog
        open={tragweite}
        onClose={() => setTragweite(false)}
        title="Training veröffentlichen?"
        actions={
          <>
            <Button variant="text" onClick={() => setTragweite(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={veroeffentlichen} disabled={pending}>
              Veröffentlichen
            </Button>
          </>
        }
      >
        <p>
          Das Training wird für alle sichtbar — mit allen Inhalten, Bildern und
          Feld-Diagrammen. Dein Anzeigename steht als Urheber daran und ist für
          alle sichtbar.
        </p>
        <p className="mt-3">
          Du kannst es weiter bearbeiten; die Community sieht dann jeweils deinen
          aktuellen Stand. Solange es öffentlich ist, braucht es aber eine
          Alterskategorie sowie je eine Übung in der Einleitung und
          {mehrereVarianten ? " in jeder Variante im freien Spiel" : " im freien Spiel"}.
          Willst du das ändern, setze es zuerst auf Entwurf.
        </p>
      </Dialog>

      {/* Auf Entwurf setzen */}
      <Dialog
        open={rueckzug}
        onClose={() => setRueckzug(false)}
        title="Auf Entwurf setzen?"
        actions={
          <>
            <Button variant="text" onClick={() => setRueckzug(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={aufEntwurf} disabled={pending}>
              Auf Entwurf setzen
            </Button>
          </>
        }
      >
        <p>
          Das Training verschwindet aus dem öffentlichen Bestand und bleibt im
          Übrigen unberührt. Kopien, die andere bereits übernommen haben, bleiben
          bestehen — sie sind eigenständig.
        </p>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
