import type { InputHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/* Eine Ja/Nein-Angabe in einem Formular («Wiederholender Termin», «Foto
   entfernen»). Darunter liegt ein echtes `<input type="checkbox">` — Tastatur,
   Fokus und Screenreader kommen vom Browser; es trägt nur ein anderes Kleid:
   dasselbe eckige Kästchen wie die Optionen der Mehrfachauswahl, gewählt
   gefüllt in Primary mit dem Haken in on-primary. Das Label ist Teil der
   Klickfläche. */
export function Checkbox({
  label,
  className,
  disabled,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        "inline-flex min-h-9 items-center gap-3 type-body-medium text-on-surface",
        disabled ? "opacity-40" : "cursor-pointer",
        className,
      )}
    >
      <span className="relative h-[18px] w-[18px] shrink-0">
        <input
          type="checkbox"
          disabled={disabled}
          className="peer focus-ring block h-[18px] w-[18px] cursor-[inherit] appearance-none rounded-plakette kontur border-kante transition-colors checked:border-primary checked:bg-primary"
          {...rest}
        />
        <Check
          aria-hidden
          size={13}
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto text-on-primary opacity-0 peer-checked:opacity-100"
        />
      </span>
      {label}
    </label>
  );
}
