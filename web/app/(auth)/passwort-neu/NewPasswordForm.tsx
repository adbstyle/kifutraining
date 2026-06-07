"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { PasswordField, Button } from "@/components/ui";
import { setNewPassword, type AuthState } from "@/lib/actions/auth";

const initial: AuthState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Check size={18} strokeWidth={2} aria-hidden />
      {pending ? "Wird gespeichert …" : "Passwort speichern"}
    </Button>
  );
}

export function NewPasswordForm() {
  const [state, formAction] = useActionState(setNewPassword, initial);
  const isError = state.status === "error";
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <PasswordField
        label="Neues Passwort"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={isError}
        supportingText={isError ? state.message : "Mindestens 8 Zeichen."}
      />
      <PasswordField
        label="Passwort wiederholen"
        name="confirm"
        autoComplete="new-password"
        required
        minLength={8}
        error={isError}
      />
      <SubmitButton />
    </form>
  );
}
