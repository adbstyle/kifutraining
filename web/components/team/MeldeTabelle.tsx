import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { GruppenTabelle, SortierWahl, type SortierOption } from "@/components/ui";
import { SchnupperLozenge } from "@/components/spieler/SchnupperLozenge";
import { adresseMitWerten, type AdressParameter } from "@/lib/adresse";
import { cn } from "@/lib/cn";
import { dauerText, MELDE_TEXT, MELDEARTEN, type MeldeMediane } from "@/lib/meldezeitpunkte";
import { spielerName, type Spieler } from "@/lib/spieler";
import { SPIELER_AUSWAHL_PARAM, TEILNAHME_TEXT } from "@/lib/teilnahme";
import {
  MELDE_SPALTEN,
  naechsteTabellenSortierung,
  tabellenSortierHref,
  type MeldeSpalte,
  type TabellenSortierung,
} from "@/lib/team-tabellen";

/* Die Meldezeitpunkte je Spieler:in (#703, Variante M2): der Median vor
   Beginn bzw. Anpfiff in drei Spalten unter «Median vor Beginn» (AK 1–3),
   sortierbar (AK 11); schmal als Karten mit «Sortieren nach». Die Zeilen
   kommen sortiert und eingegrenzt vom Server; «keine Angabe» (AK 4) steht
   gedämpft und beim Sortieren zuletzt.

   Der Name öffnet daneben die Teilnahme der Spieler:in — dieselbe Adresse
   mit `?spieler=`, Eingrenzung, Zeitraum und Sortierung bleiben (AK 12).
   Keine Wertung: keine Ampel, keine Grenze für «zu spät». */

export type MeldeTabellenZeile = { spieler: Spieler; mediane: MeldeMediane };

function Dauer({ sekunden }: { sekunden: number | null }) {
  return <span className={sekunden === null ? "text-on-surface-mittel" : undefined}>{dauerText(sekunden)}</span>;
}

export function MeldeTabelle({
  zeilen,
  sortierung,
  pfad,
  sp,
  ausgewaehlt,
  zeitraumText,
}: {
  zeilen: readonly MeldeTabellenZeile[];
  sortierung: TabellenSortierung<MeldeSpalte>;
  /** Die Seite, auf der die Tabelle steht — Ziel aller Links. */
  pfad: string;
  sp: AdressParameter;
  ausgewaehlt: string | null;
  /** Der gewählte Zeitraum als Text; `null`: die ganze Zeit im Team. */
  zeitraumText: string | null;
}) {
  const href = (s: TabellenSortierung<MeldeSpalte>) => tabellenSortierHref(pfad, sp, s, MELDE_SPALTEN);
  const kopf = (spalte: MeldeSpalte) => ({
    href: href(naechsteTabellenSortierung(sortierung, spalte, MELDE_SPALTEN)),
    richtung: sortierung.spalte === spalte ? sortierung.richtung : null,
  });
  const oeffnenHref = (id: string) =>
    adresseMitWerten(pfad, sp, { [SPIELER_AUSWAHL_PARAM]: id }) ?? tabellenSortierHref(pfad, sp, sortierung, MELDE_SPALTEN);

  // Schmal: erst die Spalten (eine neue beginnt mit ihrer ersten Richtung), dann die Richtung.
  const aktiv = MELDE_SPALTEN.find((s) => s.schluessel === sortierung.spalte)!;
  const optionen: SortierOption[] = [
    ...MELDE_SPALTEN.map((s) => ({
      label: s.label,
      gewaehlt: s.schluessel === sortierung.spalte,
      href: href(s.schluessel === sortierung.spalte ? sortierung : { spalte: s.schluessel, richtung: s.ersteRichtung }),
    })),
    { label: "Aufsteigend", gewaehlt: sortierung.richtung === "auf", href: href({ ...sortierung, richtung: "auf" }), trenner: true },
    { label: "Absteigend", gewaehlt: sortierung.richtung === "ab", href: href({ ...sortierung, richtung: "ab" }) },
  ];

  return (
    <GruppenTabelle
      beschriftung={MELDE_TEXT.tabelle(zeitraumText)}
      mindestbreite={640}
      kopf={{ label: TEILNAHME_TEXT.spielerin, ...kopf("name") }}
      spalten={MELDEARTEN.map((m) => ({
        schluessel: m,
        gruppe: MELDE_TEXT.gruppe,
        label: MELDE_TEXT.spalte[m],
        ...kopf(m),
      }))}
      zeilen={zeilen.map(({ spieler, mediane }) => ({
        id: spieler.id,
        gewaehlt: spieler.id === ausgewaehlt,
        kopf: (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={oeffnenHref(spieler.id)}
              scroll={false}
              aria-current={spieler.id === ausgewaehlt ? "true" : undefined}
              aria-label={TEILNAHME_TEXT.oeffnen(spielerName(spieler))}
              data-spieler-zeile={spieler.id}
              className={cn(
                "focus-ring rounded-klein type-body-medium hover:underline",
                spieler.id === ausgewaehlt ? "text-primary" : "text-on-surface",
              )}
            >
              {spielerName(spieler)}
            </Link>
            {spieler.probe && <SchnupperLozenge stand={spieler.probe} />}
          </span>
        ),
        zellen: MELDEARTEN.map((m) => <Dauer key={m} sekunden={mediane[m]} />),
      }))}
      schmal={
        <div className="flex flex-col gap-3">
          <SortierWahl
            className="self-start"
            praefix={TEILNAHME_TEXT.sortierenNach}
            spalte={aktiv.label}
            richtung={sortierung.richtung}
            optionen={optionen}
          />
          <ul className="divide-y divide-linie overflow-hidden rounded-flaeche bg-elev-01">
            {zeilen.map(({ spieler, mediane }) => {
              const gewaehlt = spieler.id === ausgewaehlt;
              return (
                <li key={spieler.id} className={cn("flex flex-col gap-1.5 pb-3 pl-4 pr-3 pt-1", gewaehlt && "betont")}>
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
                  <dl className="flex flex-col">
                    {MELDEARTEN.map((m) => (
                      <div key={m} className="flex items-baseline justify-between gap-3 py-0.5 type-body-small">
                        <dt className="text-on-surface-mittel">{MELDE_TEXT.spalte[m]}</dt>
                        <dd className="tabular-nums text-on-surface">
                          <Dauer sekunden={mediane[m]} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
      }
    />
  );
}
