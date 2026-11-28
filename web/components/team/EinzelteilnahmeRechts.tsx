import { SpielerTeilnahmeSpalte } from "./SpielerTeilnahmeSpalte";
import { adresseMitWerten, type AdressParameter } from "@/lib/adresse";
import { kaderVon } from "@/lib/kader";
import { SPIELER_AUSWAHL_PARAM } from "@/lib/teilnahme";
import type { SpielerAnsicht } from "@/lib/team-spieler-seite";
import { heuteAmTrainingsort } from "@/lib/zeit";

/* Die Teilnahme der gewählten Spieler:in rechts neben einer Sicht unter
   «Spieler:innen» (#700, #704): dieselbe Spalte in jeder Sicht, die eine
   Spieler:in wählen lässt. Schliessen führt auf dieselbe Adresse ohne
   Spieler:in — Eingrenzung und Zeitraum bleiben. Ohne Wahl nichts; die Seite
   reicht sie dann gar nicht erst als `rechts` an `ListeMitDetail`, sonst
   teilte sich die Fläche für eine leere Spalte. */
export function EinzelteilnahmeRechts({ ansicht, sp }: { ansicht: SpielerAnsicht; sp: AdressParameter }) {
  const { ausgewaehlt, teilnahme, kader, pfad } = ansicht;
  if (!ausgewaehlt || !teilnahme) return null;
  return (
    <SpielerTeilnahmeSpalte
      teilnahme={teilnahme}
      jahrgang={ausgewaehlt.jahrgang}
      kaderNamen={kaderVon(ausgewaehlt.id, kader).map((k) => k.name)}
      heute={heuteAmTrainingsort()}
      schliessenHref={adresseMitWerten(pfad, sp, { [SPIELER_AUSWAHL_PARAM]: "" }) ?? pfad}
    />
  );
}
