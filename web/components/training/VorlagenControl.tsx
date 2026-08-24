"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, RefreshCw, Undo2 } from "lucide-react";
import { Dialog, Snackbar, Button } from "@/components/ui";
import { veroeffentlicheTraining, zieheVorlageZurueck } from "@/lib/actions/trainings";

const MISSING_LABEL: Record<string, string> = {
  stufe: "mindestens eine Stufe",
  einleitung: "mindestens eine Übung in der Einleitung",
  hauptteil: "mindestens eine Übung im Hauptteil",
};

/* Vorlagen-Steuerung im Editor-Kopf (Team-Epic Story 14).
   Veröffentlicht wird nie das Training selbst, sondern eine eingefrorene Kopie:
   das eigene Training bleibt privat und bearbeitbar. Zwei Zustände — noch keine
   Vorlage (Veröffentlichen) bzw. Vorlage aktiv (Erneut veröffentlichen, das die
   bisherige ersetzt, oder Zurückziehen). */
export function VorlagenControl({
  trainingId,
  /** Die aktive Vorlage dieses Trainings, falls es eine gibt. */
  vorlageId,
  /** Erfüllt das Training die Voraussetzungen? Ist es unvollständig, erscheint
   *  gar keine Tragweite-Bestätigung, sondern direkt der Hinweis, was fehlt.
   *  Die Action prüft es serverseitig erneut. */
  fehlend = [],
}: {
  trainingId: string;
  vorlageId: string | null;
  fehlend?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [incomplete, setIncomplete] = useState<string[] | null>(null);
  const [tragweite, setTragweite] = useState(false);
  const [rueckzug, setRueckzug] = useState(false);

  const aktiv = vorlageId != null;

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
      if (res.status === "published") {
        router.refresh();
        setNotice(
          aktiv
            ? "Die Vorlage wurde durch den aktuellen Stand ersetzt."
            : "Das Training ist jetzt als Vorlage öffentlich.",
        );
      } else if (res.status === "incomplete") {
        setIncomplete(res.missing);
      } else {
        setNotice(res.error);
      }
    });
  }

  function zurueckziehen() {
    startTransition(async () => {
      const res = await zieheVorlageZurueck(trainingId);
      setRueckzug(false);
      router.refresh();
      setNotice(res.ok ? "Die Vorlage wurde zurückgezogen." : (res.error ?? "Fehlgeschlagen."));
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant={aktiv ? "outlined" : "tonal"} size="sm" onClick={starten} disabled={pending}>
          {aktiv ? (
            <RefreshCw size={18} strokeWidth={2} aria-hidden />
          ) : (
            <Globe size={18} strokeWidth={2} aria-hidden />
          )}
          {aktiv ? "Erneut veröffentlichen" : "Veröffentlichen"}
        </Button>
        {aktiv && (
          <Button variant="text" size="sm" onClick={() => setRueckzug(true)} disabled={pending}>
            <Undo2 size={18} strokeWidth={2} aria-hidden />
            Zurückziehen
          </Button>
        )}
      </div>

      {/* Voraussetzungen fehlen */}
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
          {(incomplete ?? []).map((m) => (
            <li key={m} className="type-body-medium text-on-surface">
              · {MISSING_LABEL[m] ?? m}
            </li>
          ))}
        </ul>
      </Dialog>

      {/* Bestätigung der Tragweite — bei jedem Veröffentlichungsvorgang. */}
      <Dialog
        open={tragweite}
        onClose={() => setTragweite(false)}
        title={aktiv ? "Vorlage ersetzen?" : "Als Vorlage veröffentlichen?"}
        actions={
          <>
            <Button variant="text" onClick={() => setTragweite(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={veroeffentlichen} disabled={pending}>
              {aktiv ? "Ersetzen" : "Veröffentlichen"}
            </Button>
          </>
        }
      >
        <p>
          Es entsteht eine öffentliche Kopie dieses Trainings — mit allen
          Inhalten, Bildern und Feld-Diagrammen. Dein Anzeigename steht als
          Urheber daran und ist für alle sichtbar.
        </p>
        <p className="mt-3">
          Dein Training bleibt privat und bearbeitbar. Die Vorlage selbst lässt
          sich nicht mehr ändern — du kannst sie nur ersetzen oder zurückziehen.
          {aktiv && " Die bisherige Vorlage wird dabei entfernt."}
        </p>
      </Dialog>

      {/* Zurückziehen */}
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
          Die Vorlage verschwindet aus der Öffentlichkeit. Dein Training bleibt
          unberührt. Kopien, die andere bereits übernommen haben, bleiben
          bestehen — sie sind eigenständig.
        </p>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
