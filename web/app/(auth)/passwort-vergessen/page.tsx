import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Passwort vergessen — KiFu",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <>
      <header className="mb-8">
        <p className="type-label-medium text-primary">KiFu</p>
        <h1 className="type-headline-large mt-1 text-on-surface">Passwort vergessen</h1>
        <p className="type-body-medium mt-2 text-on-surface-mittel">
          Gib deine E-Mail-Adresse ein — wir senden dir einen Link zum Zurücksetzen.
        </p>
      </header>
      <Card className="p-6">
        <ForgotPasswordForm />
      </Card>
    </>
  );
}
