import { GruppenTabelle, SortierWahl } from "@/components/ui";
import { SpielerKartenName, SpielerZeilenName } from "./SpielerTabellenName";
import type { AdressParameter } from "@/lib/adresse";
import { cn } from "@/lib/cn";
import { dauerText, MELDE_TEXT, MELDEARTEN, type MeldeMediane } from "@/lib/meldezeitpunkte";
import type { Spieler } from "@/lib/spieler";
import { TEILNAHME_TEXT } from "@/lib/teilnahme";
import { MELDE_SPALTEN, tabellenSortierung, type MeldeSpalte, type TabellenSortierung } from "@/lib/team-tabellen";

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
  const { kopf, oeffnenHref, aktivLabel, optionen } = tabellenSortierung(pfad, sp, sortierung, MELDE_SPALTEN);

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
        kopf: <SpielerZeilenName spieler={spieler} href={oeffnenHref(spieler.id)} gewaehlt={spieler.id === ausgewaehlt} />,
        zellen: MELDEARTEN.map((m) => <Dauer key={m} sekunden={mediane[m]} />),
      }))}
      schmal={
        <div className="flex flex-col gap-3">
          <SortierWahl
            className="self-start"
            praefix={TEILNAHME_TEXT.sortierenNach}
            spalte={aktivLabel}
            richtung={sortierung.richtung}
            optionen={optionen}
          />
          <ul className="divide-y divide-linie overflow-hidden rounded-flaeche bg-elev-01">
            {zeilen.map(({ spieler, mediane }) => {
              const gewaehlt = spieler.id === ausgewaehlt;
              return (
                <li key={spieler.id} className={cn("flex flex-col gap-1.5 pb-3 pl-4 pr-3 pt-1", gewaehlt && "betont")}>
                  <SpielerKartenName spieler={spieler} href={oeffnenHref(spieler.id)} gewaehlt={gewaehlt} />
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
