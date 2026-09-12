"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { TextField, type TextFieldProps } from "./TextField";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "leadingIcon">;

/** Passwortfeld auf Basis von TextField mit Sichtbarkeits-Toggle.
 *  Der Toggle ist absolut an der rechten Kante der Inputzeile (h-14) verankert,
 *  damit er nicht mit dem darunterliegenden supportingText kollidiert. Die
 *  Verankerung sitzt auf einem eigenen Wrapper, damit der Knopf selbst die
 *  Zustands-Ebene (`state`) tragen kann — die will ihn ihrerseits auf
 *  `position: relative` stellen. */
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
          <span className="absolute right-2 top-0">
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
              aria-pressed={show}
              className="state focus-ring flex h-14 items-center rounded-flaeche px-2 text-on-surface-mittel"
            >
              <Icon size={18} strokeWidth={2} aria-hidden />
            </button>
          </span>
        </div>
      </div>
    );
  },
);
PasswordField.displayName = "PasswordField";
