"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Globe, Lock, Trash2, Copy } from "lucide-react";
import {
  Button,
  IconButton,
  IconButtonLink,
  Tooltip,
  OverflowMenu,
  Dialog,
  Snackbar,
} from "@/components/ui";
import {
  setVisibility,
  deleteExercise,
  kopiereUebung,
} from "@/lib/actions/exercises";

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
   muss.

   Im Menü steht über dem Löschen das Kopieren (#171): eine Alltagsaktion, die
   aber nicht in die Icon-Reihe drängt — die eigene Übung kopiert man selten,
   und der Cluster ist schon dicht. Die Detailansicht ist der EINZIGE Einstieg;
   die Übungsliste bekommt kein Aktionsmenü je Zeile (OOS 4). */
export function OwnerActions({
  id,
  slug,
  name,
  visibility,
  favoriteSlot,
}: {
  id: string;
  slug: string;
  /** Für die a11y-Namen: ohne ihn hiesse jedes ⋮-Menü gleich. */
  name: string;
  visibility: "public" | "private";
  favoriteSlot?: ReactNode;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [kopierFehler, setKopierFehler] = useState<string | null>(null);
  const [kopiert, starteKopie] = useTransition();
  const isPublic = visibility === "public";
  const next = isPublic ? "private" : "public";
  const visibilityLabel = isPublic ? "Auf privat setzen" : "Öffentlich schalten";

  /* Kopieren: Der Server legt die Kopie an (Name samt Kopie-Kennzeichnung,
     Bild, Diagramm, privat) und meldet ihren Slug; von dort geht es unmittelbar
     auf die Kopie (AK 4). Fehlschläge sagt der Snackbar (AK 7). */
  function kopieren() {
    setKopierFehler(null);
    starteKopie(async () => {
      const res = await kopiereUebung(id);
      if (res.ok) router.push(`/uebung/${res.slug}?kopiert=1`);
      else setKopierFehler(res.error);
    });
  }

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

      {/* ⋮-Überlaufmenü — Kopieren und, davon abgesetzt, das Löschen. */}
      <OverflowMenu
        label={`Weitere Aktionen zu „${name}"`}
        disabled={kopiert}
        items={[
          {
            label: "Kopieren",
            icon: Copy,
            onSelect: kopieren,
          },
          {
            label: "Löschen",
            icon: Trash2,
            danger: true,
            onSelect: () => setConfirmOpen(true),
          },
        ]}
      />

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

      <Snackbar
        open={!!kopierFehler}
        message={kopierFehler ?? ""}
        onClose={() => setKopierFehler(null)}
      />
    </>
  );
}
