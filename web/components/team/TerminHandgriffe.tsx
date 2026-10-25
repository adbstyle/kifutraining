"use client";

import { CalendarOff, CalendarPlus, MessageSquareText, Plus, Pencil, PlayCircle, Trash2, Undo2, Unlink, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { OverflowMenu, type MenuItemDef } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useTerminAktionen, type TerminAktionen } from "./TerminBereich";
import { datumKurz, terminBegonnen } from "@/lib/zeit";
import type { TerminZeile } from "@/lib/queries/termine-fuer";
import { istEingeladen } from "@/lib/trainer";

/** «+ Training hinzufügen» an einem anstehenden Termin ohne Training — an der
 *  Stelle, wo sonst sein Name steht, in Primary wie ein Link (Epic #490,
 *  Tafel 2). Ein Klick öffnet das Zuordnen. `className` setzt die Schrift der
 *  Stelle. Positioniert, damit es über der Fläche einer Zeile liegt. */
export function TrainingHinzufuegen({ t, className }: { t: TerminZeile; className?: string }) {
  const a = useTerminAktionen();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => a.zuordnen(t)}
      className={cn("focus-ring pointer-events-auto relative inline-flex items-center gap-1 rounded-klein text-primary hover:underline", className)}
    >
      <Plus size={16} strokeWidth={2.5} aria-hidden className="shrink-0" />
      Training hinzufügen
    </button>
  );
}

/** Die Handgriffe eines Termins im Menü «Weitere Aktionen» — dieselben an
 *  jeder Zeile und am nächsten Termin (#402 AK 17, #403 AK 15). Wer zu einem
 *  bevorstehenden Termin nicht eingeladen ist, lädt sich hier selbst ein —
 *  an einem Serientermin nur zu diesem (#519 AK 25, PC 12). */
export function terminMenue(t: TerminZeile, a: TerminAktionen): MenuItemDef[] {
  const aushelfen = !t.ausgefallen && !terminBegonnen(t.datum, t.beginn) && !istEingeladen(t.trainer, a.ich);
  return [
    ...(aushelfen
      ? [{ label: "Ich helfe aus", icon: UserPlus, onSelect: () => a.trainer(t, { einladen: [a.ich] }, "Du bist eingeladen.") }]
      : []),
    ...(t.ausgefallen
      ? [
          { label: "Grund ändern", icon: MessageSquareText, onSelect: () => a.ausfallen(t) },
          { label: "Ausfall zurücknehmen", icon: Undo2, onSelect: () => a.ausfallZuruecknehmen(t) },
        ]
      : []),
    { label: t.art === "spiel" ? "Spiel ändern" : "Termin ändern", icon: Pencil, onSelect: () => a.bearbeiten(t) },
    ...(t.training ? [{ label: "Training lösen", icon: Unlink, onSelect: () => a.loesen(t) }] : []),
    ...(!t.ausgefallen ? [{ label: "Ausfallen lassen", icon: CalendarOff, onSelect: () => a.ausfallen(t) }] : []),
    { label: t.art === "spiel" ? "Spiel entfernen" : "Termin entfernen", icon: Trash2, danger: true, onSelect: () => a.entfernen(t) },
  ];
}

/** Alle Handgriffe an einer Terminzeile (#402 AK 16, 17) in einem Menü —
 *  auch Durchführen und Zuordnen, damit die Zeile ruhig bleibt (PO
 *  2026-10-22). Positioniert, damit das Menü über der Fläche der Zeile liegt
 *  und für sich bedienbar bleibt. `zuordnen: false`, wo die Zeile das
 *  Zuordnen schon selbst anbietet («Training hinzufügen»). */
export function TerminHandgriffe({ t, zuordnen = true }: { t: TerminZeile; zuordnen?: boolean }) {
  const a = useTerminAktionen();
  const router = useRouter();
  const training = t.training;
  return (
    <div className="relative flex shrink-0">
      <OverflowMenu
        label={`Weitere Aktionen zum Termin ${datumKurz(t.datum)}`}
        items={[
          ...(!t.ausgefallen && training
            ? [{ label: "Durchführen", icon: PlayCircle, onSelect: () => router.push(`/training/${training.id}/durchfuehren?termin=${t.id}`) }]
            : []),
          // Ein Spiel trägt nie ein Training (#459 AK 14).
          ...(!t.ausgefallen && zuordnen && t.art === "training"
            ? [{ label: training ? "Training ersetzen" : "Training zuordnen", icon: CalendarPlus, onSelect: () => a.zuordnen(t) }]
            : []),
          ...terminMenue(t, a),
        ]}
      />
    </div>
  );
}
