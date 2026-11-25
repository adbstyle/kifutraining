"use client";

import { Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { absageOffen, eigenerStand, standText } from "@/lib/trainer";
import { datumKurz, terminBegonnen } from "@/lib/zeit";
import { useTerminAktionen } from "./TerminBereich";
import type { TerminZeile } from "@/lib/queries/termine-fuer";

/** Der eigene Stand an einem Termin als Schalter (#691; Tafel «A · Schalter»):
 *  an heisst dabei, aus nicht dabei — abgesagt mit gefülltem Knopf, nicht
 *  eingeladen mit leerem (`leer`). Umlegen sagt ab, wieder zu oder hilft aus,
 *  in einem Schritt. Ab Beginn und an einem ausgefallenen Termin gesperrt,
 *  der Stand bleibt lesbar. `jetzt`: der Stand beim Laden, damit Server und
 *  Browser gleich rechnen; beim Umlegen zählt die Uhr. Positioniert, damit er
 *  über der Fläche einer Zeile liegt. */
export function EigenerStand({ t, jetzt, className }: { t: TerminZeile; jetzt: string; className?: string }) {
  const a = useTerminAktionen();
  const stand = eigenerStand(t.trainer, a.ich);
  const offen = absageOffen(t, terminBegonnen(t.datum, t.beginn, jetzt));
  return (
    <Switch
      checked={stand === "dabei"}
      leer={stand === "nichtEingeladen"}
      disabled={!offen}
      zeigtStand
      aria-label={standText(stand, `${datumKurz(t.datum)}, ${t.beginn.slice(0, 5)}`)}
      onChange={(e) => a.schalten(t, e.target.checked)}
      className={cn("pointer-events-auto relative", className)}
    />
  );
}
