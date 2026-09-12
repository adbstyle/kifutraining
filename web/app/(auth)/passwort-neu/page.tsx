import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata: Metadata = {
  title: "Neues Passwort — KiFu",
  robots: { index: false },
};

export default async function NewPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <header className="mb-8">
        <p className="type-label-medium text-primary">KiFu</p>
        <h1 className="type-headline-large mt-1 text-on-surface">Neues Passwort</h1>
      </header>
      <Card className="p-6">
        {user ? (
          <NewPasswordForm />
        ) : (
          <p className="type-body-medium text-on-surface-mittel">
            Der Link ist ungültig oder abgelaufen.{" "}
            <Link href="/passwort-vergessen" className="text-primary underline">
              Neuen Link anfordern
            </Link>
            .
          </p>
        )}
      </Card>
    </>
  );
}
