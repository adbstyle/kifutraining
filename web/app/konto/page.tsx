import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { KontoClient } from "./KontoClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Konto — KiFu", robots: { index: false } };

export default async function KontoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="type-label-medium text-primary">Konto</p>
        <h1 className="type-headline-large mt-1 text-on-surface">Dein Konto</h1>
        {user?.email && (
          <p className="type-body-medium mt-2 text-on-surface-variant">
            Angemeldet als <strong className="text-on-surface">{user.email}</strong>
          </p>
        )}
      </header>

      <Card className="p-6">
        <h2 className="type-title-large text-on-surface">Konto löschen</h2>
        <p className="type-body-medium mt-2 text-on-surface-variant">
          Wenn du die Plattform verlässt, bleiben deine öffentlich geteilten
          Übungen anonymisiert für andere erhalten. Deine privaten Entwürfe werden
          gelöscht.
        </p>
        <div className="mt-5">
          <KontoClient />
        </div>
      </Card>
    </main>
  );
}
