import Link from "next/link";
import { Layers } from "lucide-react";
import { SecondaryLozenge, SichtbarkeitLozenge, SortierKopf } from "@/components/ui";
import { TrainingSortierWahl, type SortierOption } from "@/components/training/TrainingSortierWahl";
import type { TrainingListRow } from "@/lib/queries/trainings";
import { formatDate, formatDuration } from "@/lib/training";
import {
  SORTIER_LABEL,
  SORTIER_SPALTEN,
  naechsteSortierung,
  ersteRichtung,
  sortierHref,
  type SortierSpalte,
  type TrainingSortierung,
} from "@/lib/training-sortierung";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { ANSICHT_PARAM, auswahlHref } from "@/lib/training-auswahl";
import { cn } from "@/lib/cn";
import { TabellenAuswahl } from "./TabellenAuswahl";

/* Die Trainingsübersicht als Tabelle (#629, Design-Variante A2). Die Zeilen
   kommen bereits sortiert vom Server (`sortiereTrainings`); die Tabelle zeigt
   nur, wonach und in welcher Richtung (AK 6), und bietet die nächste Wahl als
   Link an.

   Breit (ab md) eine echte Tabelle mit sechs Spalten; die Köpfe sortieren
   (`SortierKopf`). Schmal bleibt nur die Namensspalte, die übrigen Angaben
   stehen als zweite Zeile darunter, und sortiert wird über den Chip über der
   Tabelle (`TrainingSortierWahl`) — die Seite scrollt nie seitwärts. */

/** Wohin eine Zeile führt — an EINER Stelle: in dieselbe Übersicht mit
 *  diesem Training ausgewählt; sein Detail steht daneben (#630 AK 1). Die
 *  offene Ansicht des Detail bleibt beim Wechsel, die Variante beginnt wieder
 *  bei der vordersten. Bearbeitung und Ansicht erreicht man aus dem Detail
 *  (hebt #629 AK 10 auf). Der Name ist der einzige Link der Zeile; seine
 *  Fläche reicht über die ganze Zeile. */
function zeilenZiel(training: TrainingListRow, pfad: string, parameter: Record<string, string>): string {
  const ansicht = parameter[ANSICHT_PARAM] === "eigenschaften" ? "eigenschaften" : undefined;
  return auswahlHref(pfad, parameter, { training: training.id, ansicht });
}

/** Die Alterskategorien als Satz, z. B. «Kategorien F, E»; leer, solange ein
 *  Entwurf keine trägt. */
function kategorienText(training: TrainingListRow): string | null {
  if (training.stufen.length === 0) return null;
  return `${training.stufen.length === 1 ? "Kategorie" : "Kategorien"} ${training.stufen.join(", ")}`;
}

export function TrainingTabelle({
  trainings,
  sortierung,
  pfad,
  parameter,
  ausgewaehlt,
}: {
  trainings: TrainingListRow[];
  sortierung: TrainingSortierung;
  /** Die Seite, auf der die Tabelle steht — Ziel der Sortier-Links. */
  pfad: string;
  /** Die übrigen Adressparameter (Suche, Filter); die Sortier-Links nehmen sie
   *  mit (#629 PC 2). */
  parameter: Record<string, string>;
  /** Das ausgewählte Training, dessen Detail daneben steht (#630). */
  ausgewaehlt?: string;
}) {
  const href = (s: TrainingSortierung) => sortierHref(pfad, parameter, s);
  const kopf = (spalte: SortierSpalte) => ({
    href: href(naechsteSortierung(sortierung, spalte)),
    richtung: sortierung.spalte === spalte ? sortierung.richtung : null,
  });

  // Schmal: erst die Spalten (eine neue beginnt mit ihrer ersten Richtung),
  // dann die Richtung der aktiven.
  const optionen: SortierOption[] = [
    ...SORTIER_SPALTEN.map((spalte) => ({
      label: SORTIER_LABEL[spalte],
      gewaehlt: sortierung.spalte === spalte,
      href: href(sortierung.spalte === spalte ? sortierung : { spalte, richtung: ersteRichtung(spalte) }),
    })),
    {
      label: "Aufsteigend",
      gewaehlt: sortierung.richtung === "auf",
      href: href({ spalte: sortierung.spalte, richtung: "auf" }),
      trenner: true,
    },
    {
      label: "Absteigend",
      gewaehlt: sortierung.richtung === "ab",
      href: href({ spalte: sortierung.spalte, richtung: "ab" }),
    },
  ];

  return (
    <>
      <div className="mb-4 flex min-h-9 items-center justify-between gap-2">
        <p className="type-label-small text-on-surface-mittel">
          {trainings.length} {trainings.length === 1 ? "Training" : "Trainings"}
        </p>
        <TrainingSortierWahl
          className="md:hidden"
          spalte={SORTIER_LABEL[sortierung.spalte]}
          richtung={sortierung.richtung}
          optionen={optionen}
        />
      </div>

      <TabellenAuswahl ausgewaehlt={ausgewaehlt} />
      <div className="overflow-hidden rounded-flaeche bg-elev-01">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Trainings, sortiert nach {SORTIER_LABEL[sortierung.spalte]},{" "}
            {sortierung.richtung === "auf" ? "aufsteigend" : "absteigend"}
          </caption>
          <thead className="hidden md:table-header-group">
            <tr className="border-b border-linie">
              <SortierKopf {...kopf("stufe")} className="w-40">
                {SORTIER_LABEL.stufe}
              </SortierKopf>
              <SortierKopf {...kopf("name")}>{SORTIER_LABEL.name}</SortierKopf>
              <SortierKopf className="w-44">Sichtbarkeit / Urheber</SortierKopf>
              <SortierKopf {...kopf("uebungen")} ausrichtung="end" className="w-24">
                {SORTIER_LABEL.uebungen}
              </SortierKopf>
              <SortierKopf {...kopf("dauer")} ausrichtung="end" className="w-28">
                {SORTIER_LABEL.dauer}
              </SortierKopf>
              <SortierKopf {...kopf("geaendert")} ausrichtung="end" className="w-28">
                {SORTIER_LABEL.geaendert}
              </SortierKopf>
            </tr>
          </thead>
          <tbody className="divide-y divide-linie">
            {trainings.map((training) => {
              const ziel = zeilenZiel(training, pfad, parameter);
              const gewaehlt = training.id === ausgewaehlt;
              const altersstufe = altersstufeLabels[training.altersstufe];
              const kategorien = kategorienText(training);
              const dauer = training.hasAnyDuration ? formatDuration(training.totalDuration) : null;
              const geaendert = formatDate(training.updatedAt);
              const zelle = "hidden px-2 py-2 align-middle type-body-medium md:table-cell";
              return (
                // Die Zeile hellt beim Überfahren auf (`state`, damit auch
                // `relative`); die Fläche des Namens-Links reicht über sie,
                // wie in den Übungszeilen eines Trainings (`UebungsName`):
                // ein Link, ein Tabstopp, die ganze Zeile als Trefferfläche.
                // Die ausgewählte Zeile ist betont (#630 AK 2) wie die aktive
                // Zeile in Leiste und Verzeichnis; ihr Link trägt
                // `aria-current`.
                <tr key={training.id} className={cn("state", gewaehlt && "betont")}>
                  {/* Altersstufe als Text; die Alterskategorien erkennbar, ohne
                      die Zeile zu belegen (#629 AK 3): beim Überfahren und für
                      die Vorlesehilfe. */}
                  <td className={`${zelle} pl-4 text-on-surface`}>
                    {/* `relative z-10`: über der Fläche des Links, sonst
                        erreichte das Überfahren den Hinweis nie. */}
                    <span title={kategorien ?? undefined} className="relative z-10">
                      {altersstufe}
                      {kategorien && <span className="sr-only">, {kategorien}</span>}
                    </span>
                  </td>

                  <th scope="row" className="py-2 pl-4 pr-4 text-left align-middle font-normal md:pl-2 md:pr-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={ziel}
                        // Die Tabelle bleibt an ihrer Stelle (NFR 1).
                        scroll={false}
                        aria-current={gewaehlt ? "true" : undefined}
                        data-training-zeile={training.id}
                        className="focus-ring rounded-klein type-body-medium text-on-surface before:absolute before:inset-0 before:content-[''] hover:underline"
                      >
                        {training.name}
                      </Link>
                      {/* Ab zwei Hauptteil-Varianten (#629 AK 4, #206 AK 1);
                          Übungen und Dauer zählen die vorderste. */}
                      {training.variantenZahl > 1 && (
                        <SecondaryLozenge appearance="discovery" iconBefore={Layers}>
                          {training.variantenZahl} Varianten
                        </SecondaryLozenge>
                      )}
                    </div>
                    {/* Schmal die übrigen Spalten als zweite Zeile. Ohne
                        Überfahren sind die Kategorien hier sichtbar. */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 type-body-small text-on-surface-mittel md:hidden">
                      <span>
                        {altersstufe}
                        {kategorien && ` · ${training.stufen.join(", ")}`}
                      </span>
                      {training.istEigen ? (
                        <SichtbarkeitLozenge oeffentlich={training.visibility === "public"} />
                      ) : (
                        training.urheber && <span>von {training.urheber}</span>
                      )}
                      <span>
                        {training.exerciseCount} {training.exerciseCount === 1 ? "Übung" : "Übungen"}
                      </span>
                      <span>{dauer ?? "Keine Dauer"}</span>
                      <span>Geändert {geaendert}</span>
                    </div>
                  </th>

                  {/* Am eigenen Training der Stand, an einem fremden der
                      Urheber — leer, wenn es keinen mehr führt (AK 2,
                      Story 15). */}
                  <td className={`${zelle} text-on-surface-mittel`}>
                    {training.istEigen ? (
                      <SichtbarkeitLozenge oeffentlich={training.visibility === "public"} />
                    ) : (
                      training.urheber
                    )}
                  </td>

                  <td className={`${zelle} text-right tabular-nums text-on-surface`}>
                    {training.exerciseCount}
                  </td>

                  <td className={`${zelle} text-right tabular-nums text-on-surface`}>
                    {dauer ?? (
                      <>
                        <span aria-hidden>–</span>
                        <span className="sr-only">Keine Dauer</span>
                      </>
                    )}
                  </td>

                  <td className={`${zelle} pr-4 text-right tabular-nums text-on-surface-mittel`}>
                    {geaendert}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
