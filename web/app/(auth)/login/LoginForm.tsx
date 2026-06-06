"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck, Send } from "lucide-react";
import { TextField, Button } from "@/components/ui";
import { requestMagicLink, type MagicLinkState } from "@/lib/actions/auth";

const initial: MagicLinkState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Send size={18} strokeWidth={2} aria-hidden />
      {pending ? "Wird gesendet …" : "Anmeldelink senden"}
    </Button>
  );
}

export function LoginForm({ redirect }: { redirect: string }) {
  const [state, formAction] = useActionState(requestMagicLink, initial);

  if (state.status === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck size={40} strokeWidth={1.5} className="text-primary" aria-hidden />
        <h2 className="type-title-large text-on-surface">E-Mail unterwegs</h2>
        <p className="type-body-medium text-on-surface-variant">
          Wir haben einen Anmeldelink an{" "}
          <strong className="text-on-surface">{state.email}</strong> geschickt.
          Öffne ihn auf diesem Gerät, um angemeldet zu werden. Der Link weist den
          Besitz deiner Adresse nach — kein Passwort nötig.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="redirect" value={redirect} />
      <TextField
        label="E-Mail-Adresse"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.status === "error"}
        supportingText={
          state.status === "error"
            ? state.message
            : "Du bekommst einen Anmeldelink per E-Mail."
        }
      />
      <SubmitButton />
    </form>
  );
}
