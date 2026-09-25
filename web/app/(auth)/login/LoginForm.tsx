"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { LogIn, MailCheck } from "lucide-react";
import { TextField, PasswordField, Button, Banner } from "@/components/ui";
import { login, resendConfirmation, type AuthState } from "@/lib/actions/auth";

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

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="text" size="sm" disabled={pending}>
      {pending ? "Wird gesendet …" : "Bestätigung erneut senden"}
    </Button>
  );
}

/** Bei „E-Mail noch nicht bestätigt": Hinweis + Button, der die Bestätigungsmail
 *  erneut anfordert (eigene Server-Action, eigener Form-Status). */
function NeedsConfirmation({ email }: { email?: string }) {
  const [state, formAction] = useActionState(resendConfirmation, initial);

  if (state.status === "confirm") {
    return (
      <Banner icon={MailCheck}>
        Bestätigungsmail erneut an <strong>{state.email ?? email}</strong>{" "}
        gesendet.
      </Banner>
    );
  }

  return (
    /* Mit Knopf trägt der Banner `status` statt `alert` (siehe Banner): jeder
       Klick ändert die Beschriftung, `alert` läse den Banner jedes Mal
       unterbrechend neu vor. */
    <Banner
      tone="fehler"
      actions={
        <form action={formAction}>
          <input type="hidden" name="email" value={email ?? ""} />
          <ResendButton />
        </form>
      }
    >
      Bitte bestätige zuerst deine E-Mail-Adresse. Den Link nicht erhalten?
    </Banner>
  );
}

export function LoginForm({ redirect }: { redirect: string }) {
  const [state, formAction] = useActionState(login, initial);
  const isError = state.status === "error";

  return (
    <div className="flex flex-col gap-5">
      {/* Resend-Hinweis bewusst AUSSERHALB des Login-<form> (verschachtelte
          <form>-Elemente sind ungültiges HTML). */}
      {state.status === "needs-confirmation" && (
        <NeedsConfirmation email={state.email} />
      )}
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
          <Link href="/registrieren" className="type-label-medium text-on-surface-mittel underline">
            Registrieren
          </Link>
        </div>
      </form>
    </div>
  );
}
