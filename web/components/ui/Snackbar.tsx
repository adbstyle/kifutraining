import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/* M3 Snackbar — kurze Rückmeldung am unteren Rand. Inverse-Farben (helle
   Fläche, dunkler Text) für Kontrast gegen das dunkle UI. Optionale Aktion +
   Schliessen. Gespeist aus --snackbar-*-Component-Tokens. Präsentational:
   open/Timer steuert die Eltern-Komponente. */
export function Snackbar({
  open,
  message,
  actionLabel,
  onAction,
  onClose,
  className,
}: {
  open: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-3 rounded-(--snackbar-shape) bg-(--snackbar-container) px-4 py-3 text-(--snackbar-label) shadow-e4",
        className,
      )}
    >
      <span className="type-body-medium">{message}</span>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="type-label-large -my-1 rounded-[3px] px-2 py-1 text-(--snackbar-action) transition-colors hover:bg-scrim/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--snackbar-action)"
        >
          {actionLabel}
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Schliessen"
          className="-mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-(--snackbar-label) transition-colors hover:bg-scrim/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--snackbar-action)"
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}
