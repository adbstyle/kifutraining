import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Registrieren — KiFu",
  robots: { index: false },
};

export default function RegisterPage() {
  return (
    <>
      <header className="mb-8">
        <p className="type-label-medium text-primary">KiFu</p>
        <h1 className="type-headline-large mt-1 text-on-surface">Registrieren</h1>
        <p className="type-body-medium mt-2 text-on-surface-variant">
          Erstelle ein Konto, um eigene Übungen anzulegen. Bereits registriert?{" "}
          <a href="/login" className="text-primary underline">Anmelden</a>.
        </p>
      </header>
      <Card className="p-6">
        <RegisterForm />
      </Card>
    </>
  );
}
