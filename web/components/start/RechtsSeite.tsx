import type { ReactNode } from "react";
import Link from "next/link";
import { SectionMessage } from "@/components/ui";
import { ENTWURF_HINWEIS, KONTAKT_EMAIL, RECHTLICHES_STAND } from "@/lib/rechtliches";

/* Gerüst von Impressum, Datenschutzerklärung (#672) und Vereinbarung zur
   Auftragsbearbeitung (#675; `fassung` nennt ihre Fassung): Titel, Stand und —
   bis die Rechtsberatung den Text geprüft hat — der Entwurfshinweis, danach
   die Abschnitte als ruhiger Fliesstext in einer lesbaren Spalte. Kein neuer
   Baustein im Kit: SectionMessage für den Hinweis, sonst Typo-Rollen. */
export function RechtsSeite({ titel, fassung, children }: { titel: string; fassung?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="type-headline-medium text-on-surface">{titel}</h1>
      <p className="type-body-small mt-1 text-on-surface-tief">
        Stand: {RECHTLICHES_STAND}
        {fassung && <> · Fassung {fassung}</>}
      </p>
      <SectionMessage appearance="warning" className="mt-6">
        {ENTWURF_HINWEIS} Die Rechtsberatung prüft den Text, bevor er gilt. Angaben in eckigen Klammern sind
        Platzhalter.
      </SectionMessage>
      <div className="mt-8 flex flex-col gap-8">{children}</div>
    </article>
  );
}

/** Ein Abschnitt mit Überschrift; der Inhalt steht als Absätze und Listen. */
export function RechtsAbschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-title-large text-on-surface">{titel}</h2>
      <div className="type-body-medium flex flex-col gap-3 text-on-surface [&_li]:ml-5 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </section>
  );
}

/** Ein Platzhalter, bis die Trägerschaft gegründet ist — sichtbar markiert. */
export function Platzhalter({ children }: { children: ReactNode }) {
  return <span className="rounded-klein bg-section-warning px-1">{children}</span>;
}

/** Die E-Mail-Adresse für Anfragen als Link. */
export function KontaktAdresse() {
  return (
    <a href={`mailto:${KONTAKT_EMAIL}`} className={LINK_KLASSE}>
      {KONTAKT_EMAIL}
    </a>
  );
}

/** Ein Verweis innerhalb von KiFu im Fliesstext (wie ExternerLink, ohne «extern»). */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={LINK_KLASSE}>
      {children}
    </Link>
  );
}

const LINK_KLASSE = "focus-ring rounded-klein text-primary underline decoration-1 underline-offset-[3px] hover:decoration-2";
