import type { ReactNode } from "react";
import { Users } from "lucide-react";
import { Leerzustand } from "@/components/ui";
import { ListeMitDetail } from "@/components/layout/ListeMitDetail";
import { EinzelteilnahmeRechts } from "./EinzelteilnahmeRechts";
import { TeamSpielerFilter } from "./TeamSpielerFilter";
import { TeilnahmeLeer } from "./TeilnahmeLeer";
import { TeilnahmeZeitraum } from "./TeilnahmeZeitraum";
import { TabellenAuswahl } from "@/components/training/TabellenAuswahl";
import type { AdressParameter } from "@/lib/adresse";
import { TEILNAHME_TEXT } from "@/lib/teilnahme";
import type { SpielerAnsicht } from "@/lib/team-spieler-seite";
import { jahrgaengeDerListe } from "@/lib/team-spielerliste";

/* Das Gerüst der Reiter mit sortierbarer Tabelle unter «Spieler:innen»
 * («Teilnahme» #702, «Meldezeitpunkte» #703): links Eingrenzung und Zeitraum
 * über der Tabelle, rechts die Teilnahme der gewählten Spieler:in. Ohne
 * Spieler:innen im Team steht ein Leerzustand, trifft die Eingrenzung
 * niemanden, das Leerfeld mit dem Weg zurück (`TeilnahmeLeer`). Was die
 * Sicht zeigt (`vorTabelle`, `tabelle`, `fussnote`), gibt die Seite. */
export function SpielerTabellenSeite({
  ansicht,
  sp,
  heute,
  keineSpielerText,
  leer,
  vorTabelle,
  tabelle,
  fussnote,
}: {
  ansicht: SpielerAnsicht;
  sp: AdressParameter;
  heute: string;
  /** Der Text des Leerzustands ohne Spieler:innen im Team. */
  keineSpielerText: string;
  /** Die Eingrenzung trifft niemanden. */
  leer: boolean;
  /** Was über der Tabelle steht (Meldezeitpunkte: die Teamzahlen). */
  vorTabelle?: ReactNode;
  tabelle: ReactNode;
  fussnote: string;
}) {
  return (
    <ListeMitDetail
      spaltenName="Teilnahme"
      links={
        <div className="flex flex-col gap-4">
          {ansicht.spieler.length === 0 ? (
            <Leerzustand icon={Users} titel={TEILNAHME_TEXT.keineSpieler}>
              {keineSpielerText}
            </Leerzustand>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <TeamSpielerFilter
                  className=""
                  eingrenzung={ansicht.eingrenzung}
                  kader={ansicht.kader}
                  jahrgaenge={jahrgaengeDerListe(ansicht.spieler)}
                />
                <TeilnahmeZeitraum zeitraum={ansicht.zeitraum} heute={heute} />
              </div>
              {leer ? (
                <TeilnahmeLeer />
              ) : (
                <>
                  {vorTabelle}
                  {/* Fokus und Sichtbarkeit beim Öffnen und Schliessen der Teilnahme daneben. */}
                  <TabellenAuswahl ausgewaehlt={ansicht.ausgewaehlt?.id} attribut="data-spieler-zeile" />
                  <TabellenAuswahl ausgewaehlt={ansicht.ausgewaehlt?.id} attribut="data-spieler-karte" />
                  {tabelle}
                  <p className="type-body-small text-on-surface-mittel">{fussnote}</p>
                </>
              )}
            </>
          )}
        </div>
      }
      // `ListeMitDetail` teilt die Fläche nur mit einem Detail; ohne Wahl bleibt `rechts` leer.
      rechts={ansicht.teilnahme && <EinzelteilnahmeRechts ansicht={ansicht} sp={sp} />}
    />
  );
}
