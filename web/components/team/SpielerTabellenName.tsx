import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SchnupperLozenge } from "@/components/spieler/SchnupperLozenge";
import { cn } from "@/lib/cn";
import { spielerName, type Spieler } from "@/lib/spieler";
import { TEILNAHME_TEXT } from "@/lib/teilnahme";

/* Der Name einer Spieler:in in den sortierbaren Tabellen unter «Spieler:innen»
   (#702 Teilnahme, #703 Meldezeitpunkte): ein Link, der daneben ihre
   Teilnahme öffnet, mit dem Schnupper-Hinweis dahinter. Breit als Zeilenkopf
   (`data-spieler-zeile`), schmal als Kopf der Karte (`data-spieler-karte`);
   beide Attribute liest `TabellenAuswahl` für Fokus und Sichtbarkeit. */

type Props = { spieler: Spieler; href: string; gewaehlt: boolean };

/** Der Zeilenkopf der Tabelle. */
export function SpielerZeilenName({ spieler, href, gewaehlt }: Props) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Link
        href={href}
        scroll={false}
        aria-current={gewaehlt ? "true" : undefined}
        aria-label={TEILNAHME_TEXT.oeffnen(spielerName(spieler))}
        data-spieler-zeile={spieler.id}
        className={cn("focus-ring rounded-klein type-body-medium hover:underline", gewaehlt ? "text-primary" : "text-on-surface")}
      >
        {spielerName(spieler)}
      </Link>
      {spieler.probe && <SchnupperLozenge stand={spieler.probe} />}
    </span>
  );
}

/** Der Kopf einer Karte schmal: der ganze Kopf ist der Link, mit Chevron. */
export function SpielerKartenName({ spieler, href, gewaehlt }: Props) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={gewaehlt ? "true" : undefined}
      aria-label={TEILNAHME_TEXT.oeffnen(spielerName(spieler))}
      data-spieler-karte={spieler.id}
      className="focus-ring state -mr-2 flex min-h-11 items-center gap-2 rounded-klein text-on-surface"
    >
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cn("type-title-small", gewaehlt && "text-primary")}>{spielerName(spieler)}</span>
        {spieler.probe && <SchnupperLozenge stand={spieler.probe} />}
      </span>
      <ChevronRight size={20} strokeWidth={2} aria-hidden className="shrink-0 text-on-surface-mittel" />
    </Link>
  );
}
