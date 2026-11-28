import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TeilnahmePunkt, type TeilnahmeTon } from "@/components/ui";
import { SchnupperLozenge } from "@/components/spieler/SchnupperLozenge";
import { cn } from "@/lib/cn";
import { spielerName, type Spieler } from "@/lib/spieler";
import { TEILNAHME_TEXT, type TeilnahmeUebersichtZeile } from "@/lib/teilnahme";
import { TEILNAHME_SPALTEN } from "@/lib/team-tabellen";

/* Die Teilnahme aller Spieler:innen schmal (#702, Telefon-Prototyp): je
   Spieler:in eine Karte mit dem Namen als Link auf ihre Teilnahme und den
   Blöcken «Trainings» und «Spiele» mit denselben Zahlen wie die Spalten der
   Tabelle — dieselbe Reihenfolge, dieselben Namen, dieselben Farbpunkte.
   Sortiert wird über «Sortieren nach» darüber (`SortierWahl`). */

/** Der Farbpunkt einer Spalte — derselbe Ton wie in der Einzelteilnahme. */
export const SPALTEN_TON: Partial<Record<keyof TeilnahmeUebersichtZeile, TeilnahmeTon>> = {
  tDa: "da",
  tOhne: "orange",
  gDa: "da",
  gOhne: "orange",
  gNa: "violett",
  gNg: "blau",
};

export type TeilnahmeTabellenZeile = { spieler: Spieler; werte: TeilnahmeUebersichtZeile };

/** Eine Zahl; 0 steht gedämpft — ohne Wertung, nur leiser. */
export function Zahl({ wert }: { wert: number }) {
  return <span className={wert === 0 ? "text-on-surface-mittel" : undefined}>{wert}</span>;
}

const GRUPPEN = [TEILNAHME_TEXT.training, TEILNAHME_TEXT.spiel] as const;

export function TeilnahmeKarten({
  zeilen,
  oeffnenHref,
  ausgewaehlt,
}: {
  zeilen: readonly TeilnahmeTabellenZeile[];
  oeffnenHref: (id: string) => string;
  ausgewaehlt: string | null;
}) {
  return (
    <ul className="divide-y divide-linie overflow-hidden rounded-flaeche bg-elev-01">
      {zeilen.map(({ spieler, werte }) => {
        const gewaehlt = spieler.id === ausgewaehlt;
        return (
          <li key={spieler.id} className={cn("flex flex-col gap-2 pb-3 pl-4 pr-3 pt-1", gewaehlt && "betont")}>
            <Link
              href={oeffnenHref(spieler.id)}
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
            {GRUPPEN.map((gruppe) => (
              <div key={gruppe} className="flex flex-col gap-1">
                <p className="border-b border-linie pb-1 type-label-small font-semibold text-on-surface-mittel">{gruppe}</p>
                <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
                  {TEILNAHME_SPALTEN.filter((s) => s.gruppe === gruppe).map((s) => {
                    const k = s.schluessel as keyof TeilnahmeUebersichtZeile;
                    const ton = SPALTEN_TON[k];
                    return (
                      // Die Bezeichnung oben, unten bündig, damit die Zahlen einer Zeile auf einer Linie stehen.
                      <div key={k} className="flex flex-col justify-end gap-0.5">
                        <dt className="flex min-h-8 items-end type-body-small text-on-surface-mittel">
                          <span>
                            {ton && <TeilnahmePunkt ton={ton} />} {s.label}
                          </span>
                        </dt>
                        <dd className="type-title-medium tabular-nums text-on-surface">
                          <Zahl wert={werte[k]} />
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </li>
        );
      })}
    </ul>
  );
}
