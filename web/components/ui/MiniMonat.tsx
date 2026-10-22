"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { monatsName, monatsRaster, monatVon, plusMonate, tagText } from "@/lib/monat";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

const WOCHENTAGE = [
  ["Mo", "Montag"],
  ["Di", "Dienstag"],
  ["Mi", "Mittwoch"],
  ["Do", "Donnerstag"],
  ["Fr", "Freitag"],
  ["Sa", "Samstag"],
  ["So", "Sonntag"],
] as const;

/** Ein Termin an einem Tag des Monats: Ausgefallen oder nicht ist alles, was
 *  der Monat unterscheidet (Epic #490); `label` ist der zugängliche Name. */
export type Marke = {
  id: string;
  ausgefallen: boolean;
  label: string;
};

/** Die Zahl des Tages (Epic #490): ein Tag mit einem Termin, der
 *  stattfindet, hell hinterlegt wie ein weisses Kalenderblatt — ohne
 *  Unterschied zwischen Training und Spiel; ein Tag mit nur ausgefallenen
 *  Terminen grau und durchgestrichen. Heute ohne Termin auf Primary, mit
 *  Termin dessen Fläche und ein Rahmen in Primary. `belegt`: der gepunktete
 *  Ring, wo etwas liegt, das der Monat nicht zeigt. */
function Tageszahl({
  tag,
  heute,
  imMonat,
  stand,
  belegt = false,
}: {
  tag: string;
  heute: string;
  imMonat: boolean;
  stand?: "termin" | "ausgefallen";
  belegt?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 items-center justify-center rounded-klein border border-dotted type-body-small",
        stand === "termin"
          ? "umkehr font-medium text-on-surface"
          : stand === "ausgefallen"
            ? "bg-elev-08 text-on-surface-mittel line-through"
            : tag === heute
              ? "bg-primary font-medium text-on-primary"
              : imMonat
                ? "text-on-surface"
                : "text-on-surface-mittel",
        // Heute mit Termin: dessen Fläche, dazu ein Rahmen in Primary.
        tag === heute && stand
          ? "border-2 border-solid border-primary"
          : belegt && tag !== heute
            ? "rounded-full border-on-surface-mittel"
            : "border-transparent",
      )}
    >
      {Number(tag.slice(8))}
    </span>
  );
}

/* Ein kleiner Monat zum Navigieren (Epic #401, Muster «Mini-Monat»): neben
   einer Liste, die er nicht ersetzt, sondern begleitet. Er passt in eine
   Seitenspalte und zeigt je Tag nur, ob dort etwas stattfindet; Zeit und
   Namen stehen in der Liste.

   - Ein Tag mit einem Termin, der stattfindet, ist hell hinterlegt; einer
     mit nur ausgefallenen grau und durchgestrichen (Epic #490). Training und
     Spiel unterscheidet er nicht, die Legende darunter sagt beides.
   - Jeder Monat zeigt sechs Wochen (`monatsRaster`): Beim Blättern springt
     die Höhe nicht.
   - Ein Tag mit Einträgen ist ein Knopf und meldet seinen ersten Eintrag
     (`onWahl`) — die übrigen folgen in der Liste direkt danach. Ein Tag ohne
     Eintrag ist kein Knopf. Der Knopf ist so gross wie der Tag (36 px hoch,
     mind. 24 px nach WCAG 2.5.8). Vorgelesen wird jeder Termin beim Namen,
     ein ausgefallener mit «fällt aus».
   - Heute: die Tageszahl auf Primary, dazu `aria-current="date"` (AK 7).
   - `belegt`: Tage, an denen etwas liegt, das der Monat nicht zeigt (die
     Termine anderer bei «Meine Termine», AK 14) — ein gepunkteter Ring, und
     so vorgelesen.
   - Die Randtage der Nachbarmonate sind leiser, tragen aber ihre Termine (AK 4).
   - Blättern und «Heute» melden nur den Monat (`onMonat`); was daraus folgt,
     entscheidet der Aufrufer. */
export function MiniMonat({
  monat,
  heute,
  marken,
  belegt,
  onWahl,
  onMonat,
  hinweis,
}: {
  /** `YYYY-MM`. */
  monat: string;
  /** `YYYY-MM-DD`. */
  heute: string;
  marken: (tag: string) => readonly Marke[];
  belegt?: (tag: string) => boolean;
  onWahl: (id: string) => void;
  onMonat: (monat: string) => void;
  /** Ein Satz unter dem Monatsnamen, etwa die Eingrenzung (AK 12). */
  hinweis?: ReactNode;
}) {
  const wochen = monatsRaster(monat);
  const aktuell = monatVon(heute);
  const titel = useRef<HTMLHeadingElement>(null);
  return (
    <section aria-label={`Monat ${monatsName(monat)}`} className="rounded-flaeche bg-elev-01 p-3">
      <div className="flex items-center gap-1">
        <h3 ref={titel} tabIndex={-1} aria-live="polite" className="type-title-small flex-1 text-on-surface focus-visible:outline-none">{monatsName(monat)}</h3>
        {/* «Heute» verschwindet mit seinem Klick; der Fokus landet darum auf
            dem Monatsnamen statt auf der Seite. */}
        {monat !== aktuell && (
          <Button
            variant="quiet"
            onClick={() => {
              onMonat(aktuell);
              titel.current?.focus();
            }}
          >
            Heute
          </Button>
        )}
        <IconButton icon={ChevronLeft} label="Vorheriger Monat" onClick={() => onMonat(plusMonate(monat, -1))} />
        <IconButton icon={ChevronRight} label="Nächster Monat" onClick={() => onMonat(plusMonate(monat, 1))} />
      </div>
      {hinweis && <p className="type-body-small text-on-surface-mittel">{hinweis}</p>}

      <div role="table" aria-label={`Termine im ${monatsName(monat)}`} className="mt-2 flex flex-col gap-0.5">
        <div role="row" className="grid grid-cols-7 text-center type-label-small text-on-surface-mittel">
          {WOCHENTAGE.map(([kurz, lang]) => (
            <div role="columnheader" key={kurz} className="py-1">
              <span aria-hidden>{kurz}</span>
              <span className="sr-only">{lang}</span>
            </div>
          ))}
        </div>
        {wochen.map((w) => (
          <div role="row" key={w[0].tag} className="grid grid-cols-7 gap-px">
            {w.map(({ tag, imMonat }) => {
              const liste = marken(tag);
              const stand = liste.length === 0 ? undefined : liste.some((m) => !m.ausgefallen) ? "termin" : "ausgefallen";
              const istBelegt = liste.length === 0 && !!belegt?.(tag);
              return (
                <div role="cell" key={tag} aria-current={tag === heute ? "date" : undefined} className="min-w-0">
                  {liste.length > 0 ? (
                    <button
                      type="button"
                      aria-label={`${tagText(tag)}${tag === heute ? ", heute" : ""}: ${liste.map((m) => (m.ausgefallen ? `${m.label}, fällt aus` : m.label)).join("; ")}`}
                      onClick={() => onWahl(liste[0].id)}
                      className="state focus-ring flex h-9 w-full items-center justify-center rounded-flaeche"
                    >
                      <Tageszahl tag={tag} heute={heute} imMonat={imMonat} stand={stand} />
                    </button>
                  ) : (
                    <div className="flex h-9 items-center justify-center">
                      <Tageszahl tag={tag} heute={heute} imMonat={imMonat} belegt={istBelegt} />
                      <span className="sr-only">
                        {tagText(tag)}
                        {tag === heute ? ", heute" : ""}
                        {istBelegt ? ", belegt" : ""}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 type-body-small text-on-surface-mittel">
        <li className="flex items-center gap-2">
          <span aria-hidden className="umkehr size-2.5 rounded-klein" />
          Termin – Training oder Spiel
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-klein bg-elev-08" />
          Fällt aus
        </li>
      </ul>
    </section>
  );
}
