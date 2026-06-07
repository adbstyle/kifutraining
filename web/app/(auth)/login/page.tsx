import type { Metadata } from "next";
import { Card } from "@/components/ui";
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
        <p className="type-body-medium mt-2 text-on-surface-variant">
          Melde dich mit E-Mail und Passwort an. Noch kein Konto?{" "}
          <a href="/registrieren" className="text-primary underline">Registrieren</a>.
        </p>
      </header>

      {sp.error && (
        <p className="type-body-small mb-4 rounded-[4px] border border-error/40 bg-error/10 p-3 text-on-surface">
          Der Bestätigungslink war ungültig oder abgelaufen. Bitte melde dich an
          oder fordere einen neuen Link an.
        </p>
      )}

      <Card className="p-6">
        <LoginForm redirect={redirect} />
      </Card>
    </>
  );
}
