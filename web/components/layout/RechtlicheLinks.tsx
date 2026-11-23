import Link from "next/link";
import { cn } from "@/lib/cn";
import { RECHTLICHE_LINKS } from "@/lib/rechtliches";

/* Impressum und Datenschutz als leise Textlinks (#672 AK 1) — auf den
   Anmeldeseiten und am privaten Link, wo es keine Fusszeile der Startseite
   gibt. `davor` nimmt weitere Links derselben Reihe auf (z. B. «Cookies»). */
export function RechtlicheLinks({ davor, className }: { davor?: React.ReactNode; className?: string }) {
  return (
    <nav aria-label="Rechtliches" className={cn("type-body-small flex flex-wrap gap-x-5 gap-y-2", className)}>
      {davor}
      {RECHTLICHE_LINKS.map((l) => (
        <RechtsLink key={l.href} href={l.href}>
          {l.label}
        </RechtsLink>
      ))}
    </nav>
  );
}

export function RechtsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="focus-ring rounded-flaeche text-on-surface-tief transition-colors hover:text-on-surface">
      {children}
    </Link>
  );
}
