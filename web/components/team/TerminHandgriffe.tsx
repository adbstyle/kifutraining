"use client";

import { CalendarOff, CalendarPlus, ClipboardList, MessageSquareText, Pencil, PlayCircle, Trash2, Undo2, Unlink } from "lucide-react";
import { IconButton, IconButtonLink, OverflowMenu, Tooltip, type MenuItemDef } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useTerminAktionen, type TerminAktionen } from "./TerminBereich";
import { datumKurz } from "@/lib/zeit";
import type { TerminZeile } from "@/lib/queries/termine-fuer";

/** «Training hinzufügen» an einem anstehenden Termin ohne Training — wie
 *  «Dauer hinzufügen» an einer Übung im Training (`DauerWert`): gedämpft an
 *  der Stelle, wo sonst das Training steht, mit Zustands-Ebene beim
 *  Überfahren. Ein Klick öffnet das Zuordnen. `className` setzt die Schrift
 *  der Stelle. Positioniert, damit es über der Fläche einer Zeile liegt. */
export function TrainingHinzufuegen({ t, className }: { t: TerminZeile; className?: string }) {
  const a = useTerminAktionen();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => a.zuordnen(t)}
      className={cn(
        "state focus-ring pointer-events-auto relative -mx-2 -my-1 inline-flex items-center gap-1.5 rounded-flaeche px-2 py-1 text-on-surface-mittel",
        className,
      )}
    >
      <ClipboardList size={14} strokeWidth={2} aria-hidden className="shrink-0" />
      Training hinzufügen
    </button>
  );
}

/** Die Handgriffe eines Termins im Menü «Weitere Aktionen» — dieselben an
 *  jeder Zeile und am nächsten Termin (#402 AK 17, #403 AK 15). */
export function terminMenue(t: TerminZeile, a: TerminAktionen): MenuItemDef[] {
  return [
    ...(t.ausgefallen
      ? [
          { label: "Grund ändern", icon: MessageSquareText, onSelect: () => a.ausfallen(t) },
          { label: "Ausfall zurücknehmen", icon: Undo2, onSelect: () => a.ausfallZuruecknehmen(t) },
        ]
      : []),
    { label: "Termin ändern", icon: Pencil, onSelect: () => a.bearbeiten(t) },
    ...(t.training ? [{ label: "Training lösen", icon: Unlink, onSelect: () => a.loesen(t) }] : []),
    ...(!t.ausgefallen ? [{ label: "Ausfallen lassen", icon: CalendarOff, onSelect: () => a.ausfallen(t) }] : []),
    { label: "Termin entfernen", icon: Trash2, danger: true, onSelect: () => a.entfernen(t) },
  ];
}

/** Alle Handgriffe an einer Terminzeile (#402 AK 16, 17): Durchführen und
 *  Zuordnen als Knöpfe, der Rest im Menü. Positioniert, damit sie über der
 *  Fläche der Zeile liegen und für sich bedienbar bleiben. `zuordnen: false`,
 *  wo die Zeile das Zuordnen schon selbst anbietet («Training hinzufügen»). */
export function TerminHandgriffe({ t, zuordnen = true }: { t: TerminZeile; zuordnen?: boolean }) {
  const a = useTerminAktionen();
  return (
    <div className="relative flex shrink-0 gap-0.5">
      {!t.ausgefallen && t.training && (
        <Tooltip label="Durchführen">
          <IconButtonLink href={`/training/${t.training.id}/durchfuehren?termin=${t.id}`} icon={PlayCircle} label={`${t.training.name} durchführen`} />
        </Tooltip>
      )}
      {!t.ausgefallen && zuordnen && (
        <Tooltip label={t.training ? "Training ersetzen" : "Training zuordnen"}>
          <IconButton icon={CalendarPlus} label={`Training für ${datumKurz(t.datum)} ${t.training ? "ersetzen" : "zuordnen"}`} onClick={() => a.zuordnen(t)} />
        </Tooltip>
      )}
      <OverflowMenu label={`Weitere Aktionen zum Termin ${datumKurz(t.datum)}`} items={terminMenue(t, a)} />
    </div>
  );
}
