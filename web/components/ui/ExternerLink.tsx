import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";

const KLASSE =
  "focus-ring rounded-klein text-primary underline decoration-1 underline-offset-[3px] hover:decoration-2";

/**
 * Ein Verweis, der KiFu verlässt (#533): wie ein Link im Fliesstext — Primary,
 * unterstrichen — und am Textende das Zeichen «extern», damit man vor dem
 * Antippen sieht, dass sich etwas ausserhalb öffnet (AK 11). Öffnet in einem
 * neuen Tab und gibt weder die Seite, von der er kommt, noch das Fenster
 * preis (AK 9).
 *
 * Neu, weil `ButtonLink` nur innerhalb der Anwendung führt (`next/link`).
 * `einzeilig` kürzt einen langen Text mit «…», das Zeichen bleibt sichtbar
 * (#533 PC 5); sonst bricht der Text um und das Zeichen folgt dem letzten Wort.
 */
export function ExternerLink({
  href,
  children,
  einzeilig = false,
  className,
}: {
  href: string;
  children: ReactNode;
  einzeilig?: boolean;
  className?: string;
}) {
  const ziel = { href, target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" } as const;
  const hinweis = <span className="sr-only"> (öffnet ausserhalb von KiFu)</span>;
  if (einzeilig)
    return (
      <a {...ziel} className={cn(KLASSE, "inline-flex max-w-full items-center gap-1", className)}>
        <span className="min-w-0 truncate">{children}</span>
        <ExternalLink size={14} className="shrink-0" aria-hidden />
        {hinweis}
      </a>
    );
  return (
    <a {...ziel} className={cn(KLASSE, "break-words", className)}>
      {children}
      <ExternalLink size={14} className="ml-1 inline-block align-[-2px]" aria-hidden />
      {hinweis}
    </a>
  );
}
