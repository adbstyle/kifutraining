"use client";

import { useState } from "react";
import { Pencil, Globe, Lock, Trash2 } from "lucide-react";
import { Button, ButtonLink, Dialog } from "@/components/ui";
import { setVisibility, deleteExercise } from "@/lib/actions/exercises";

/* Eigentümer-Aktionen auf der Detailseite: bearbeiten, Sichtbarkeit umschalten,
   löschen (mit Bestätigungsdialog, Story 7 EK4). */
export function OwnerActions({
  id,
  slug,
  visibility,
}: {
  id: string;
  slug: string;
  visibility: "public" | "private";
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isPublic = visibility === "public";
  const next = isPublic ? "private" : "public";

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-[6px] border border-outline-variant bg-surface-container-low p-3">
      <span className="type-label-small mr-1 text-on-surface-variant">Deine Übung:</span>

      <ButtonLink href={`/uebung/${slug}/edit`} variant="tonal" size="sm">
        <Pencil size={16} strokeWidth={2} aria-hidden />
        Bearbeiten
      </ButtonLink>

      <form action={setVisibility.bind(null, id, next)}>
        <Button type="submit" variant="outlined" size="sm">
          {isPublic ? <Lock size={16} strokeWidth={2} aria-hidden /> : <Globe size={16} strokeWidth={2} aria-hidden />}
          {isPublic ? "Auf privat setzen" : "Öffentlich schalten"}
        </Button>
      </form>

      <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
        <Trash2 size={16} strokeWidth={2} aria-hidden />
        Löschen
      </Button>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Übung löschen?"
        actions={
          <>
            <Button variant="text" onClick={() => setConfirmOpen(false)}>
              Abbrechen
            </Button>
            <form action={deleteExercise.bind(null, id)}>
              <Button type="submit" variant="danger">
                Endgültig löschen
              </Button>
            </form>
          </>
        }
      >
        Diese Übung wird mitsamt Feld-Diagramm endgültig entfernt. Das kann nicht
        rückgängig gemacht werden.
      </Dialog>
    </div>
  );
}
