"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  TextField,
  feldTrailingKnopf,
  feldTrailingPadding,
  feldTrailingSlot,
  type TextFieldProps,
} from "./TextField";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "leadingIcon">;

/** Passwortfeld auf Basis von TextField mit Sichtbarkeits-Toggle.
 *  Der Toggle sitzt im Trailing-Slot des Felds (siehe `feldTrailingSlot`) —
 *  demselben Platz, an dem das Suchfeld sein Kreuz trägt. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, dense, ...props }, ref) => {
    const [show, setShow] = useState(false);
    const Icon = show ? EyeOff : Eye;
    return (
      <div className={className}>
        <div className="relative">
          <TextField
            ref={ref}
            dense={dense}
            type={show ? "text" : "password"}
            className={feldTrailingPadding}
            {...props}
          />
          <span className={feldTrailingSlot(dense)}>
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
              aria-pressed={show}
              className={feldTrailingKnopf}
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
