"use client";

import { ChoiceChip, ChoiceChipGroup, SectionMessage, TextField, feldNameKlasse } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  BESETZUNG_MAX,
  BESETZUNG_MIN,
  BESETZUNG_TEXT,
  besetzungProblem,
  verhaeltnisHinweis,
  type BesetzungArt,
  type Mindestbesetzung,
} from "@/lib/besetzung";

/** Wie das Feld die Angabe führt: die Zahl als Text, solange getippt wird. */
export type BesetzungEingabe = { art: BesetzungArt | null; zahl: string };

export const KEINE_BESETZUNG: BesetzungEingabe = { art: null, zahl: "" };

export function besetzungEingabe(m: Mindestbesetzung): BesetzungEingabe {
  return m ? { art: m.art, zahl: String(m.zahl) } : KEINE_BESETZUNG;
}

/** Die Eingabe als Angabe — oder der Satz, warum sie keine ist (#521 AK 5). */
export function besetzungAusEingabe(e: BesetzungEingabe): { ok: true; wert: Mindestbesetzung } | { ok: false; text: string } {
  if (!e.art) return { ok: true, wert: null };
  const zahl = e.zahl.trim() === "" ? NaN : Number(e.zahl);
  const wert = { art: e.art, zahl };
  const p = besetzungProblem(wert);
  return p ? { ok: false, text: p } : { ok: true, wert };
}

/* Die Mindestbesetzung eines Termins oder einer Serie (#521 AK 1, 2, 5, 14,
   15; Tafel «Termin erstellen»): keine, eine feste Zahl an Trainer:innen
   oder ein Verhältnis Spieler:innen je Trainer:in. Beim Verhältnis sagt ein
   Hinweis gleich, wie viele es bei der Spielerzahl verlangt, für die der
   Termin bzw. die Serie gilt — oder dass erst gerechnet wird, sobald eine
   Spielerzahl bekannt ist. */
export function MindestbesetzungFeld({
  wert,
  onChange,
  spielerzahl,
  spielerWort = "angemeldeten",
  fehler,
  disabled,
}: {
  wert: BesetzungEingabe;
  onChange: (w: BesetzungEingabe) => void;
  /** Die Spielerzahl, für die der Termin gilt; `null`: unbekannt. */
  spielerzahl: number | null;
  /** «angemeldeten» oder «erwarteten». */
  spielerWort?: string;
  fehler?: string;
  disabled?: boolean;
}) {
  const wahl: { art: BesetzungArt | null; label: string }[] = [
    { art: null, label: "Keine" },
    { art: "fest", label: "Feste Zahl" },
    { art: "verhaeltnis", label: "Verhältnis" },
  ];
  const geprueft = besetzungAusEingabe(wert);
  return (
    <div className="flex flex-col gap-3">
      <fieldset>
        <legend className={cn(feldNameKlasse(false), "flex w-full items-center justify-between")}>Mindestbesetzung (optional)</legend>
        <ChoiceChipGroup ariaLabel="Mindestbesetzung" className="mt-1.5 px-3.5">
          {wahl.map((w) => (
            <ChoiceChip
              key={w.label}
              selected={wert.art === w.art}
              onSelect={() => !disabled && onChange({ art: w.art, zahl: w.art === null ? "" : wert.zahl })}
            >
              {w.label}
            </ChoiceChip>
          ))}
        </ChoiceChipGroup>
      </fieldset>
      {wert.art && (
        <TextField
          label={wert.art === "fest" ? "Trainer:innen" : "Spieler:innen je Trainer:in"}
          className="max-w-xs"
          type="number"
          inputMode="numeric"
          min={BESETZUNG_MIN}
          max={BESETZUNG_MAX}
          value={wert.zahl}
          disabled={disabled}
          error={!!fehler}
          supportingText={fehler}
          onChange={(e) => onChange({ ...wert, zahl: e.target.value })}
        />
      )}
      {wert.art === "verhaeltnis" && (
        <SectionMessage appearance="information" role="status">
          {geprueft.ok && geprueft.wert ? verhaeltnisHinweis(geprueft.wert, spielerzahl, spielerWort) : spielerzahl === null ? BESETZUNG_TEXT.ohneZahl : "Gib an, wie viele Spieler:innen auf eine Trainer:in kommen."}
        </SectionMessage>
      )}
    </div>
  );
}
