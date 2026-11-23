import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DarstellungsMarke } from "@/components/layout/DarstellungKontext";
import { KONTO_APP_METADATA } from "@/lib/app-ablegen";
import { DARSTELLUNG_COOKIE, leseDarstellung } from "@/lib/darstellung";

/* Auch von der Anmeldung aus lässt sich KiFu als App ablegen (#651); sie
   startet auf «/» und geht von dort in den Arbeitsbereich (#671), ohne
   Anmeldung auf die Startseite. */
export const metadata: Metadata = KONTO_APP_METADATA;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Die Wahl aus der App gilt auch hier (#567) — wählen lässt sie sich nur dort.
  const darstellung = leseDarstellung((await cookies()).get(DARSTELLUNG_COOKIE)?.value);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <DarstellungsMarke darstellung={darstellung} />
      {/* Ohne Anmeldung der Weg zurück auf die Startseite (#670 AK 11). */}
      <Link
        href="/"
        className="focus-ring type-label-medium mb-6 inline-flex items-center gap-1.5 rounded-flaeche text-on-surface-mittel transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        Zur Startseite
      </Link>
      {children}
      {/* Auch hier legt KiFu Cookies ab (die Anmeldung) — die Seite dazu (#409). */}
      <Link
        href="/cookies"
        className="focus-ring type-body-small mt-8 self-start rounded-flaeche text-on-surface-tief transition-colors hover:text-on-surface"
      >
        Cookies
      </Link>
    </main>
  );
}
