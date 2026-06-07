"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { TextField, PasswordField, Button } from "@/components/ui";
import { login, type AuthState } from "@/lib/actions/auth";

const initial: AuthState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <LogIn size={18} strokeWidth={2} aria-hidden />
      {pending ? "Wird angemeldet …" : "Anmelden"}
    </Button>
  );
}

export function LoginForm({ redirect }: { redirect: string }) {
  const [state, formAction] = useActionState(login, initial);
  const isError = state.status === "error";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="redirect" value={redirect} />
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
        autoComplete="current-password"
        required
        error={isError}
        supportingText={isError ? state.message : undefined}
      />
      <SubmitButton />
      <div className="flex justify-between">
        <Link href="/passwort-vergessen" className="type-label-medium text-primary underline">
          Passwort vergessen?
        </Link>
        <Link href="/registrieren" className="type-label-medium text-on-surface-variant underline">
          Registrieren
        </Link>
      </div>
    </form>
  );
}
