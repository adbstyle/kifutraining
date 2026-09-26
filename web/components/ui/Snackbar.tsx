import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/* M2 Snackbar — die Fläche einer kurzen Rückmeldung zu einem Vorgang. Sie ist
   die eine UMGEKEHRTE Fläche der Anwendung (@utility umkehr): hell, mit dunkler
   Schrift und dunklem Violett für die Aktion. Die Snackbar meldet am Bildrand
   und geht von selbst — sie muss beim ersten Hinsehen auffallen. Über die
   Höhe allein (06dp) hob sie sich nur 1.36:1 vom Grund ab und blieb unbemerkt;
   hell steht sie bei rund 14:1, so wie Material sie auch meint.
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
        "umkehr inline-flex max-w-full items-center gap-3 rounded-flaeche px-4 py-3 shadow-dp-06",
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
