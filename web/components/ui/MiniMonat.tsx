"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
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

/** Je Tag so viele Badges; trägt er mehr, steht eines weniger und «+n». */
const HOECHSTENS = 3;

/** Das Zeichen eines Zustands — eine eigene FORM je Zustand, damit er sich
 *  auch ohne Farben unterscheiden lässt (#404 AK 8): gefüllter Punkt, Ring,
 *  Strich, Kreuz. */
function MarkenZeichen({ zustand }: { zustand: MarkenZustand }) {
  if (zustand === "training") return <span aria-hidden className="block size-2 rounded-full bg-primary" />;
  if (zustand === "noch-nicht") return <span aria-hidden className="block size-2 rounded-full border-2 border-icon-warning" />;
  if (zustand === "ohne") return <span aria-hidden className="block h-0.5 w-2 rounded-full bg-on-surface-mittel" />;
  return <X aria-hidden size={10} strokeWidth={3} className="text-on-surface-mittel" />;
}

/** Die Zahl des Tages; heute auf Primary, belegt mit gepunktetem Ring. */
function Tageszahl({ tag, heute, imMonat, belegt = false }: { tag: string; heute: string; imMonat: boolean; belegt?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 items-center justify-center rounded-full type-body-small",
        tag === heute ? "bg-primary text-on-primary" : imMonat ? "text-on-surface" : "text-on-surface-mittel",
        belegt && "border border-dotted border-on-surface-mittel",
      )}
    >
      {Number(tag.slice(8))}
    </span>
  );
}

/* Ein kleiner Monat zum Navigieren (Epic #401, Muster «Mini-Monat»): neben
   einer Liste, die er nicht ersetzt, sondern begleitet. Er passt in eine
   Seitenspalte und zeigt je Tag nur Zeichen; Zeit und Namen stehen in der
   Liste.

   - Jeder Eintrag steht als kleines Badge unten im Tag; die Zellen sind
     alle gleich hoch, Einträge machen den Monat nicht grösser.
   - Ein Tag mit Einträgen ist ein Knopf und meldet seinen ersten Eintrag
     (`onWahl`) — die übrigen folgen in der Liste direkt danach. Ein Tag ohne
     Eintrag ist kein Knopf. Der Knopf ist so gross wie der Tag (mind. 24 px,
     WCAG 2.5.8); einzelne Badges wären es nicht.
   - Trägt ein Tag mehr als drei, stehen zwei Badges und «+n» (#404 AK 6).
   - Heute: die Tageszahl auf Primary, dazu `aria-current="date"` (AK 7).
   - `belegt`: Tage, an denen etwas liegt, das der Monat nicht zeigt (die
     Termine anderer bei «Meine Termine», AK 14) — gepunkteter Ring um die
     Zahl, und so vorgelesen.
   - Die Randtage der Nachbarmonate sind leiser, tragen aber ihre Marken (AK 4).
   - Blättern und «Heute» melden nur den Monat (`onMonat`); was daraus folgt,
     entscheidet der Aufrufer.

   Die Legende darunter nennt jedes Zeichen beim Namen. */
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
  const zeigtBelegt = !!belegt && wochen.some((w) => w.some((d) => belegt(d.tag)));
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
              const gezeigt = liste.length > HOECHSTENS ? liste.slice(0, HOECHSTENS - 1) : liste;
              const mehr = liste.length - gezeigt.length;
              const istBelegt = liste.length === 0 && !!belegt?.(tag);
              return (
                <div role="cell" key={tag} aria-current={tag === heute ? "date" : undefined} className="min-w-0">
                  {liste.length > 0 ? (
                    <button
                      type="button"
                      aria-label={`${tagText(tag)}${tag === heute ? ", heute" : ""}: ${liste.map((m) => m.label).join("; ")}`}
                      onClick={() => onWahl(liste[0].id)}
                      className="state focus-ring flex h-11 w-full flex-col items-center gap-0.5 rounded-flaeche pt-0.5"
                    >
                      <Tageszahl tag={tag} heute={heute} imMonat={imMonat} />
                      <span aria-hidden className="flex h-2.5 items-center gap-0.5">
                        {gezeigt.map((m) => (
                          <span key={m.id} className="flex size-2.5 items-center justify-center">
                            <MarkenZeichen zustand={m.zustand} />
                          </span>
                        ))}
                        {mehr > 0 && <span className="text-[0.625rem] leading-none text-on-surface-mittel">+{mehr}</span>}
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-11 flex-col items-center pt-0.5">
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
