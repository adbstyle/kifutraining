import { GruppenTabelle, SortierWahl, TeilnahmePunkt } from "@/components/ui";
import { SpielerZeilenName } from "./SpielerTabellenName";
import { SPALTEN_TON, TeilnahmeKarten, Zahl, type TeilnahmeTabellenZeile } from "./TeilnahmeKarte";
import type { AdressParameter } from "@/lib/adresse";
import { TEILNAHME_TEXT, type TeilnahmeUebersichtZeile } from "@/lib/teilnahme";
import { TEILNAHME_SPALTEN, tabellenSortierung, type TabellenSortierung, type TeilnahmeSpalte } from "@/lib/team-tabellen";

/* Die Teilnahme aller Spieler:innen eines Teams (#702) als Tabelle mit den
   Gruppen «Trainings» und «Spiele» (Variante S1), schmal als Karten mit
   «Sortieren nach». Die Zeilen kommen sortiert und eingegrenzt vom Server;
   hier stehen nur die Spalten, wonach sortiert ist und die Links.

   Der Name öffnet daneben die Teilnahme der Spieler:in (AK 8) — dieselbe
   Adresse mit `?spieler=`, Eingrenzung, Zeitraum und Sortierung bleiben
   (AK 9). Keine Wertung (OoS 1): keine Ampel, keine Rangliste; die
   Farbpunkte an den Spaltenköpfen sind die der Einzelteilnahme und sagen nur,
   welcher Anteil von «nicht da» gemeint ist. */

export function TeilnahmeTabelle({
  zeilen,
  sortierung,
  pfad,
  sp,
  ausgewaehlt,
  zeitraumText,
}: {
  zeilen: readonly TeilnahmeTabellenZeile[];
  sortierung: TabellenSortierung<TeilnahmeSpalte>;
  /** Die Seite, auf der die Tabelle steht — Ziel aller Links. */
  pfad: string;
  sp: AdressParameter;
  ausgewaehlt: string | null;
  /** Der gewählte Zeitraum als Text; `null`: die ganze Zeit im Team. */
  zeitraumText: string | null;
}) {
  // Schmal nennt «Sortieren nach» die Spalte mit ihrer Gruppe.
  const { kopf, oeffnenHref, aktivLabel, optionen } = tabellenSortierung(pfad, sp, sortierung, TEILNAHME_SPALTEN, (s) =>
    s.gruppe ? `${s.gruppe}: ${s.label}` : s.label,
  );
  const zahlSpalten = TEILNAHME_SPALTEN.filter(
    (s): s is (typeof TEILNAHME_SPALTEN)[number] & { schluessel: keyof TeilnahmeUebersichtZeile; gruppe: string } =>
      s.schluessel !== "name",
  );

  return (
    <GruppenTabelle
      beschriftung={TEILNAHME_TEXT.tabelle(zeitraumText)}
      mindestbreite={840}
      kopf={{ label: TEILNAHME_TEXT.spielerin, ...kopf("name") }}
      spalten={zahlSpalten.map((s) => ({
        schluessel: s.schluessel,
        gruppe: s.gruppe,
        label: (
          <span className="inline-flex items-center gap-1.5">
            {SPALTEN_TON[s.schluessel] && <TeilnahmePunkt ton={SPALTEN_TON[s.schluessel]!} />}
            {s.label}
          </span>
        ),
        ...kopf(s.schluessel),
      }))}
      zeilen={zeilen.map(({ spieler, werte }) => ({
        id: spieler.id,
        gewaehlt: spieler.id === ausgewaehlt,
        kopf: <SpielerZeilenName spieler={spieler} href={oeffnenHref(spieler.id)} gewaehlt={spieler.id === ausgewaehlt} />,
        zellen: zahlSpalten.map((s) => <Zahl key={s.schluessel} wert={werte[s.schluessel]} />),
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
          <TeilnahmeKarten zeilen={zeilen} oeffnenHref={oeffnenHref} ausgewaehlt={ausgewaehlt} />
        </div>
      }
    />
  );
}
