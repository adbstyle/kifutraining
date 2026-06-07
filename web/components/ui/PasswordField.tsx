"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { TextField, type TextFieldProps } from "./TextField";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "leadingIcon">;

/** Passwortfeld auf Basis von TextField mit Sichtbarkeits-Toggle.
 *  Der Toggle ist absolut an der rechten Kante der Inputzeile (h-14) verankert,
 *  damit er nicht mit dem darunterliegenden supportingText kollidiert. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = useState(false);
    const Icon = show ? EyeOff : Eye;
    return (
      <div className={className}>
        <div className="relative">
          <TextField
            ref={ref}
            type={show ? "text" : "password"}
            className="[&_input]:pr-12"
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
            aria-pressed={show}
            className="focus-ring absolute right-2 top-0 flex h-14 items-center rounded-[3px] px-2 text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <Icon size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    );
  },
);
PasswordField.displayName = "PasswordField";
