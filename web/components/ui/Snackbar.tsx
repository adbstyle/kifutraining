import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/* M2 Snackbar — die Fläche einer kurzen Rückmeldung zu einem Vorgang. Sie hebt
   sich über die Höhe ab (06dp + Schatten), nicht über eine umgekehrte Fläche:
   eine helle Insel mit dunkler Schrift wäre im dunklen Bild ein Fremdkörper,
   und die Handlung darauf könnte die Primary der App nicht mehr tragen.
   Tonlos: Ob ein Vorgang gescheitert ist, steht im Text (Story #234).

   Nur die Fläche. Wo und wie lange sie steht, bestimmt der eine Platz am
   unteren Rand (`SnackbarProvider`); Aufrufer melden über `useSnackbar()` und
   rendern diese Komponente nicht selbst. */
export function Snackbar({
  message,
  actionLabel,
  onAction,
  onClose,
  className,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-3 rounded-flaeche bg-elev-06 px-4 py-3 text-on-surface shadow-dp-06",
        className,
      )}
    >
      <span className="type-body-medium">{message}</span>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="state focus-ring type-label-large -my-1 shrink-0 rounded-flaeche px-2 py-1 text-primary"
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Schliessen"
        className="state focus-ring -mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-on-surface"
      >
        <X size={18} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
