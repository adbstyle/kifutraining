import type { ReactNode } from "react";
import { SortierKopf } from "./SortierKopf";
import { cn } from "@/lib/cn";

/* Eine echte Tabelle mit Spaltengruppen (Teilnahme der Spieler:innen, #702,
   Variante S1): über den sortierbaren Spaltenköpfen eine zweite Kopfzeile mit
   den Gruppen (`<th scope="colgroup">`), etwa «Trainings» und «Spiele».
   Atlassian kennt keine Spaltengruppen; die zweite Kopfzeile ist eine
   bewusste Abweichung (PO 2026-11-28), weil dieselben Spaltennamen («Da»,
   «Nicht da») in beiden Gruppen stehen und erst die Gruppe sie unterscheidet.
   Eine Linie über die ganze Höhe trennt die Gruppen.

   Neu im Kit, weil `SortierKopf` bisher nur in einer einzeiligen Tabelle
   stand (Trainingsübersicht) und die `Tabelle` eine Liste ist, die weder
   Gruppen noch Sortierung vorlesen kann. Die Köpfe bleiben `SortierKopf`,
   unverändert: Links, die die Sortierung in die Adresse schreiben — der
   Aufrufer rechnet die Adressen und reicht die Zeilen sortiert herein. Die
   Tabelle bleibt domänenfrei.

   - Die erste Spalte (Kopf jeder Zeile, `<th scope="row">`) bleibt beim
     waagrechten Scrollen stehen (sticky); die Tabelle hat eine
     Mindestbreite und scrollt in ihrer Fläche, nie die Seite.
   - Zahlen stehen rechtsbündig in gleich breiten Ziffern; die Spalte, nach
     der sortiert ist, steht etwas kräftiger.
   - Die gewählte Zeile ist betont wie in der Trainingsübersicht; die
     klebende Zelle trägt die Betonung als eigene Ebene, weil sie deckend
     sein muss.
   - Schmaler als 36 rem (Container-Abfrage: auch neben einem Detail) steht
     statt der Tabelle `schmal` — etwa Karten mit einer Sortierwahl. */

export type GruppenTabellenSpalte = {
  schluessel: string;
  label: ReactNode;
  /** Die Gruppe der oberen Kopfzeile; aufeinanderfolgende Spalten derselben
   *  Gruppe teilen sich einen Kopf. */
  gruppe: string;
  /** Die Adresse, die ein Klick auf den Kopf wählt; ohne: nicht sortierbar. */
  href?: string;
  /** Die Richtung, wenn nach dieser Spalte sortiert ist. */
  richtung?: "auf" | "ab" | null;
};

export type GruppenTabellenZeile = {
  id: string;
  /** Der Kopf der Zeile (meist ein Link mit dem Namen). */
  kopf: ReactNode;
  /** Je Spalte ein Wert, in der Folge von `spalten`. */
  zellen: ReactNode[];
  gewaehlt?: boolean;
};

export function GruppenTabelle({
  beschriftung,
  kopf,
  spalten,
  zeilen,
  mindestbreite,
  schmal,
  className,
}: {
  /** Die Beschriftung der Tabelle für Vorlesehilfen (`<caption>`). */
  beschriftung: string;
  /** Der Kopf der ersten Spalte, wahlweise sortierbar. */
  kopf: { label: ReactNode; href?: string; richtung?: "auf" | "ab" | null };
  spalten: readonly GruppenTabellenSpalte[];
  zeilen: readonly GruppenTabellenZeile[];
  /** Die Mindestbreite der Tabelle in Pixel; darunter scrollt sie waagrecht. */
  mindestbreite: number;
  /** Was schmal (unter 36 rem) statt der Tabelle steht. */
  schmal: ReactNode;
  className?: string;
}) {
  // `schluessel`: die erste Spalte der Gruppe — eindeutig, auch wenn eine Gruppe zweimal vorkommt.
  const gruppen: { label: string; anzahl: number; schluessel: string }[] = [];
  for (const s of spalten) {
    const letzte = gruppen.at(-1);
    if (letzte && letzte.label === s.gruppe) letzte.anzahl++;
    else gruppen.push({ label: s.gruppe, anzahl: 1, schluessel: s.schluessel });
  }
  const gruppenStart = (i: number) => i === 0 || spalten[i - 1].gruppe !== spalten[i].gruppe;
  const grenze = (i: number) => (gruppenStart(i) ? "border-l border-linie pl-4" : "");

  return (
    <div className={cn("@container/gruppentabelle", className)}>
      <div className="@xl/gruppentabelle:hidden">{schmal}</div>
      <div className="hidden overflow-x-auto rounded-flaeche bg-elev-01 @xl/gruppentabelle:block">
        <table className="w-full border-collapse" style={{ minWidth: mindestbreite }}>
          <caption className="sr-only">{beschriftung}</caption>
          <thead>
            <tr>
              {/* Über dem Namen keine Gruppe. */}
              <td className="sticky left-0 z-10 bg-elev-01" />
              {gruppen.map((g) => (
                <th
                  key={g.schluessel}
                  scope="colgroup"
                  colSpan={g.anzahl}
                  className="border-l border-linie px-4 pt-3 text-left align-bottom font-normal last:pr-4"
                >
                  <span className="block border-b border-linie pb-1.5 type-label-small font-semibold text-on-surface-mittel">
                    {g.label}
                  </span>
                </th>
              ))}
            </tr>
            <tr className="border-b border-linie">
              <SortierKopf href={kopf.href} richtung={kopf.richtung ?? null} className="sticky left-0 z-10 bg-elev-01 align-bottom">
                {kopf.label}
              </SortierKopf>
              {spalten.map((s, i) => (
                <SortierKopf
                  key={s.schluessel}
                  href={s.href}
                  richtung={s.richtung ?? null}
                  ausrichtung="end"
                  className={cn("align-bottom", grenze(i))}
                >
                  {/* Die Gruppe für Vorlesehilfen im Spaltennamen: «Spiele: Da». */}
                  <span className="sr-only">{s.gruppe}: </span>
                  {s.label}
                </SortierKopf>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-linie">
            {zeilen.map((z) => (
              <tr key={z.id} className={cn(z.gewaehlt && "betont")}>
                <th scope="row" className="sticky left-0 z-10 bg-elev-01 py-2 pl-4 pr-2 text-left align-middle font-normal">
                  {z.gewaehlt && <span aria-hidden className="betont pointer-events-none absolute inset-0" />}
                  <span className="relative">{z.kopf}</span>
                </th>
                {z.zellen.map((wert, i) => (
                  <td
                    key={spalten[i].schluessel}
                    className={cn(
                      "px-2 py-2 text-right align-middle type-body-medium tabular-nums text-on-surface last:pr-4",
                      grenze(i),
                      spalten[i].richtung && "font-semibold",
                    )}
                  >
                    {wert}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
