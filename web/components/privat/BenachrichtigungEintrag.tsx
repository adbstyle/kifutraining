import { CalendarCheck, CalendarClock, CalendarOff, CalendarPlus, CalendarRange, CalendarX2, type LucideIcon } from "lucide-react";
import { Button, Lozenge } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  ELTERN_TEXT,
  eintragNegativ,
  eintragTitel,
  eintragWann,
  eintragWo,
  eintragWort,
  eintragZusaetze,
  erhaltenText,
  nurWegfall,
  type BenachrichtigungEreignis,
  type LinkBenachrichtigung,
} from "@/lib/benachrichtigung";

/** Das Zeichen zum Ereignis. */
const ICON: Record<BenachrichtigungEreignis, LucideIcon> = {
  neues_spiel: CalendarPlus,
  ausfall: CalendarX2,
  ruecknahme: CalendarCheck,
  verlegung: CalendarClock,
  wegfall: CalendarOff,
  serie: CalendarRange,
};

/* Ein Eintrag in der Ansicht «Benachrichtigungen» (#642 AK 3, 4): das Zeichen
   des Ereignisses im runden Feld, das Wort dazu und — solange der Eintrag neu
   ist — die Lozenge «Neu»; darunter «Titel · Team», wann, wo und, was sich
   sonst geändert hat. Rot trägt nur, was nicht mehr stattfindet (Ausfall,
   Wegfall, auch der reine Wegfall einer Serie). Eine Momentaufnahme: Der Eintrag zeigt den Stand beim Ereignis,
   spätere Änderungen übernimmt er nicht.

   «Zum Termin» führt zur Karte, solange der Termin am Link steht (`amLink`);
   sonst sagt ein Satz, dass er nicht mehr dort steht — bei Ereignissen zu
   einem einzelnen Termin. Die Serienänderung hat keinen einzelnen Termin. */
export function BenachrichtigungEintrag({
  e,
  neu,
  heute,
  amLink,
  onZumTermin,
}: {
  e: LinkBenachrichtigung;
  neu: boolean;
  /** Der heutige Tag am Trainingsort (vom Server). */
  heute: string;
  /** Steht der Termin dieses Eintrags noch am Link? */
  amLink: boolean;
  onZumTermin?: () => void;
}) {
  const negativ = eintragNegativ(e);
  const Icon = nurWegfall(e) ? ICON.wegfall : ICON[e.ereignis];
  const wann = eintragWann(e);
  const wo = eintragWo(e);
  const zusaetze = eintragZusaetze(e);
  return (
    <li className="flex gap-3 rounded-flaeche bg-elev-01 px-3 py-3">
      <span
        aria-hidden
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          negativ ? "bg-section-danger text-icon-danger" : "bg-section-information text-icon-information",
        )}
      >
        <Icon size={20} strokeWidth={2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("type-label-medium", negativ ? "text-error" : "text-on-surface-mittel")}>{eintragWort(e)}</span>
          {neu && <Lozenge appearance="discovery">{ELTERN_TEXT.neu}</Lozenge>}
        </span>
        <span className="max-w-full break-words type-title-small text-on-surface">{eintragTitel(e)}</span>
        {wann && <span className="type-body-medium text-on-surface">{wann}</span>}
        {wo && <span className="max-w-full break-words type-body-small text-on-surface-mittel">{wo}</span>}
        {zusaetze.map((z) => (
          <span key={z} className="type-body-small text-on-surface-mittel">
            {z}
          </span>
        ))}
        <span className="type-body-small text-on-surface-mittel">{erhaltenText(e.erstellt_tag, heute)}</span>
        {amLink && onZumTermin ? (
          <Button variant="outlined" className="mt-1" onClick={onZumTermin}>
            {ELTERN_TEXT.zumTermin}
          </Button>
        ) : (
          e.ereignis !== "serie" && <span className="type-body-small text-on-surface-mittel">{ELTERN_TEXT.nichtMehr}</span>
        )}
      </div>
    </li>
  );
}
