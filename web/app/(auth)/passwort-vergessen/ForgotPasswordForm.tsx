"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck, Send } from "lucide-react";
import { TextField, Button } from "@/components/ui";
import { requestPasswordReset, type AuthState } from "@/lib/actions/auth";

const initial: AuthState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Send size={18} strokeWidth={2} aria-hidden />
      {pending ? "Wird gesendet …" : "Link senden"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initial);

  if (state.status === "reset-sent") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck size={40} strokeWidth={1.5} className="text-primary" aria-hidden />
        <h2 className="type-title-large text-on-surface">E-Mail unterwegs</h2>
        <p className="type-body-medium text-on-surface-variant">
          Falls ein Konto zu <strong className="text-on-surface">{state.email}</strong>{" "}
          existiert, haben wir einen Link zum Zurücksetzen geschickt.
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
        error={isError}
        supportingText={isError ? state.message : undefined}
      />
      <SubmitButton />
    </form>
  );
}
