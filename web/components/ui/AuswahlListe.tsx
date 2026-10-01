import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type AuswahlEintrag = {
  id: string;
  titel: string;
  untertitel?: string;
  /** Der Titel steht gedämpft (etwa ein Eintrag, der schon belegt ist). */
  gedaempft?: boolean;
};

/* Einfachauswahl aus einer senkrechten Liste mit Titel und Untertitel — für
   Einträge, die zu lang für Chips sind und mehr als ein Wort tragen
   (Trainings, Termine). Radiogroup-Semantik wie die ChoiceChipGroup
   (`role=radiogroup` / `role=radio`, `aria-checked`): Es ist ein Eingabefeld,
   und ein `listbox` mit verschachtelten Knöpfen wäre kein gültiges ARIA.
   Der Tabstopp wandert (gewählt, sonst der erste); Pfeil hoch/runter bewegt
   Auswahl und Fokus. Die Wahl trägt zusätzlich zur Fläche ein Häkchen — die
   Auswahl darf nicht allein an einer Farbe hängen. Der Platz für das Häkchen
   bleibt reserviert, damit der Text beim Wählen nicht springt.

   Bewusst hook-frei, wie ChoiceChip: Der Fokus wandert über das DOM. */
export function AuswahlListe({
  ariaLabel,
  items,
  wert,
  onWahl,
  className,
}: {
  ariaLabel: string;
  items: AuswahlEintrag[];
  wert: string | null;
  onWahl: (id: string) => void;
  className?: string;
}) {
  const tabId = items.some((i) => i.id === wert) ? wert : items[0]?.id;

  function handleKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const richtung = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (richtung === 0) return;
    const gruppe = e.currentTarget.parentElement;
    if (!gruppe) return;
    const eintraege = Array.from(gruppe.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const i = eintraege.indexOf(e.currentTarget);
    if (i < 0) return;
    e.preventDefault();
    const ziel = eintraege[(i + richtung + eintraege.length) % eintraege.length];
    ziel.focus();
    ziel.click();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex max-h-80 flex-col gap-1 overflow-y-auto", className)}
    >
      {items.map((it) => {
        const gewaehlt = it.id === wert;
        return (
          <button
            key={it.id}
            type="button"
            role="radio"
            aria-checked={gewaehlt}
            tabIndex={it.id === tabId ? 0 : -1}
            onClick={() => onWahl(it.id)}
            onKeyDown={handleKey}
            className={cn(
              "focus-ring flex w-full items-start gap-2 rounded-flaeche px-3 py-2 text-left",
              gewaehlt ? "bg-elev-08" : "hover:bg-elev-04",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className={cn("block", it.gedaempft ? "text-on-surface-mittel" : "text-on-surface")}>
                {it.titel}
              </span>
              {it.untertitel && (
                <span className="type-body-small text-on-surface-mittel">{it.untertitel}</span>
              )}
            </span>
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-primary">
              {gewaehlt && <Check size={18} strokeWidth={2.5} aria-hidden />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
