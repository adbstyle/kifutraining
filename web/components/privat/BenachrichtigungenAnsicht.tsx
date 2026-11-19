"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, Bell } from "lucide-react";
import { Button, Leerzustand } from "@/components/ui";
import { ELTERN_TEXT, gruppiere, zumTermin, type LinkBenachrichtigungen } from "@/lib/benachrichtigung";
import { BenachrichtigungEintrag } from "./BenachrichtigungEintrag";

/* Die Ansicht «Benachrichtigungen» am privaten Link (#642 AK 1, 2, 4, 5): ersetzt
   Chips und Terminliste, der Kopf der Seite bleibt. Gruppen «Neu» und «Früher»
   (neu = nach `neuSeit` entstanden), am Ende der Satz, was KiFu speichert und
   was das Gerät festhält. Beim Öffnen geht der Fokus auf die Überschrift, damit
   die Vorlesehilfe die Ansicht nennt.

   Die Seite aktualisiert nichts von selbst (OoS 3): Neues erscheint erst nach
   dem Neuladen. */
export function BenachrichtigungenAnsicht({
  daten,
  neuSeit,
  terminIds,
  onZurueck,
  onZumTermin,
}: {
  daten: LinkBenachrichtigungen;
  neuSeit: number | null;
  /** Die Termine, die am Link stehen — nur dorthin führt «Zum Termin». */
  terminIds: ReadonlySet<string>;
  onZurueck: () => void;
  onZumTermin: (terminId: string) => void;
}) {
  const titelRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titelRef.current?.focus();
  }, []);
  const { neu, frueher } = gruppiere(daten.eintraege, neuSeit);
  const liste = (titel: string, eintraege: typeof neu, istNeu: boolean) =>
    eintraege.length > 0 && (
      <section aria-label={titel} className="flex flex-col gap-2">
        {/* Ohne «Neu»-Gruppe braucht «Früher» keinen Titel: Es ist die ganze Liste. */}
        {(istNeu || neu.length > 0) && <h3 className="type-title-small text-on-surface">{titel}</h3>}
        <ul className="flex flex-col gap-2">
          {eintraege.map((e) => {
            const ziel = zumTermin(e, terminIds);
            return (
              <BenachrichtigungEintrag
                key={e.id}
                e={e}
                neu={istNeu}
                heute={daten.heute}
                amLink={ziel !== null}
                onZumTermin={ziel ? () => onZumTermin(ziel) : undefined}
              />
            );
          })}
        </ul>
      </section>
    );
  return (
    <section aria-labelledby="benachrichtigungen-titel" className="flex flex-col gap-4 px-4 py-4">
      <div className="flex flex-col items-start gap-2">
        <Button variant="quiet" onClick={onZurueck}>
          <ArrowLeft size={16} strokeWidth={2} aria-hidden />
          {ELTERN_TEXT.zurueck}
        </Button>
        <h2 id="benachrichtigungen-titel" ref={titelRef} tabIndex={-1} className="type-title-large text-on-surface focus:outline-none">
          {ELTERN_TEXT.titel}
        </h2>
      </div>
      {daten.eintraege.length === 0 ? (
        <Leerzustand icon={Bell} titel={ELTERN_TEXT.leerTitel} dicht>
          {ELTERN_TEXT.leer}
        </Leerzustand>
      ) : (
        <>
          {liste(ELTERN_TEXT.neu, neu, true)}
          {liste(ELTERN_TEXT.frueher, frueher, false)}
        </>
      )}
      <p className="type-body-small text-on-surface-mittel">{ELTERN_TEXT.speicher}</p>
    </section>
  );
}
