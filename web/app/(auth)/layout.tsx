import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DarstellungsMarke } from "@/components/layout/DarstellungKontext";
import { DARSTELLUNG_COOKIE, leseDarstellung } from "@/lib/darstellung";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Die Wahl aus der App gilt auch hier (#567) — wählen lässt sie sich nur dort.
  const darstellung = leseDarstellung((await cookies()).get(DARSTELLUNG_COOKIE)?.value);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <DarstellungsMarke darstellung={darstellung} />
      <Link
        href="/"
        className="focus-ring type-label-medium mb-6 inline-flex items-center gap-1.5 rounded-flaeche text-on-surface-mittel transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        Zum Katalog
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
