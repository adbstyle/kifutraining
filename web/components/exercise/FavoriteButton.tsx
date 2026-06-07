"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";
import { Snackbar } from "@/components/ui";
import { setFavorite } from "@/lib/actions/favorites";

type Size = "sm" | "md";

const sizes: Record<Size, { box: string; icon: number }> = {
  sm: { box: "h-9 w-9", icon: 20 }, // Karte
  md: { box: "h-11 w-11", icon: 24 }, // Detailseite, Touch-freundlich
};

/**
 * Favoriten-Umschalter für eine Übung (Story "Übungen favorisieren").
 *
 * Optimistisch: schaltet sofort um (NFR1) und stellt bei Speicherfehler den
 * vorherigen Zustand wieder her plus Hinweis-Snackbar (AC10, Postcondition 4).
 *
 * Stil-Ausnahme: Anders als der übrige M3-Stil ("kein Fill für selected") wird
 * das Herz im aktiven Zustand GEFÜLLT — der etablierte Favoriten-Code. Siehe
 * Styleguide.
 *
 * Wird nur für angemeldete USER gerendert (AC11). Auf der Karte als absolut
 * positioniertes Geschwister des Links (kein <button> in <a>); die `overlay`-
 * Variante bringt dafür einen lesbaren Hintergrund über dem Diagramm mit.
 */
export function FavoriteButton({
  exerciseId,
  initial,
  size = "md",
  variant = "plain",
  className,
}: {
  exerciseId: string;
  initial: boolean;
  size?: Size;
  variant?: "plain" | "overlay";
  className?: string;
}) {
  const [isFav, setOptimistic] = useOptimistic(initial);
  const [isPending, startTransition] = useTransition();
  const [errorOpen, setErrorOpen] = useState(false);
  const s = sizes[size];

  function toggle() {
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
      <button
        type="button"
        onClick={toggle}
        disabled={isPending} // verhindert widersprüchliche Zustände bei schnellen Doppelklicks
        aria-pressed={isFav}
        aria-label={isFav ? "Favorit entfernen" : "Als Favorit markieren"}
        className={cn(
          "focus-ring inline-flex items-center justify-center rounded-full transition-colors",
          "disabled:pointer-events-none",
          s.box,
          variant === "overlay"
            ? "bg-surface-container-low/85 shadow-e1 backdrop-blur-sm hover:bg-surface-container-low"
            : "hover:bg-on-surface/8 active:bg-on-surface/10",
          variant === "plain" && isFav && "bg-primary/10 hover:bg-primary/15",
          isFav ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
          className,
        )}
      >
        <Heart
          size={s.icon}
          strokeWidth={2}
          fill={isFav ? "currentColor" : "none"}
          aria-hidden
        />
      </button>

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
