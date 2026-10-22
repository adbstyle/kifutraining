"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { monatsName, monatsRaster, monatVon, plusMonate, tagText } from "@/lib/monat";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { ZeichenPunkt, type ZeichenPunktTon } from "./ZeichenPunkt";

const WOCHENTAGE = [
  ["Mo", "Montag"],
  ["Di", "Dienstag"],
  ["Mi", "Mittwoch"],
  ["Do", "Donnerstag"],
  ["Fr", "Freitag"],
  ["Sa", "Samstag"],
  ["So", "Sonntag"],
] as const;

/** Ein Termin an einem Tag des Monats: ob er ein Spiel ist und ob er ausfällt
 *  (Epic #490); `label` ist der zugängliche Name. */
export type Marke = {
  id: string;
  spiel: boolean;
  ausgefallen: boolean;
  /** Die Farbe seines Status, wenn er eine trägt (grün, gelb, rot). */
  ton?: StatusTon;
  label: string;
};

export type StatusTon = Extract<ZeichenPunktTon, "success" | "warning" | "danger">;

/** Was ein Tag im Monat trägt: ein Spiel geht einem Training vor, beides
 *  einem Tag mit nur ausgefallenen Terminen. */
type TagStand = "spiel" | "training" | "ausgefallen";

function tagStand(marken: readonly Marke[]): TagStand | undefined {
  if (marken.length === 0) return undefined;
  const statt = marken.filter((m) => !m.ausgefallen);
  if (statt.length === 0) return "ausgefallen";
  return statt.some((m) => m.spiel) ? "spiel" : "training";
}

/** Der dringlichste Status eines Tages — rot vor gelb vor grün. */
const RANG: StatusTon[] = ["danger", "warning", "success"];
function tagTon(marken: readonly Marke[]): StatusTon | undefined {
  return RANG.find((ton) => marken.some((m) => !m.ausgefallen && m.ton === ton));
}

/** Die Zahl des Tages (Epic #490) — wie das Kalenderblatt in der Liste: ein
 *  Tag mit einem Spiel weiss hinterlegt, einer mit nur Trainings hell
 *  umrandet (PO 2026-10-22), einer mit nur ausgefallenen Terminen grau und
 *  durchgestrichen. Heute ohne Termin auf Primary, mit Termin dessen Fläche
 *  und ein Rahmen in Primary. `belegt`: der gepunktete Ring, wo etwas liegt,
 *  das der Monat nicht zeigt. `ton`: ein Punkt oben rechts in der Farbe des
 *  dringlichsten farbigen Status (PO 2026-10-22), etwa rot, wenn für ein
 *  Spiel zu wenige gemeldet sind. */
function Tageszahl({
  tag,
  heute,
  imMonat,
  stand,
  ton,
  belegt = false,
}: {
  tag: string;
  heute: string;
  imMonat: boolean;
  stand?: TagStand;
  ton?: StatusTon;
  belegt?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-6 items-center justify-center rounded-klein type-body-small",
        stand === "spiel"
          ? "umkehr font-medium text-on-surface"
          : stand === "training"
            ? "font-medium text-on-surface"
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
          : stand === "training"
            ? "kontur border-on-surface-mittel"
            : belegt && tag !== heute
              ? "rounded-full border border-dotted border-on-surface-mittel"
              : "border border-transparent",
      )}
    >
      {Number(tag.slice(8))}
      {ton && <ZeichenPunkt ton={ton} className="-top-1 -right-1" />}
    </span>
  );
}

/* Ein kleiner Monat zum Navigieren (Epic #401, Muster «Mini-Monat»): neben
   einer Liste, die er nicht ersetzt, sondern begleitet. Er passt in eine
   Seitenspalte und zeigt je Tag nur, ob dort etwas stattfindet; Zeit und
   Namen stehen in der Liste.

   - Wie die Kalenderblätter der Liste (Epic #490): ein Tag mit einem Spiel
     weiss, einer mit nur Trainings hell umrandet, einer mit nur
     ausgefallenen grau und durchgestrichen. Die Legende darunter sagt alle
     drei.
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
              const stand = tagStand(liste);
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
                      <Tageszahl tag={tag} heute={heute} imMonat={imMonat} stand={stand} ton={tagTon(liste)} />
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
          Spiel
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="kontur size-2.5 rounded-klein border-on-surface-mittel" />
          Training
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-klein bg-elev-08" />
          Fällt aus
        </li>
      </ul>
    </section>
  );
}
