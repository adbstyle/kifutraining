"use client";

import { CalendarOff, CalendarPlus, MessageSquareText, Pencil, PlayCircle, Trash2, Undo2, Unlink } from "lucide-react";
import { IconButton, IconButtonLink, OverflowMenu, Tooltip, type MenuItemDef } from "@/components/ui";
import { useTerminAktionen, type TerminAktionen } from "./TerminBereich";
import { datumKurz } from "@/lib/zeit";
import type { TerminZeile } from "@/lib/queries/termine-fuer";

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
 *  Fläche der Zeile liegen und für sich bedienbar bleiben. */
export function TerminHandgriffe({ t }: { t: TerminZeile }) {
  const a = useTerminAktionen();
  return (
    <div className="relative flex shrink-0 gap-0.5">
      {!t.ausgefallen && t.training && (
        <Tooltip label="Durchführen">
          <IconButtonLink href={`/training/${t.training.id}/durchfuehren?termin=${t.id}`} icon={PlayCircle} label={`${t.training.name} durchführen`} />
        </Tooltip>
      )}
      {!t.ausgefallen && (
        <Tooltip label={t.training ? "Training ersetzen" : "Training zuordnen"}>
          <IconButton icon={CalendarPlus} label={`Training für ${datumKurz(t.datum)} ${t.training ? "ersetzen" : "zuordnen"}`} onClick={() => a.zuordnen(t)} />
        </Tooltip>
      )}
      <OverflowMenu label={`Weitere Aktionen zum Termin ${datumKurz(t.datum)}`} items={terminMenue(t, a)} />
    </div>
  );
}
