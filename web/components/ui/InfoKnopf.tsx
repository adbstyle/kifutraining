"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { IconButton } from "./IconButton";
import { Tooltip } from "./Tooltip";
import { usePanelAnker } from "./use-panel-anker";

/* Ein fester Hinweis hinter einem ⓘ (Epic #363, nach dem Vorbild von Jira).
   Was ein Feld erklärt, aber nicht meldet — «Die Person braucht bereits ein
   bestätigtes KiFu-Konto.» —, muss nicht jederzeit unter dem Feld stehen; das
   Formular bleibt so eine ruhige Liste von Namen und Werten. Beim Zeigen sagt
   ein Tooltip, was das Zeichen tut, ein Klick öffnet ein kleines Panel mit
   dem Text. Esc oder ein Klick daneben schliesst es.

   Nur für feste Hinweise: Fehler und Hinweise, die sich mit der Eingabe
   ändern, bleiben sichtbar unter dem Feld (`supportingText`). Die
   Vorlesehilfe hört den Hinweis ohnehin mit dem Feld — `Feld` hängt ihn
   unsichtbar per `aria-describedby` an. */
export function InfoKnopf({ label, children }: { label: string; children: ReactNode }) {
  const [offen, setOffen] = useState(false);
  const panelId = useId();
  const { wurzelRef, triggerRef, panelRef, messe, panelStil, panelLage } =
    usePanelAnker<HTMLButtonElement>({ offen, onSchliessen: () => setOffen(false), maxHoehe: 240 });

  return (
    <div
      ref={wurzelRef}
      className="relative shrink-0"
      onKeyDown={(e) => {
        if (e.key === "Escape" && offen) {
          e.preventDefault();
          setOffen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <Tooltip label="Hinweis anzeigen" ende>
        <IconButton
          ref={triggerRef}
          type="button"
          icon={Info}
          // Kleiner als die übrigen Zeichen: Der Hinweis ist Beiwerk, die
          // Trefferfläche bleibt beim Mass aller Knöpfe (36 px).
          iconProps={{ size: 16 }}
          label={`Hinweis zu ${label}`}
          aria-expanded={offen}
          aria-controls={offen ? panelId : undefined}
          onClick={() => {
            if (!offen) messe();
            setOffen((o) => !o);
          }}
        />
      </Tooltip>
      {offen && (
        <div
          ref={panelRef}
          id={panelId}
          // Sichtbare Kopie des Hinweises; vorgelesen wird er schon mit dem Feld.
          aria-hidden
          style={panelStil}
          className={`absolute z-50 w-max max-w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-flaeche border border-linie bg-elev-08 px-4 py-3 shadow-dp-08 type-body-medium text-on-surface ${panelLage}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
