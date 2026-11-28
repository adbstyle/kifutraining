import type { ReactNode } from "react";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";

/* Der Rahmen der Seiten des Vereins mit Liste (#707): Brotkrumen Verein ›
   Seite (`VEREIN_SEITEN`: «Teams», «Spieler:innen»), rechts daneben die
   Aktionen der Seite (`KopfAktionen`), wie auf den Seiten eines Teams
   (`TeamSeite`, #706). Eine weitere sichtbare Überschrift gibt es nicht; für
   Vorlesehilfen trägt der Rahmen «Teams im Verein «X»» bzw. «Spieler:innen im
   Verein «X»» unsichtbar (NFR 2).

   Den Verein holt die Seite selbst (sie braucht ihn für ihre Abfrage); der
   Rahmen bekommt nur seinen Namen. Die Verwaltungsseiten haben ihren eigenen
   Rahmen (Out of Scope 1). */
export function VereinSeite({
  vereinName,
  seite,
  aktionen,
  children,
}: {
  vereinName: string;
  seite: string;
  aktionen?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Seitenrahmen breite="voll" krumen={[{ label: vereinName }, { label: seite }]} aktionen={aktionen}>
      <h1 className="sr-only">
        {seite} im Verein «{vereinName}»
      </h1>
      {children}
    </Seitenrahmen>
  );
}
