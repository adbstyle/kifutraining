import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="focus-ring type-label-medium mb-6 inline-flex items-center gap-1.5 rounded-[3px] text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        Zum Katalog
      </Link>

      <header className="mb-8">
        <p className="type-label-medium text-primary">KiFu</p>
        <h1 className="type-headline-large mt-1 text-on-surface">Anmelden</h1>
        <p className="type-body-medium mt-2 text-on-surface-variant">
          Melde dich an, um eigene Übungen zu erstellen und zu verwalten. Ohne
          Konto kannst du den Katalog uneingeschränkt durchsuchen.
        </p>
      </header>

      {sp.error && (
        <p className="type-body-small mb-4 rounded-[4px] border border-error/40 bg-error/10 p-3 text-on-surface">
          Der Anmeldelink war ungültig oder abgelaufen. Bitte fordere einen neuen an.
        </p>
      )}

      <Card className="p-6">
        <LoginForm redirect={redirect} />
      </Card>
    </main>
  );
}
