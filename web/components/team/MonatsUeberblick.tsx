"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import { ButtonLink, IconButtonLink, Menu, Monatsraster } from "@/components/ui";
import { cn } from "@/lib/cn";
import { monatsName, monatVon, plusMonate, tagText } from "@/lib/monat";
import { planHref } from "@/lib/team-ansicht";
import { useTerminAktionen } from "./TerminBereich";
// Werte aus termine-fuer.ts, nicht aus termine.ts: Jenes zieht den Cookie-Client
// (next/headers) ins Client-Bundle.
import { nochNichtVorbereitet, type TerminZeile } from "@/lib/queries/termine-fuer";

/** Wo das «+»-Menü steht: in Fensterkoordinaten unter dem Knopf. Das Menü sitzt
 *  ausserhalb des Rasters, weil dessen waagrechter Scroll-Behälter es sonst
 *  abschnitte. */
type PlusMenue = { tag: string; links: number; oben: number };
const MENUE_BREITE = 192; // min-w-48 des Menüs
const MENUE_HOEHE = 100; // zwei Einträge samt Rand; reicht zum Umklappen nach oben

/* Die Termine eines Teams Monat für Monat (#329). Jeder Termin eines Tages
   steht einzeln (AK 4) mit Beginn und Trainingsname oder seinem Zustand
   (AK 5–7); ein Klick öffnet ihn mit denselben Aktionen wie in der Liste. Alle
   Links tragen die Eingrenzung auf die eigenen Termine mit (PC 4). */
export function MonatsUeberblick({
  teamId,
  monat,
  termine,
  heute,
  meine,
}: {
  teamId: string;
  /** `YYYY-MM`. */
  monat: string;
  termine: TerminZeile[];
  heute: string;
  /** Die Eingrenzung auf die eigenen Termine ist an (PC 4). */
  meine: boolean;
}) {
  const a = useTerminAktionen();
  const [plus, setPlus] = useState<PlusMenue | null>(null);
  const plusRef = useRef<HTMLElement | null>(null);
  const hrefMonat = (m: string) => planHref(teamId, { ansicht: "monat", monat: m, meine }, heute);

  // Das Menü hängt an Fensterkoordinaten: Scrollt oder wechselt die Grösse,
  // schliesst es, statt vom Knopf wegzuwandern.
  useEffect(() => {
    if (!plus) return;
    const zu = () => setPlus(null);
    window.addEventListener("scroll", zu, true);
    window.addEventListener("resize", zu);
    return () => {
      window.removeEventListener("scroll", zu, true);
      window.removeEventListener("resize", zu);
    };
  }, [plus]);

  const jeTag = new Map<string, TerminZeile[]>();
  for (const t of termine) jeTag.set(t.datum, [...(jeTag.get(t.datum) ?? []), t]);

  function eintrag(t: TerminZeile) {
    const offen = nochNichtVorbereitet(t, heute);
    const zustand = t.ausgefallen ? "Ausgefallen" : t.training ? t.training.name : offen ? "Noch kein Training" : "Ohne Training";
    const name = `${tagText(t.datum)}, ${t.beginn ? `${t.beginn} Uhr` : "Zeit fehlt"}, ${zustand}`;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => a.oeffnen(t)}
        aria-label={name}
        title={name}
        className={cn(
          "focus-ring mt-1 block w-full break-words rounded-plakette px-1 text-left type-body-small",
          t.ausgefallen && "text-on-surface-tief line-through",
          !t.ausgefallen && t.training && "bg-elev-08 text-on-surface",
          !t.ausgefallen && !t.training && offen && "kontur border-error text-error",
          !t.ausgefallen && !t.training && !offen && "text-on-surface-mittel",
        )}
      >
        {t.beginn ? `${t.beginn} ` : <span className="text-error">Zeit fehlt </span>}
        {zustand}
      </button>
    );
  }

  return (
    <section aria-label="Monatsüberblick">
      <div className="mb-3 flex items-center justify-between gap-2">
        <IconButtonLink href={hrefMonat(plusMonate(monat, -1))} icon={ChevronLeft} label="Vorheriger Monat" scroll={false} />
        <h3 className="type-title-medium text-on-surface">{monatsName(monat)}</h3>
        <div className="flex items-center gap-1">
          {monat !== monatVon(heute) && (
            <ButtonLink variant="text" size="sm" href={hrefMonat(monatVon(heute))} scroll={false}>Heute</ButtonLink>
          )}
          <IconButtonLink href={hrefMonat(plusMonate(monat, 1))} icon={ChevronRight} label="Nächster Monat" scroll={false} />
        </div>
      </div>
      <Monatsraster
        monat={monat}
        heute={heute}
        label={`Termine im ${monatsName(monat)}`}
        leereWoche={(tage) => tage.every((d) => !jeTag.has(d))}
        renderTag={(tag) => (
          <>
            {(jeTag.get(tag) ?? []).map(eintrag)}
            <button
              type="button"
              aria-label={`Am ${tagText(tag)} festlegen`}
              aria-haspopup="menu"
              aria-expanded={plus?.tag === tag}
              onClick={(e) => {
                const k = e.currentTarget;
                if (plus?.tag === tag) return setPlus(null);
                plusRef.current = k;
                const r = k.getBoundingClientRect();
                // Unten kein Platz mehr: über dem Knopf öffnen, sonst scrollte das
                // Fokussieren des ersten Eintrags die Seite — und das schlösse das Menü.
                const unten = window.innerHeight - r.bottom >= MENUE_HOEHE;
                setPlus({
                  tag,
                  links: Math.max(8, Math.min(r.left, window.innerWidth - MENUE_BREITE - 8)),
                  oben: unten ? r.bottom : Math.max(8, r.top - MENUE_HOEHE),
                });
              }}
              className="focus-ring mt-1 block rounded-full p-1 text-on-surface-mittel hover:text-on-surface"
            >
              <Plus size={14} aria-hidden />
            </button>
          </>
        )}
      />
      {plus && (
        <div className="fixed z-50" style={{ left: plus.links, top: plus.oben }}>
          <Menu
            open
            onClose={() => setPlus(null)}
            triggerRef={plusRef}
            items={[
              { label: "Termin festlegen", icon: CalendarPlus, onSelect: () => a.neu(plus.tag) },
              { label: "Terminserie festlegen", icon: Repeat, onSelect: () => a.neueSerie(plus.tag) },
            ]}
          />
        </div>
      )}
    </section>
  );
}
