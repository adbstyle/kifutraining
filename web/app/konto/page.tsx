import type { Metadata } from "next";
import { LogOut, Bookmark, ChevronRight } from "lucide-react";
import { Card, Button, Banner } from "@/components/ui";
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
          Verbinde einen KI-Assistenten mit deinem Konto. Er sucht dann Übungen
          und stellt Trainings für dich zusammen. Die Adresse dafür ist{" "}
          <strong className="break-all text-on-surface">{`${origin}${MCP_PFAD}`}</strong>.
          Ein Passwort oder Schlüssel brauchst du nicht: Du erlaubst den Zugriff
          im Browser, mit deiner Anmeldung hier.
        </p>
        {/* Zwei konkrete Wege statt «in seinen Einstellungen»: Der Trainer weiss
            nicht, wo ein Client die Adresse erwartet (Rückmeldung 2026-09-23).
            Jeder Client, der Werkzeuge über MCP einbindet, funktioniert gleich. */}
        <ol className="type-body-medium mt-3 list-decimal space-y-2 pl-5 text-on-surface-mittel">
          <li>
            <strong className="text-on-surface">Claude Desktop oder claude.ai:</strong>{" "}
            Einstellungen → Connectors → «Custom connector» hinzufügen → Adresse
            eintragen. Der Browser öffnet sich: anmelden, dem Zugang einen Namen
            geben, «Erlauben».
          </li>
          <li>
            <strong className="text-on-surface">Claude Code im Terminal:</strong>{" "}
            <code className="break-all text-on-surface">{`claude mcp add --transport http kifu ${origin}${MCP_PFAD}`}</code>,
            danach in der Sitzung <code className="text-on-surface">/mcp</code> → kifu →
            «Authenticate»; der Rest läuft wie oben im Browser.
          </li>
        </ol>
        <p className="type-body-small mt-3 text-on-surface-mittel">
          Andere Assistenten, die Werkzeuge über MCP einbinden, gehen gleich.
          Höchstens {KI_ZUGAENGE_MAX} Zugänge gleichzeitig; jeden kannst du hier
          einzeln widerrufen.
        </p>
        <div className="mt-4">
          {zugaenge === null ? (
            <Banner tone="fehler">
              Deine KI-Zugänge lassen sich gerade nicht anzeigen. Bitte lade die
              Seite später erneut.
            </Banner>
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
