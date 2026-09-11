"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck, UserPlus } from "lucide-react";
import { TextField, PasswordField, Button } from "@/components/ui";
import { register, type AuthState } from "@/lib/actions/auth";

const initial: AuthState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <UserPlus size={18} strokeWidth={2} aria-hidden />
      {pending ? "Konto wird erstellt …" : "Konto erstellen"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(register, initial);

  if (state.status === "confirm") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck size={40} strokeWidth={1.5} className="text-primary" aria-hidden />
        <h2 className="type-title-large text-on-surface">Fast geschafft</h2>
        <p className="type-body-medium text-on-surface-mittel">
          Wir haben einen Bestätigungslink an{" "}
          <strong className="text-on-surface">{state.email}</strong> geschickt.
          Öffne ihn, um deine Registrierung abzuschliessen.
        </p>
      </div>
    );
  }

  const isError = state.status === "error";
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <TextField
        label="E-Mail-Adresse"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        error={isError}
      />
      <PasswordField
        label="Passwort"
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
