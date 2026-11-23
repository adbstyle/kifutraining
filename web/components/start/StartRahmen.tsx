import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { DarstellungsMarke } from "@/components/layout/DarstellungKontext";
import { RECHTLICHE_LINKS } from "@/lib/rechtliches";
import { STARTSEITE_PFAD } from "@/lib/navigation";
import { REPO_URL } from "@/lib/startseite";

/* Der Rahmen der Startseite (#670): klebende Kopfzeile, Fusszeile, immer hell.
   Er trägt die Gruppe (start) und ohne Konto auch die übrigen Seiten, die man
   ohne Anmeldung erreicht (404, Cookies, Versionen): Ohne Konto gibt es keine
   Seitenleiste der App, deren Einträge ohnehin nur zum Hinweis «nur mit Konto»
   führten (PO 2026-11-23). */
export function StartRahmen({
  angemeldet,
  eigenesMain = false,
  children,
}: {
  angemeldet: boolean;
  /** Die Seiten bringen ihr `<main>` selbst mit (Seitenrahmen der App) — dann
   *  setzt der Rahmen keinen zweiten Hauptbereich darum. */
  eigenesMain?: boolean;
  children: React.ReactNode;
}) {
  // Die Sprünge zu den Abschnitten der Startseite: ohne Anmeldung liegt sie auf
  // «/», angemeldet führte «/» in den Arbeitsbereich (#671).
  const start = angemeldet ? STARTSEITE_PFAD : "/";
  return (
    <div className="start-palette flex min-h-dvh flex-col bg-elev-01">
      <DarstellungsMarke darstellung="hell" />
      {/* Klebt oben (PO): Der Inhalt scrollt darunter durch, Navigation und «Zur App»/Anmelden bleiben erreichbar. */}
      <header className="sticky top-0 z-30 border-b border-linie bg-elev-01">
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
            {angemeldet ? (
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
      {eigenesMain ? <div className="flex-1">{children}</div> : <main className="flex-1">{children}</main>}
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
