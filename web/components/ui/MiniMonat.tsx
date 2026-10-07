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

/** Je Tag höchstens so viele Badges; die übrigen zählt «+n». */
const HOECHSTENS = 2;

/** Das Zeichen eines Zustands: gefüllter Punkt in Primary (Training) oder in
 *  der Warnfarbe (noch kein Training), Strich (vergangen ohne), Kreuz
 *  (ausgefallen). Training und «noch kein Training» unterscheidet nur noch
 *  die Farbe — bewusst, damit das Gelb auffällt (PO 2026-10-07, hebt #404
 *  AK 8 für diese beiden auf); vorgelesen wird jeder Zustand beim Namen. */
function MarkenZeichen({ zustand }: { zustand: MarkenZustand }) {
  if (zustand === "training") return <span aria-hidden className="block size-2 rounded-full bg-primary" />;
  if (zustand === "noch-nicht") return <span aria-hidden className="block size-2 rounded-full bg-icon-warning" />;
  if (zustand === "ohne") return <span aria-hidden className="block h-0.5 w-2 rounded-full bg-on-surface-mittel" />;
  return <X aria-hidden size={10} strokeWidth={3} className="text-on-surface-mittel" />;
}

/** Ein Punkt auf dem Ring (24 px Durchmesser) unter dem Winkel `grad`, als
 *  Mittelpunkt in px; 0° ist rechts, es zählt im Uhrzeigersinn. */
function aufDemRing(grad: number, versatz = 0) {
  const w = (grad * Math.PI) / 180;
  return { left: 12 + 12 * Math.cos(w) + versatz, top: 12 + 12 * Math.sin(w) };
}

/** Wo die Badges sitzen (PO 2026-10-07): das erste oben rechts auf dem Ring,
 *  das zweite halb dahinter, «+n» unten rechts. */
const BADGE_ORT = [aufDemRing(-45), aufDemRing(-45, 5)];
const MEHR_ORT = aufDemRing(45);

/** Die Zahl des Tages; heute auf Primary. Liegt an ihm ein Termin, trägt sie
 *  einen gepunkteten Ring, und die gezeigten Termine sitzen als Badges darauf
 *  — wie der Punkt an einem Zeichen für Neuigkeiten. Jedes Badge hat die
 *  Fläche des Monats als Rand, damit es sich vom Ring abhebt. */
function Tageszahl({
  tag,
  heute,
  imMonat,
  ring = false,
  marken = [],
  mehr = 0,
}: {
  tag: string;
  heute: string;
  imMonat: boolean;
  ring?: boolean;
  marken?: readonly Marke[];
  mehr?: number;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-6 items-center justify-center rounded-full type-body-small",
        tag === heute ? "bg-primary text-on-primary" : imMonat ? "text-on-surface" : "text-on-surface-mittel",
        ring && tag !== heute && "border border-dotted border-on-surface-mittel",
      )}
    >
      {Number(tag.slice(8))}
      {/* Das erste liegt über dem zweiten. */}
      {marken.map((m, i) => (
        <span key={m.id} style={{ ...BADGE_ORT[i], zIndex: marken.length - i }} className="absolute flex size-3 -translate-1/2 items-center justify-center rounded-full bg-elev-01">
          <MarkenZeichen zustand={m.zustand} />
        </span>
      ))}
      {mehr > 0 && (
        <span
          style={MEHR_ORT}
          className="absolute flex h-3 min-w-3 -translate-1/2 items-center justify-center rounded-full bg-elev-01 px-px text-[0.5rem] leading-none text-on-surface-mittel"
        >
          +{mehr}
        </span>
      )}
    </span>
  );
}

/* Ein kleiner Monat zum Navigieren (Epic #401, Muster «Mini-Monat»): neben
   einer Liste, die er nicht ersetzt, sondern begleitet. Er passt in eine
   Seitenspalte und zeigt je Tag nur Zeichen; Zeit und Namen stehen in der
   Liste.

   - Ein Tag mit Einträgen — oder `belegt` — trägt einen gepunkteten Ring um
     die Zahl; die Einträge sitzen als kleine Badges oben rechts auf dem Ring,
     das zweite halb hinter dem ersten (PO 2026-10-07). Die Zellen sind alle gleich hoch,
     Einträge machen den Monat nicht grösser.
   - Ein Tag mit Einträgen ist ein Knopf und meldet seinen ersten Eintrag
     (`onWahl`) — die übrigen folgen in der Liste direkt danach. Ein Tag ohne
     Eintrag ist kein Knopf. Der Knopf ist so gross wie der Tag (36 px hoch,
     mind. 24 px nach WCAG 2.5.8); einzelne Badges wären es nicht.
   - Trägt ein Tag mehr als zwei, stehen zwei Badges und «+n» (#404 AK 6,
     PO 2026-10-07).
   - Heute: die Tageszahl auf Primary, dazu `aria-current="date"` (AK 7).
   - `belegt`: Tage, an denen etwas liegt, das der Monat nicht zeigt (die
     Termine anderer bei «Meine Termine», AK 14) — der Ring ohne Badge, und
     so vorgelesen.
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
              const gezeigt = liste.slice(0, HOECHSTENS);
              const mehr = liste.length - gezeigt.length;
              const istBelegt = liste.length === 0 && !!belegt?.(tag);
              return (
                <div role="cell" key={tag} aria-current={tag === heute ? "date" : undefined} className="min-w-0">
                  {liste.length > 0 ? (
                    <button
                      type="button"
                      aria-label={`${tagText(tag)}${tag === heute ? ", heute" : ""}: ${liste.map((m) => m.label).join("; ")}`}
                      onClick={() => onWahl(liste[0].id)}
                      className="state focus-ring flex h-9 w-full items-center justify-center rounded-flaeche"
                    >
                      <Tageszahl tag={tag} heute={heute} imMonat={imMonat} ring marken={gezeigt} mehr={mehr} />
                    </button>
                  ) : (
                    <div className="flex h-9 items-center justify-center">
                      <Tageszahl tag={tag} heute={heute} imMonat={imMonat} ring={istBelegt} />
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
