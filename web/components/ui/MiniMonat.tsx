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

/** Zustände mit eigenem Zeichen. Ein vergangener Termin ohne Training zeigt
 *  keines, nur die Belegung (der Ring) — rückblickend interessiert er im
 *  Monat nicht (PO 2026-10-07). Vorgelesen und gewählt wird er weiter. */
type ZeichenZustand = Exclude<MarkenZustand, "ohne">;
type ZeichenMarke = Marke & { zustand: ZeichenZustand };
const mitZeichen = (m: Marke): m is ZeichenMarke => m.zustand !== "ohne";

/** Das Zeichen eines Zustands: gefüllter Punkt in Primary (Training) oder in
 *  der Warnfarbe (noch kein Training), Kreuz in Rot (ausgefallen; das Rot der
 *  Warnzeichen wie das Gelb, PO 2026-10-07). Training und «noch kein Training» unterscheidet nur noch
 *  die Farbe — bewusst, damit das Gelb auffällt (PO 2026-10-07, hebt #404
 *  AK 8 für diese beiden auf); vorgelesen wird jeder Zustand beim Namen. */
function MarkenZeichen({ zustand }: { zustand: ZeichenZustand }) {
  if (zustand === "training") return <span aria-hidden className="block size-2 rounded-full bg-primary" />;
  if (zustand === "noch-nicht") return <span aria-hidden className="block size-2 rounded-full bg-icon-warning" />;
  return <X aria-hidden size={10} strokeWidth={3} className="text-icon-danger" />;
}

/** Ein Punkt auf dem Ring unter dem Winkel `grad`, als Mittelpunkt in px;
 *  0° ist rechts, es zählt im Uhrzeigersinn. Gemessen in der Innenfläche der
 *  24-px-Zahl, die immer einen 1-px-Rand trägt (22 px): Mitte 11, die Linie
 *  des Rings liegt auf halber Randbreite (11.5). */
function aufDemRing(grad: number, versatz = 0) {
  const w = (grad * Math.PI) / 180;
  return { left: 11 + 11.5 * Math.cos(w) + versatz, top: 11 + 11.5 * Math.sin(w) };
}

/** Wo die Badges sitzen (PO 2026-10-07): das erste oben rechts auf dem Ring,
 *  das zweite halb dahinter, nach rechts versetzt — hintereinander, nicht den
 *  Ring entlang (PO). In der schmalen Spalte (Zelle ~33 px) ragt es dabei
 *  ein, zwei Pixel in den Nachbartag; so gewollt. «+n» unten rechts. */
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
  marken?: readonly ZeichenMarke[];
  mehr?: number;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        // Der Rand steht immer (sonst transparent), damit die Badges überall
        // gleich sitzen.
        "relative flex size-6 items-center justify-center rounded-full border border-dotted type-body-small",
        tag === heute ? "bg-primary text-on-primary" : imMonat ? "text-on-surface" : "text-on-surface-mittel",
        ring && tag !== heute ? "border-on-surface-mittel" : "border-transparent",
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
     das zweite halb hinter dem ersten (PO 2026-10-07). Die Zellen sind
     alle gleich hoch, Einträge machen den Monat nicht grösser.
   - Jeder Monat zeigt sechs Wochen (`monatsRaster`): Beim Blättern springt
     die Höhe nicht.
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

   Eine Legende gibt es nicht (PO 2026-10-07): Die Zeichen erklären sich mit
   der Liste daneben, deren Kalenderblätter dieselben Farben tragen;
   vorgelesen wird jeder Tag mit seinen Terminen beim Namen. */
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
              const zeichen = liste.filter(mitZeichen);
              const gezeigt = zeichen.slice(0, HOECHSTENS);
              const mehr = zeichen.length - gezeigt.length;
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
    </section>
  );
}
