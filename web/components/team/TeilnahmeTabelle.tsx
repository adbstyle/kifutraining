import Link from "next/link";
import { GruppenTabelle, SortierWahl, TeilnahmePunkt, type SortierOption } from "@/components/ui";
import { SchnupperLozenge } from "@/components/spieler/SchnupperLozenge";
import { SPALTEN_TON, TeilnahmeKarten, Zahl, type TeilnahmeTabellenZeile } from "./TeilnahmeKarte";
import { adresseMitWerten, type AdressParameter } from "@/lib/adresse";
import { cn } from "@/lib/cn";
import { spielerName } from "@/lib/spieler";
import { SPIELER_AUSWAHL_PARAM, TEILNAHME_TEXT, type TeilnahmeUebersichtZeile } from "@/lib/teilnahme";
import {
  TEILNAHME_SPALTEN,
  naechsteTabellenSortierung,
  tabellenSortierHref,
  type TabellenSortierung,
  type TeilnahmeSpalte,
} from "@/lib/team-tabellen";

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
  const href = (s: TabellenSortierung<TeilnahmeSpalte>) => tabellenSortierHref(pfad, sp, s, TEILNAHME_SPALTEN);
  const kopf = (spalte: TeilnahmeSpalte) => ({
    href: href(naechsteTabellenSortierung(sortierung, spalte, TEILNAHME_SPALTEN)),
    richtung: sortierung.spalte === spalte ? sortierung.richtung : null,
  });
  const oeffnenHref = (id: string) =>
    adresseMitWerten(pfad, sp, { [SPIELER_AUSWAHL_PARAM]: id }) ?? tabellenSortierHref(pfad, sp, sortierung, TEILNAHME_SPALTEN);
  const zahlSpalten = TEILNAHME_SPALTEN.filter(
    (s): s is (typeof TEILNAHME_SPALTEN)[number] & { schluessel: keyof TeilnahmeUebersichtZeile; gruppe: string } =>
      s.schluessel !== "name",
  );

  // Schmal: erst die Spalten (eine neue beginnt mit ihrer ersten Richtung), dann die Richtung.
  const aktiv = TEILNAHME_SPALTEN.find((s) => s.schluessel === sortierung.spalte)!;
  const beschriftung = (s: (typeof TEILNAHME_SPALTEN)[number]) => (s.gruppe ? `${s.gruppe}: ${s.label}` : s.label);
  const optionen: SortierOption[] = [
    ...TEILNAHME_SPALTEN.map((s) => ({
      label: beschriftung(s),
      gewaehlt: s.schluessel === sortierung.spalte,
      href: href(s.schluessel === sortierung.spalte ? sortierung : { spalte: s.schluessel, richtung: s.ersteRichtung }),
    })),
    { label: "Aufsteigend", gewaehlt: sortierung.richtung === "auf", href: href({ ...sortierung, richtung: "auf" }), trenner: true },
    { label: "Absteigend", gewaehlt: sortierung.richtung === "ab", href: href({ ...sortierung, richtung: "ab" }) },
  ];

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
        zellen: zahlSpalten.map((s) => <Zahl key={s.schluessel} wert={werte[s.schluessel]} />),
      }))}
      schmal={
        <div className="flex flex-col gap-3">
          <SortierWahl
            className="self-start"
            praefix={TEILNAHME_TEXT.sortierenNach}
            spalte={beschriftung(aktiv)}
            richtung={sortierung.richtung}
            optionen={optionen}
          />
          <TeilnahmeKarten zeilen={zeilen} oeffnenHref={oeffnenHref} ausgewaehlt={ausgewaehlt} />
        </div>
      }
    />
  );
}
