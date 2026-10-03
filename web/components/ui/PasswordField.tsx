"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { TextField, feldTrailingKnopf, type TextFieldProps } from "./TextField";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "trailing">;

/** Passwortfeld auf Basis von TextField mit Sichtbarkeits-Toggle. Der Toggle
 *  sitzt im Zeichen-Slot am rechten Feldrand — demselben Platz, an dem das
 *  Suchfeld sein Kreuz trägt. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>((props, ref) => {
  const [show, setShow] = useState(false);
  const Icon = show ? EyeOff : Eye;
  return (
    <TextField
      ref={ref}
      type={show ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
          aria-pressed={show}
          className={feldTrailingKnopf}
        >
          <Icon size={18} strokeWidth={2} aria-hidden />
        </button>
      }
      {...props}
    />
  );
});
PasswordField.displayName = "PasswordField";
