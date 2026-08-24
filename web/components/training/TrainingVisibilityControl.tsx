"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Lock } from "lucide-react";
import { Dialog, Snackbar, Button } from "@/components/ui";
import { publishTrainingAction, unpublishTrainingAction } from "@/lib/actions/trainings";

const MISSING_LABEL: Record<string, string> = {
  stufe: "mindestens eine Stufe",
  einleitung: "mindestens eine Übung in der Einleitung",
  hauptteil: "mindestens eine Übung im Hauptteil",
};

/* Sichtbarkeits-Steuerung im Editor-Kopf (Story #14, Epic #72 Story 8).
   Privat → Öffentlich mit einer einzigen Bestätigung der Tragweite; die frühere
   Rückfrage zur Mitveröffentlichung einzelner Übungen ist entfallen, weil ein
   Training nur noch eigenständige Fassungen enthält. Öffentlich → Privat. */
export function TrainingVisibilityControl({
  trainingId,
  visibility,
  /** Erfüllt das Training die Voraussetzungen? Ist es unvollständig, erscheint
   *  gar keine Tragweite-Bestätigung, sondern direkt der Hinweis, was fehlt
   *  (Story 8 AK 3). Die RPC prüft es serverseitig erneut. */
  fehlend = [],
}: {
  trainingId: string;
  visibility: "public" | "private";
  fehlend?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [incomplete, setIncomplete] = useState<string[] | null>(null);
  const [tragweite, setTragweite] = useState(false);

  function starten() {
    if (fehlend.length > 0) {
      setIncomplete(fehlend);
      return;
    }
    setTragweite(true);
  }

  function publish() {
    startTransition(async () => {
      const res = await publishTrainingAction(trainingId);
      setTragweite(false);
      if (res.status === "published") {
        router.refresh();
        setNotice("Das Training ist jetzt öffentlich.");
      } else if (res.status === "incomplete") {
        setIncomplete(res.missing);
      } else {
        setNotice(res.error);
      }
    });
  }

  function unpublish() {
    startTransition(async () => {
      const res = await unpublishTrainingAction(trainingId);
      router.refresh();
      setNotice(res.ok ? "Das Training ist jetzt privat." : (res.error ?? "Fehlgeschlagen."));
    });
  }

  return (
    <>
      {visibility === "private" ? (
        <Button variant="tonal" size="sm" onClick={starten} disabled={pending}>
          <Globe size={18} strokeWidth={2} aria-hidden />
          Öffentlich schalten
        </Button>
      ) : (
        <Button variant="outlined" size="sm" onClick={unpublish} disabled={pending}>
          <Lock size={18} strokeWidth={2} aria-hidden />
          Privat schalten
        </Button>
      )}

      {/* Voraussetzungen fehlen */}
      <Dialog
        open={incomplete != null}
        onClose={() => setIncomplete(null)}
        title="Noch nicht öffentlich möglich"
        actions={
          <Button variant="filled" onClick={() => setIncomplete(null)}>
            Verstanden
          </Button>
        }
      >
        <p className="mb-3">Zum Öffentlich-Schalten fehlt noch:</p>
        <ul className="flex flex-col gap-1">
          {(incomplete ?? []).map((m) => (
            <li key={m} className="type-body-medium text-on-surface">
              · {MISSING_LABEL[m] ?? m}
            </li>
          ))}
        </ul>
      </Dialog>

      {/* Einmalige Bestätigung der Tragweite (Story 8 AK 1/2) — bei jedem
          Veröffentlichungsvorgang, auch beim erneuten nach einem Rückzug. */}
      <Dialog
        open={tragweite}
        onClose={() => setTragweite(false)}
        title="Training öffentlich schalten?"
        actions={
          <>
            <Button variant="text" onClick={() => setTragweite(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={publish} disabled={pending}>
              Öffentlich schalten
            </Button>
          </>
        }
      >
        <p>
          Alle Inhalte dieses Trainings werden öffentlich sichtbar —
          einschliesslich der Bilder und Feld-Diagramme. Deine Übungen in der
          Bibliothek bleiben davon unberührt.
        </p>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
