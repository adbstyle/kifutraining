import type { Viewport } from "next";
import Link from "next/link";
import { FigurenSprite } from "@/components/diagramm/figur";
import { ButtonLink } from "@/components/ui";
import { DarstellungsMarke } from "@/components/layout/DarstellungKontext";
import { GRUND_HELL } from "@/lib/farben";
import { RECHTLICHE_LINKS } from "@/lib/rechtliches";
import { STARTSEITE_PFAD } from "@/lib/navigation";
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
  // Die Sprünge zu den Abschnitten der Startseite: ohne Anmeldung liegt sie auf
  // «/», angemeldet führte «/» in den Arbeitsbereich (#671).
  const start = user ? STARTSEITE_PFAD : "/";
  return (
    <div className="start-palette flex min-h-dvh flex-col bg-elev-01">
      <DarstellungsMarke darstellung="hell" />
      {/* Die Figurteile der Feld-Diagramme auf den Übungskarten, einmal pro Seite. */}
      <FigurenSprite />
      <header>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-[18px] sm:px-6">
          <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-flaeche p-1.5 text-on-surface">
            {/* Dieselbe Bildmarke wie Favicon und Seitenleiste; den Namen sagt der Text. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG, nichts zu optimieren */}
            <img src="/icon.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
            <span className="type-title-large">KiFu</span>
          </Link>
          <nav aria-label="Hauptnavigation" className="flex flex-wrap items-center gap-1">
            {/* Schmal fehlen die Sprünge: Die Abschnitte folgen ohnehin untereinander. */}
            <KopfSprung href={`${start}#funktionen`}>Funktionen</KopfSprung>
            <KopfSprung href={`${start}#ki`}>KI-Assistent</KopfSprung>
            <KopfSprung href={`${start}#preise`}>Preise</KopfSprung>
            {user ? (
              <ButtonLink href="/" variant="filled">
                Zur App
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="text">
                  Anmelden
                </ButtonLink>
                {/* Schmal steht «Kostenlos registrieren» gleich darunter im Einstieg. Die
                    Hülle blendet aus: Am Knopf selbst stünde `hidden` neben seinem `inline-flex`. */}
                <span className="hidden sm:contents">
                  <ButtonLink href="/registrieren" variant="filled">
                    Kostenlos registrieren
                  </ButtonLink>
                </span>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-linie">
        <div className="type-body-small mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-4 px-4 py-6 text-on-surface-mittel sm:px-6">
          <p>KiFu · Open Source unter CC BY-SA 4.0</p>
          <nav aria-label="Weiteres" className="flex flex-wrap gap-x-6 gap-y-2">
            <FussLink href="/versionen">Versionen</FussLink>
            <FussLink href="/cookies">Cookies</FussLink>
            {RECHTLICHE_LINKS.map((l) => (
              <FussLink key={l.href} href={l.href}>
                {l.label}
              </FussLink>
            ))}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring rounded-klein text-primary hover:underline"
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
    <Link href={href} className="focus-ring rounded-klein text-primary hover:underline">
      {children}
    </Link>
  );
}

/** Ein Sprung zu einem Abschnitt der Startseite in der Kopfzeile (ab mittlerer Breite). */
function KopfSprung({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="state focus-ring type-title-small hidden h-9 items-center rounded-flaeche px-3 font-medium text-on-surface-mittel md:inline-flex"
    >
      {children}
    </Link>
  );
}
