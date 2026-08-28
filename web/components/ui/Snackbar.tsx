import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/* M3 Snackbar — kurze Rückmeldung am unteren Rand. Inverse-Farben (helle
   Fläche, dunkler Text) für Kontrast gegen das dunkle UI. Optionale Aktion +
   Schliessen. Gespeist aus --snackbar-*-Component-Tokens. Präsentational:
   open/Timer steuert die Eltern-Komponente.

   Zwei Platzierungen. `inline` hängt die Meldung dort ein, wo sie steht — gut,
   solange der auslösende Knopf daneben liegt. `fixed` heftet sie an den unteren
   Rand des Sichtfelds; das braucht jede lange Seite, auf der die Aktion irgendwo
   weit oben oder mitten drin sitzt: im Fluss stünde die Meldung dann unter dem
   gesamten Inhalt und niemand sähe sie. */
export function Snackbar({
  open,
  message,
  actionLabel,
  onAction,
  onClose,
  /** `inline` folgt dem Dokumentfluss, `fixed` heftet an den unteren Rand des
   *  Sichtfelds. Voreinstellung `inline`, weil die meisten Aufrufer direkt beim
   *  auslösenden Knopf stehen. */
  placement = "inline",
  className,
}: {
  open: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  placement?: "inline" | "fixed";
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-3 rounded-(--snackbar-shape) bg-(--snackbar-container) px-4 py-3 text-(--snackbar-label) shadow-e4",
        placement === "fixed" &&
          "fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2",
        className,
      )}
    >
      <span className="type-body-medium">{message}</span>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="focus-ring type-label-large -my-1 rounded-[3px] px-2 py-1 text-(--snackbar-action) transition-colors hover:bg-scrim/10"
        >
          {actionLabel}
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Schliessen"
          className="focus-ring -mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-(--snackbar-label) transition-colors hover:bg-scrim/10"
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}
