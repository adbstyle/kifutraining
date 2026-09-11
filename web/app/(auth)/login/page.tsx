import type { Metadata } from "next";
import Link from "next/link";
import { Card, Meldung } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Anmelden — KiFu",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const redirect = sp.redirect?.startsWith("/") ? sp.redirect : "/";

  return (
    <>
      <header className="mb-8">
        <p className="type-label-medium text-primary">KiFu</p>
        <h1 className="type-headline-large mt-1 text-on-surface">Anmelden</h1>
        <p className="type-body-medium mt-2 text-on-surface-mittel">
          Melde dich mit E-Mail und Passwort an. Noch kein Konto?{" "}
          <Link href="/registrieren" className="text-primary underline">Registrieren</Link>.
        </p>
      </header>

      {sp.error && (
        <Meldung tone="fehler" className="mb-4">
          Der Bestätigungslink war ungültig oder abgelaufen. Bitte melde dich an
          oder fordere einen neuen Link an.
        </Meldung>
      )}

      <Card className="p-6">
        <LoginForm redirect={redirect} />
      </Card>
    </>
  );
}
