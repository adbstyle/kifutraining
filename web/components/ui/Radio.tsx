"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Optionsfeld (#700): eine Wahl unter wenigen, die zusammen in einer
   `radiogroup` stehen — erstmals die Kurzwahl im Zeitraumfilter. Masse,
   Kontur und Schrift wie die Checkbox (18 px, `kontur`, Primary), damit
   beide in einem Panel gleich stehen; gewählt füllt ein dicker Ring in
   Primary den Kreis statt eines Häkchens. Wo die Wahl als Chip oder als
   Zeile mit Häkchen besser liest (`ChoiceChipGroup`, `AuswahlListe`), gelten
   jene; das Optionsfeld ist für eine Einfachauswahl unter Formularfeldern. */
export function Radio({
  label,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        "inline-flex min-h-9 items-center gap-3 type-body-medium text-on-surface",
        rest.disabled ? "opacity-40" : "cursor-pointer",
        className,
      )}
    >
      <input
        type="radio"
        className="focus-ring h-[18px] w-[18px] shrink-0 cursor-[inherit] appearance-none rounded-full kontur border-kante transition-colors checked:border-[6px] checked:border-primary"
        {...rest}
      />
      {label}
    </label>
  );
}
