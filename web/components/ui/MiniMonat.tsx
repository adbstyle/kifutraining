"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ReactNode } from "react";
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

/** Was ein Termin im Monat ist (#404 AK 5). */
export type MarkenZustand = "training" | "noch-nicht" | "ohne" | "ausgefallen";

export const MARKEN_TEXT: Record<MarkenZustand, string> = {
  training: "Training",
  "noch-nicht": "Noch kein Training",
  ohne: "Vergangen ohne Training",
  ausgefallen: "Ausgefallen",
};

export type Marke = {
  id: string;
  zustand: MarkenZustand;
  /** Der zugängliche Name des Knopfes. */
  label: string;
};

/** Je Tag so viele Marken einzeln; trägt er mehr, steht eine weniger und «+n». */
const HOECHSTENS = 2;

/** Das Zeichen eines Zustands — eine eigene FORM je Zustand, damit er sich
 *  auch ohne Farben unterscheiden lässt (#404 AK 8): gefüllter Punkt, Ring,
 *  Strich, Kreuz. */
export function MarkenZeichen({ zustand }: { zustand: MarkenZustand }) {
  if (zustand === "training") return <span aria-hidden className="block size-2 rounded-full bg-primary" />;
  if (zustand === "noch-nicht") return <span aria-hidden className="block size-2 rounded-full border-2 border-icon-warning" />;
  if (zustand === "ohne") return <span aria-hidden className="block h-0.5 w-2.5 rounded-full bg-on-surface-mittel" />;
  return <X aria-hidden size={12} strokeWidth={3} className="text-on-surface-mittel" />;
}

/* Ein kleiner Monat zum Navigieren (Epic #401, Muster «Mini-Monat»): neben
   einer Liste, die er nicht ersetzt, sondern begleitet. Neu, weil das
   `Monatsraster` einen Monat zum Lesen zeigt (Einträge mit Zeit und Namen,
   min. 36 rem breit); dieser passt in eine Seitenspalte und zeigt je Tag nur
   Zeichen.

   - Tage mit Einträgen tragen je Eintrag eine Marke, einen Knopf über die
     Breite des Tages (`onWahl`); ein Tag ohne Eintrag ist kein Knopf.
   - Trägt ein Tag mehr als zwei, steht die erste und «+n» (#404 AK 6).
   - Heute: die Tageszahl auf Primary, dazu `aria-current="date"` (AK 7).
   - `belegt`: Tage, an denen etwas liegt, das der Monat nicht zeigt (die
     Termine anderer bei «Meine Termine», AK 14) — gepunkteter Ring um die
     Zahl, und so vorgelesen.
   - Die Randtage der Nachbarmonate sind leiser, tragen aber ihre Marken (AK 4).
   - Blättern und «Heute» melden nur den Monat (`onMonat`); was daraus folgt,
     entscheidet der Aufrufer.

   Die Marken stehen untereinander und sind 20 px hoch mit 4 px Abstand: So
   liegen ihre Mitten 24 px auseinander (WCAG 2.5.8). Die Legende darunter
   nennt jedes Zeichen beim Namen. */
export function MiniMonat({
  monat,
  heute,
  marken,
  belegt,
  onWahl,
  onMonat,
  hinweis,
  className,
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
  className?: string;
}) {
  const wochen = monatsRaster(monat);
  const aktuell = monatVon(heute);
  const zeigtBelegt = !!belegt && wochen.some((w) => w.some((d) => belegt(d.tag)));
  return (
    <section aria-label={`Monat ${monatsName(monat)}`} className={cn("rounded-flaeche bg-elev-01 p-3", className)}>
      <div className="flex items-center gap-1">
        <h3 aria-live="polite" className="type-title-small flex-1 text-on-surface">{monatsName(monat)}</h3>
        {monat !== aktuell && (
          <Button variant="quiet" onClick={() => onMonat(aktuell)}>Heute</Button>
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
          <div role="row" key={w[0].tag} className="grid grid-cols-7 gap-0.5">
            {w.map(({ tag, imMonat }) => {
              const liste = marken(tag);
              const gezeigt = liste.length > HOECHSTENS ? liste.slice(0, HOECHSTENS - 1) : liste;
              const mehr = liste.length - gezeigt.length;
              const istBelegt = liste.length === 0 && !!belegt?.(tag);
              return (
                <div role="cell" key={tag} aria-current={tag === heute ? "date" : undefined} className="flex min-w-0 flex-col items-center gap-1 pb-1">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full type-body-small",
                      tag === heute ? "bg-primary text-on-primary" : imMonat ? "text-on-surface" : "text-on-surface-mittel",
                      istBelegt && "border border-dotted border-on-surface-mittel",
                    )}
                  >
                    {Number(tag.slice(8))}
                  </span>
                  <span className="sr-only">
                    {tagText(tag)}
                    {tag === heute ? ", heute" : ""}
                    {istBelegt ? ", belegt" : ""}.{" "}
                  </span>
                  {gezeigt.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-label={m.label}
                      title={MARKEN_TEXT[m.zustand]}
                      onClick={() => onWahl(m.id)}
                      className="state focus-ring flex h-5 w-full items-center justify-center rounded-klein bg-elev-08"
                    >
                      <MarkenZeichen zustand={m.zustand} />
                    </button>
                  ))}
                  {mehr > 0 && (
                    <span className="type-label-small text-on-surface-mittel">
                      +{mehr}
                      <span className="sr-only"> weitere {mehr === 1 ? "Termin" : "Termine"}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Die Legende: jedes Zeichen beim Namen (AK 8). */}
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-linie pt-2 type-label-small text-on-surface-mittel" aria-label="Legende">
        {(Object.keys(MARKEN_TEXT) as MarkenZustand[]).map((z) => (
          <li key={z} className="flex items-center gap-1.5">
            <span className="flex w-3 justify-center"><MarkenZeichen zustand={z} /></span>
            {MARKEN_TEXT[z]}
          </li>
        ))}
        {zeigtBelegt && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-full border border-dotted border-on-surface-mittel" />
            Belegt
          </li>
        )}
      </ul>
    </section>
  );
}
