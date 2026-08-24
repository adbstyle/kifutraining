import { CornerDownRight } from "lucide-react";
import { cn } from "@/lib/cn";
// Eine Typ-Quelle: ein neuer Herkunftstyp in lib/fassung zwingt den Compiler,
// auch das quelle-Mapping hier zu ergänzen.
import type { HerkunftTyp } from "@/lib/fassung";

export type { HerkunftTyp };

export type HerkunftsDaten = {
  /** Name des Originals zum Zeitpunkt der Übernahme. */
  name: string;
  typ: HerkunftTyp;
  /** ISO-Zeitstempel der Übernahme; angezeigt wird das Datum. */
  datum: string;
};

const quelle: Record<HerkunftTyp, string> = {
  manual: "KiFu-Manual",
  community: "Community-Vorlage",
  eigen: "eigene Vorlage",
};

function datumKurz(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Woraus eine Kopie entstanden ist (Epic #72, Story 6).
 *
 * Die Angabe sagt „basiert auf" und gibt eine Bearbeitung nie als Original aus.
 * Sie nennt die ursprüngliche Quelle — Zwischenstationen einer Kopierkette
 * erscheinen nicht — und enthält bewusst keine Personenangabe. Kein Link: die
 * Kopie hängt vom Original nicht mehr ab, und dieses kann längst verändert oder
 * verschwunden sein.
 */
export function HerkunftsAngabe({
  herkunft,
  className,
}: {
  herkunft: HerkunftsDaten;
  className?: string;
}) {
  const datum = datumKurz(herkunft.datum);
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 type-body-small text-on-surface-variant",
        className,
      )}
    >
      <CornerDownRight size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        basiert auf <span className="text-on-surface">{herkunft.name}</span> (
        {quelle[herkunft.typ]}
        {datum && `, übernommen am ${datum}`})
      </span>
    </p>
  );
}
