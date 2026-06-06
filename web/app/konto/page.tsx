import type { Metadata } from "next";
import { LogOut, Bookmark, ChevronRight } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { KontoClient } from "./KontoClient";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import Link from "next/link";

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
        <form action={signOut} className="mt-5">
          <Button type="submit" variant="outlined" size="sm">
            <LogOut size={18} strokeWidth={2} aria-hidden />
            Abmelden
          </Button>
        </form>
      </header>

      <Link
        href="/meine-uebungen"
        className="focus-ring group mb-4 flex items-center gap-4 rounded-[8px] border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-outline hover:bg-on-surface/5"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <Bookmark size={22} strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-title-medium block text-on-surface">Meine Übungen</span>
          <span className="type-body-small block text-on-surface-variant">
            Deine eigenen Übungen — öffentliche und private Entwürfe.
          </span>
        </span>
        <ChevronRight
          size={20}
          strokeWidth={2}
          className="shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>

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
