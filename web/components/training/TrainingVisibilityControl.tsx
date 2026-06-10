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

/* Sichtbarkeits-Steuerung im Editor-Kopf (Story #14). Privat → Öffentlich
   schalten (mit Vollständigkeitsprüfung und Mitveröffentlichungs-Rückfrage für
   eigene private Übungen); Öffentlich → Privat. */
export function TrainingVisibilityControl({
  trainingId,
  visibility,
}: {
  trainingId: string;
  visibility: "public" | "private";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [incomplete, setIncomplete] = useState<string[] | null>(null);
  const [confirm, setConfirm] = useState<{ count: number; names: string[] } | null>(null);

  function publish(includePrivate: boolean) {
    startTransition(async () => {
      const res = await publishTrainingAction(trainingId, includePrivate);
      if (res.status === "published") {
        setConfirm(null);
        router.refresh();
        setNotice("Das Training ist jetzt öffentlich.");
      } else if (res.status === "incomplete") {
        setIncomplete(res.missing);
      } else if (res.status === "needs_confirmation") {
        setConfirm({ count: res.count, names: res.names });
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
        <Button variant="tonal" size="sm" onClick={() => publish(false)} disabled={pending}>
          <Globe size={18} strokeWidth={2} aria-hidden />
          Öffentlich schalten
        </Button>
      ) : (
        <Button variant="outlined" size="sm" onClick={unpublish} disabled={pending}>
          <Lock size={18} strokeWidth={2} aria-hidden />
          Privat schalten
        </Button>
      )}

      {/* Voraussetzungen fehlen (AC4) */}
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

      {/* Mitveröffentlichungs-Rückfrage (AC5/AC6/AC7) */}
      <Dialog
        open={confirm != null}
        onClose={() => setConfirm(null)}
        title="Eigene private Übungen mitveröffentlichen?"
        actions={
          <>
            <Button variant="text" onClick={() => setConfirm(null)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={() => publish(true)} disabled={pending}>
              Mitveröffentlichen & teilen
            </Button>
          </>
        }
      >
        <p className="mb-3">
          Dieses Training enthält {confirm?.count}{" "}
          {confirm?.count === 1 ? "eigene private Übung" : "eigene private Übungen"}.
          Beim Öffentlich-Schalten {confirm?.count === 1 ? "wird sie" : "werden sie"}{" "}
          mitveröffentlicht und {confirm?.count === 1 ? "bleibt" : "bleiben"} öffentlich —
          auch wenn du das Training später wieder privat schaltest. Verwalte sie bei Bedarf
          separat im Übungsbereich.
        </p>
        <ul className="flex flex-col gap-1">
          {(confirm?.names ?? []).map((n) => (
            <li key={n} className="type-body-medium text-on-surface">
              · {n}
            </li>
          ))}
        </ul>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
