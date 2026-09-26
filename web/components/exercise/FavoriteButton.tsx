"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { IconButton } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { setFavorite } from "@/lib/actions/favorites";

/**
 * Favoriten-Umschalter für eine Übung (Story "Übungen favorisieren").
 *
 * Ist ein {@link IconButton} aus dem UI-Kit — der Button-Shell (Grösse,
 * State-Layer, Focus-Ring, primary im aktiven Zustand) kommt vollständig von
 * dort. Dieses Feature-Bauteil steuert nur das Verhalten und die eine bewusste
 * Stil-Ausnahme.
 *
 * Optimistisch: schaltet sofort um (NFR1) und stellt bei Speicherfehler den
 * vorherigen Zustand wieder her plus Hinweis-Snackbar (AC10, Postcondition 4).
 *
 * Stil-Ausnahme: Anders als der übrige M3-Stil ("kein Fill für selected") wird
 * das Herz im aktiven Zustand GEFÜLLT (`iconProps.fill`) — der etablierte,
 * sofort lesbare Favoriten-Code. Siehe Styleguide.
 *
 * Wird nur für angemeldete USER gerendert (AC11). Auf der Karte als absolut
 * positioniertes Geschwister des Links (kein <button> in <a>); die `overlay`-
 * Variante bringt dafür einen lesbaren Hintergrund über dem Diagramm mit.
 */
export function FavoriteButton({
  exerciseId,
  initial,
  size = "md",
  variant = "standard",
  className,
}: {
  exerciseId: string;
  initial: boolean;
  size?: "sm" | "md";
  variant?: "standard" | "overlay";
  className?: string;
}) {
  const [isFav, setOptimistic] = useOptimistic(initial);
  const [isPending, startTransition] = useTransition();
  const melde = useSnackbar();

  function toggle() {
    if (isPending) return; // verhindert widersprüchliche Zustände bei schnellen Doppelklicks
    const next = !isFav;
    startTransition(async () => {
      setOptimistic(next); // sofortiges Feedback
      const res = await setFavorite(exerciseId, next);
      // Bei Fehlschlag macht useOptimistic die Änderung automatisch rückgängig,
      // da die echte Quelle (initial) unverändert bleibt.
      if (!res.ok) melde("Konnte nicht gespeichert werden. Bitte erneut versuchen.");
    });
  }

  return (
    <IconButton
      icon={Heart}
      label={isFav ? "Favorit entfernen" : "Als Favorit markieren"}
      size={size}
      variant={variant}
      active={isFav}
      onClick={toggle}
      // Bewusste Abweichung: Herz im aktiven Zustand gefüllt (sonst outlined).
      iconProps={{ fill: isFav ? "currentColor" : "none" }}
      className={className}
    />
  );
}
