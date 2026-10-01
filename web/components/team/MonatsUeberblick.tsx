"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ButtonLink, IconButtonLink, Monatsraster } from "@/components/ui";
import { monatsName, monatVon, plusMonate, tagText } from "@/lib/monat";
import { planHref } from "@/lib/team-ansicht";
import { TerminEintrag, eintragText, type EintragZustand } from "./TerminEintrag";
import { useTerminAktionen } from "./TerminBereich";
// Werte aus termine-fuer.ts, nicht aus termine.ts: Jenes zieht den Cookie-Client
// (next/headers) ins Client-Bundle.
import { nochNichtVorbereitet, type TerminZeile } from "@/lib/queries/termine-fuer";

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
  const ueberschriftRef = useRef<HTMLHeadingElement | null>(null);
  const vorherMonat = useRef(monat);
  const hrefMonat = (m: string) => planHref(teamId, { ansicht: "monat", monat: m, meine }, heute);

  // Verschwand beim Monatswechsel das fokussierte Element («Heute» gibt es im
  // aktuellen Monat nicht mehr), landet der Fokus auf der Monatsüberschrift statt
  // auf `body` — ein Wechsel mit «Vorheriger/Nächster Monat» behält seinen Knopf.
  useEffect(() => {
    if (vorherMonat.current === monat) return;
    vorherMonat.current = monat;
    const fokus = document.activeElement;
    if (!fokus || fokus === document.body) ueberschriftRef.current?.focus({ preventScroll: true });
  }, [monat]);

  const jeTag = new Map<string, TerminZeile[]>();
  for (const t of termine) jeTag.set(t.datum, [...(jeTag.get(t.datum) ?? []), t]);

  function eintrag(t: TerminZeile) {
    const zustand: EintragZustand = t.ausgefallen ? "ausgefallen" : t.training ? "training" : nochNichtVorbereitet(t, heute) ? "noch-nicht" : "ohne";
    const text = eintragText(zustand, t.training?.name);
    // Der sichtbare Text steht im Namen zusammenhängend («18:00 Passspiel»):
    // WCAG 2.5.3 — «Uhr» dazwischen zerrisse ihn.
    const label = `${tagText(t.datum)}, ${t.beginn ? `${t.beginn} ${text}` : `Zeit fehlt, ${text}`}`;
    return <TerminEintrag key={t.id} beginn={t.beginn} zustand={zustand} name={t.training?.name} label={label} onClick={() => a.oeffnen(t)} />;
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <IconButtonLink href={hrefMonat(plusMonate(monat, -1))} icon={ChevronLeft} label="Vorheriger Monat" scroll={false} />
        <h3 ref={ueberschriftRef} tabIndex={-1} className="type-title-medium text-on-surface focus-visible:outline-none">{monatsName(monat)}</h3>
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
        // Eingegrenzt sagt die Kennzeichnung nur, was die Ansicht weiss: keinen eigenen Termin.
        leereWocheText={meine ? "Woche ohne eigenen Termin" : "Woche ohne Termin"}
        leereWoche={(tage) => tage.every((d) => !jeTag.has(d))}
        renderTag={(tag) => (
          <>
            {(jeTag.get(tag) ?? []).map(eintrag)}
            {/* Ein Termin oder, im selben Dialog, eine Serie ab diesem Tag. */}
            <button
              type="button"
              aria-label={`Am ${tagText(tag)} Termin festlegen`}
              aria-haspopup="dialog"
              onClick={() => a.neu(tag)}
              className="focus-ring mt-1 block rounded-full p-1 text-on-surface-mittel hover:text-on-surface"
            >
              <Plus size={14} aria-hidden />
            </button>
          </>
        )}
      />
    </section>
  );
}
