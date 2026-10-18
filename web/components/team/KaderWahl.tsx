"use client";

import { MultiSelect } from "@/components/ui";
import { KADER_MELDUNG, KADER_REGEL, giltFuerText, type Kader } from "@/lib/kader";

const gleicheMenge = (a: readonly string[], b: readonly string[]) => [...a].sort().join() === [...b].sort().join();

/** Hat sich die Wahl geändert? Die Reihenfolge zählt nicht. */
export function kaderGeaendert(neu: readonly string[], alt: readonly string[]): boolean {
  return !gleicheMenge(neu, alt);
}

/* Für welche Kader ein Termin oder eine Serie gilt (#453 AK 1, 2, 8) — als
   Mehrfachauswahl wie die Verantwortlichen (PO 2026-10-18). Unter dem Feld
   steht, für wie viele Spieler:innen er damit gilt, auch wenn das niemand
   ist; die Regel selbst steht hinter dem ⓘ. Ein begonnener Termin ändert
   seine Kader nicht mehr (AK 13): Das Feld ist dann gesperrt. */
export function KaderWahl({
  kader,
  spielerGesamt,
  wert,
  onChange,
  begonnen,
  disabled,
}: {
  kader: readonly Kader[];
  /** Wie viele Spieler:innen die Liste des Teams führt. */
  spielerGesamt: number;
  wert: string[];
  onChange: (ids: string[]) => void;
  begonnen?: boolean;
  disabled?: boolean;
}) {
  return (
    <MultiSelect
      label="Kader (optional)"
      options={kader.map((k) => ({ value: k.id, label: k.name }))}
      value={wert}
      onChange={onChange}
      searchable={kader.length > 8}
      actions={false}
      info={KADER_REGEL}
      supportingText={begonnen ? KADER_MELDUNG.KADER_TERMIN_BEGONNEN : giltFuerText(wert, kader, spielerGesamt)}
      disabled={disabled || begonnen}
    />
  );
}
