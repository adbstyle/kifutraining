"use client";

import { useRef, useState, type ReactNode } from "react";
import { Pencil, Globe, Lock, Trash2, MoreVertical } from "lucide-react";
import {
  Button,
  IconButton,
  IconButtonLink,
  Tooltip,
  Menu,
  Dialog,
} from "@/components/ui";
import { setVisibility, deleteExercise } from "@/lib/actions/exercises";

/* Eigentümer-Aktionen als Inline-Icon-Cluster, der rechts in die Badge-Zeile
   der Detailseite gesetzt wird (kein eigener Kasten/Label mehr): bearbeiten
   (Link), Sichtbarkeit umschalten (Form), und ein ⋮-Überlaufmenü, das die
   destruktive Löschen-Aktion vom Alltagsgeschäft trennt (Löschen liegt bewusst
   NICHT offen). Löschen ist damit zweistufig: ⋮ → Löschen → Bestätigungsdialog
   (Story 7 EK4). Tooltips machen die icon-only Buttons lesbar (der Globus allein
   wäre mehrdeutig).

   `favoriteSlot` wird zwischen Sichtbarkeit und ⋮ platziert — so steht der
   Favoriten-Button (für alle angemeldeten User) in der gewünschten Reihenfolge
   Stift · Globus · Herz · ⋮, ohne dass die Detailseite die Owner-Logik kennen
   muss. */
export function OwnerActions({
  id,
  slug,
  visibility,
  favoriteSlot,
}: {
  id: string;
  slug: string;
  visibility: "public" | "private";
  favoriteSlot?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const isPublic = visibility === "public";
  const next = isPublic ? "private" : "public";
  const visibilityLabel = isPublic ? "Auf privat setzen" : "Öffentlich schalten";

  return (
    <>
      <Tooltip label="Bearbeiten">
        <IconButtonLink
          href={`/uebung/${slug}/edit`}
          icon={Pencil}
          label="Bearbeiten"
          size="sm"
        />
      </Tooltip>

      <form action={setVisibility.bind(null, id, next)} className="inline-flex">
        <Tooltip label={visibilityLabel}>
          <IconButton
            type="submit"
            icon={isPublic ? Lock : Globe}
            label={visibilityLabel}
            size="sm"
          />
        </Tooltip>
      </form>

      {favoriteSlot}

      {/* ⋮-Überlaufmenü — Löschen liegt hier statt offen in der Reihe. */}
      <div className="relative">
        <Tooltip label="Weitere Aktionen">
          <IconButton
            ref={menuTriggerRef}
            icon={MoreVertical}
            label="Weitere Aktionen"
            size="sm"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          />
        </Tooltip>
        <Menu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          triggerRef={menuTriggerRef}
          className="right-0"
          items={[
            {
              label: "Löschen",
              icon: Trash2,
              danger: true,
              onSelect: () => setConfirmOpen(true),
            },
          ]}
        />
      </div>

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
    </>
  );
}
