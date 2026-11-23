import type { Viewport } from "next";
import Link from "next/link";
import { FigurenSprite } from "@/components/diagramm/figur";
import { ButtonLink } from "@/components/ui";
import { DarstellungsMarke } from "@/components/layout/DarstellungKontext";
import { GRUND_HELL } from "@/lib/farben";
import { REPO_URL } from "@/lib/startseite";
import { getUserImRequest } from "@/lib/supabase/server";

/* Die Startseite (#670) und ihre Nachbarn: ohne Seitenleiste, mit eigener
   Kopf- und Fusszeile (Entscheid 1). Immer hell (AK 13, Entscheid 3), auch
   für Angemeldete über «/startseite»: die Marke für globals.css und die
   Systemleiste im hellen Grund. Kein Manifest «KiFu» (#651): Die Seite ist
   nicht die App; die abgelegte App startet auf «/» und geht von dort in den
   Arbeitsbereich (#671). */
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: GRUND_HELL,
};

export default async function StartLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserImRequest();
  return (
    <div className="flex min-h-dvh flex-col bg-elev-00">
      <DarstellungsMarke darstellung="hell" />
      {/* Die Figurteile der Feld-Diagramme auf den Übungskarten, einmal pro Seite. */}
      <FigurenSprite />
      <header className="border-b border-linie">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-flaeche p-1.5 text-on-surface">
            {/* Dieselbe Bildmarke wie Favicon und Seitenleiste; den Namen sagt der Text. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG, nichts zu optimieren */}
            <img src="/icon.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
            <span className="type-title-large">KiFu</span>
          </Link>
          <nav aria-label="Konto" className="flex items-center gap-2">
            {user ? (
              <ButtonLink href="/" variant="filled">
                Zur App
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="text">
                  Anmelden
                </ButtonLink>
                {/* Schmal steht «Kostenlos registrieren» gleich darunter im Einstieg. */}
                <ButtonLink href="/registrieren" variant="filled" className="hidden sm:inline-flex">
                  Kostenlos registrieren
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-linie">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="type-body-small text-on-surface-tief">KiFu · Kinder- und Juniorenfussball</p>
          <nav aria-label="Weiteres" className="type-body-small flex flex-wrap gap-x-5 gap-y-2">
            <FussLink href="/versionen">Versionen</FussLink>
            <FussLink href="/cookies">Cookies</FussLink>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring rounded-flaeche text-on-surface-mittel transition-colors hover:text-on-surface"
            >
              GitHub<span className="sr-only"> (öffnet ausserhalb von KiFu)</span>
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function FussLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="focus-ring rounded-flaeche text-on-surface-mittel transition-colors hover:text-on-surface">
      {children}
    </Link>
  );
}
