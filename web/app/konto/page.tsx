import type { Metadata } from "next";
import { LogOut, Bookmark, ChevronRight } from "lucide-react";
import { Card, Button, Meldung } from "@/components/ui";
import { KontoClient } from "./KontoClient";
import { AnzeigenameForm } from "./AnzeigenameForm";
import { KiZugaengeListe } from "./KiZugaengeListe";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { getMeinAnzeigename, hatEigenenAnzeigenamen } from "@/lib/queries/profil";
import { getMeineZugaenge } from "@/lib/queries/ki-zugaenge";
import { KI_ZUGAENGE_MAX } from "@/lib/mcp/regeln";
import { oeffentlicherOrigin } from "@/lib/origin";
import { MCP_PFAD } from "@/lib/mcp/pfad";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Konto — KiFu", robots: { index: false } };

export default async function KontoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [anzeigeName, eigenerName, zugaenge, origin] = await Promise.all([
    getMeinAnzeigename(),
    hatEigenenAnzeigenamen(),
    getMeineZugaenge(),
    oeffentlicherOrigin(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <h1 className="type-headline-large text-on-surface">Dein Konto</h1>
        {user?.email && (
          <p className="type-body-medium mt-2 text-on-surface-mittel">
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

      {anzeigeName && (
        <Card className="mb-4 p-6">
          <h2 className="type-title-large text-on-surface">Anzeigename</h2>
          <div className="mt-2">
            <AnzeigenameForm aktuell={anzeigeName} eigen={eigenerName} />
          </div>
        </Card>
      )}

      <Link
        href="/?mine=1"
        className="focus-ring state group mb-4 flex items-center gap-4 rounded-flaeche bg-elev-01 p-5"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elev-08 text-on-surface">
          <Bookmark size={22} strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-title-medium block text-on-surface">Meine Übungen</span>
          <span className="type-body-small block text-on-surface-mittel">
            Deine eigenen Übungen — öffentliche und private Entwürfe.
          </span>
        </span>
        <ChevronRight
          size={20}
          strokeWidth={2}
          className="shrink-0 text-on-surface-mittel transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>

      {/* KI-Zugänge (Story #142 AK 5, AK 6). Die Adresse steht hier, weil der
          Trainer sie in seinen KI-Client eintragen muss; ein Geheimnis gibt es
          nicht (NFR 4) — erlaubt wird im Browser. */}
      <Card className="mb-4 p-6">
        <h2 className="type-title-large text-on-surface">KI-Zugänge</h2>
        <p className="type-body-medium mt-2 text-on-surface-mittel">
          Verbinde einen KI-Assistenten wie Claude mit deinem Konto: Trage in
          seinen Einstellungen die Adresse{" "}
          <strong className="break-all text-on-surface">{`${origin}${MCP_PFAD}`}</strong>{" "}
          ein und erlaube den Zugriff im Browser. Höchstens {KI_ZUGAENGE_MAX}{" "}
          Zugänge gleichzeitig.
        </p>
        <div className="mt-4">
          {zugaenge === null ? (
            <Meldung tone="fehler">
              Deine KI-Zugänge lassen sich gerade nicht anzeigen. Bitte lade die
              Seite später erneut.
            </Meldung>
          ) : (
            <KiZugaengeListe zugaenge={zugaenge} />
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="type-title-large text-on-surface">Konto löschen</h2>
        <p className="type-body-medium mt-2 text-on-surface-mittel">
          Wenn du die Plattform verlässt, bleiben deine öffentlich geteilten
          Übungen anonymisiert für andere erhalten. Deine privaten Entwürfe werden
          gelöscht. Verbundene KI-Assistenten verlieren ihren Zugang.
        </p>
        <div className="mt-5">
          <KontoClient />
        </div>
      </Card>
    </main>
  );
}
