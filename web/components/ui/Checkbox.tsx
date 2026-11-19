"use client";

import { useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/* Eine Ja/Nein-Angabe in einem Formular («Wiederholender Termin», «Foto
   entfernen»). Darunter liegt ein echtes `<input type="checkbox">` — Tastatur,
   Fokus und Screenreader kommen vom Browser; es trägt nur ein anderes Kleid:
   dasselbe eckige Kästchen wie die Optionen der Mehrfachauswahl, gewählt
   gefüllt in Primary mit dem Haken in on-primary. Das Label ist Teil der
   Klickfläche.

   `teilweise` (#452): Für eine Auswahl gilt die Angabe nur zum Teil — etwa
   gehört nur ein Teil der gewählten Spieler:innen einem Kader an. Das
   Kästchen ist dann gefüllt wie gewählt, trägt aber einen Strich statt des
   Hakens, und der Browser meldet «gemischt» (`indeterminate`). */
export function Checkbox({
  label,
  className,
  disabled,
  teilweise = false,
  hinweis,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; teilweise?: boolean; hinweis?: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  const hinweisId = useId();
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = teilweise;
  }, [teilweise]);
  return (
    <label
      className={cn(
        "inline-flex min-h-9 gap-3 type-body-medium text-on-surface",
        hinweis ? "items-start py-2" : "items-center",
        disabled ? "opacity-40" : "cursor-pointer",
        className,
      )}
    >
      <span className={cn("relative h-[18px] w-[18px] shrink-0", !!hinweis && "mt-0.5")}>
        <input
          ref={ref}
          type="checkbox"
          disabled={disabled}
          className="peer focus-ring block h-[18px] w-[18px] cursor-[inherit] appearance-none rounded-klein kontur border-kante transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary"
          {...rest}
          aria-describedby={hinweis ? [hinweisId, rest["aria-describedby"]].filter(Boolean).join(" ") : rest["aria-describedby"]}
        />
        {teilweise ? (
          <Minus aria-hidden size={13} strokeWidth={3} className="pointer-events-none absolute inset-0 m-auto text-on-primary" />
        ) : (
          <Check
            aria-hidden
            size={13}
            strokeWidth={3}
            className="pointer-events-none absolute inset-0 m-auto text-on-primary opacity-0 peer-checked:opacity-100"
          />
        )}
      </span>
      {hinweis ? (
        <span className="flex flex-col">
          <span>{label}</span>
          <span id={hinweisId} className="type-body-small text-on-surface-mittel">
            {hinweis}
          </span>
        </span>
      ) : (
        label
      )}
    </label>
  );
}
