"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { IconButton, Snackbar } from "@/components/ui";
import { setFavorite } from "@/lib/actions/favorites";

/**
 * Favoriten-Umschalter für eine Übung (Story "Übungen favorisieren").
 *
 * Ist ein {@link IconButton} aus dem UI-Kit — der Button-Shell (Größe,
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
  const [errorOpen, setErrorOpen] = useState(false);

  function toggle() {
    if (isPending) return; // verhindert widersprüchliche Zustände bei schnellen Doppelklicks
    const next = !isFav;
    startTransition(async () => {
      setOptimistic(next); // sofortiges Feedback
      const res = await setFavorite(exerciseId, next);
      // Bei Fehlschlag macht useOptimistic die Änderung automatisch rückgängig,
      // da die echte Quelle (initial) unverändert bleibt.
      if (!res.ok) setErrorOpen(true);
    });
  }

  return (
    <>
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

      {/* Fehler-Snackbar nur bei Bedarf im DOM (nicht je Karte dauerhaft). */}
      {errorOpen && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="pointer-events-auto">
            <Snackbar
              open
              message="Konnte nicht gespeichert werden. Bitte erneut versuchen."
              onClose={() => setErrorOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
