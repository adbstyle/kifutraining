"use client";

import { MultiSelect } from "@/components/ui";
import type { TeamMitglied } from "@/lib/queries/teams";
// Nur Typen und Werte aus termine-fuer.ts: termine.ts zöge den Cookie-Client
// (next/headers) ins Client-Bundle.
import { EHEMALIGES_MITGLIED, type Verantwortlicher } from "@/lib/queries/termine-fuer";

/** Die Wahl im Feld: Konten (`userIds`) und die Einträge gelöschter Konten,
 *  die bleiben sollen (`anonyme`, Eintrags-Kennungen, #325 PC 8). */
export type VerantwortlicheWert = { userIds: string[]; anonyme: string[] };

export const KEINE_VERANTWORTLICHEN: VerantwortlicheWert = { userIds: [], anonyme: [] };

/** Die Wahl, mit der das Feld für einen bestehenden Termin öffnet — auch die
 *  Vergleichsbasis für `verantwortlicheGeaendert`. */
export function verantwortlicheStart(bisher: readonly Verantwortlicher[]): VerantwortlicheWert {
  return {
    userIds: bisher.flatMap((v) => (v.userId ? [v.userId] : [])),
    anonyme: bisher.flatMap((v) => (v.userId ? [] : [v.eintragId])),
  };
}

const gleicheMenge = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();

/** Hat sich die Wahl geändert? Die Reihenfolge zählt nicht. */
export function verantwortlicheGeaendert(neu: VerantwortlicheWert, alt: VerantwortlicheWert): boolean {
  return !gleicheMenge(neu.userIds, alt.userIds) || !gleicheMenge(neu.anonyme, alt.anonyme);
}

/** Ändern sich allein die Einträge gelöschter Konten? Das geht nur für diesen
 *  einen Termin (`erlaubteReichweiten`, `namenlose`). */
export function nurNamenloseGeaendert(neu: VerantwortlicheWert, alt: VerantwortlicheWert): boolean {
  return gleicheMenge(neu.userIds, alt.userIds) && !gleicheMenge(neu.anonyme, alt.anonyme);
}

/* Verantwortliche eines Termins oder einer Serie (#325 AK 1, 2, 7, 9). Zur
   Wahl stehen die aktuellen Mitglieder; Einträge ehemaliger Mitglieder an
   einem Termin (`bisher`) bleiben wählbar, damit man sie entfernen kann
   (AK 9), lassen sich aber nicht neu hinzufügen (AK 8): Einmal abgewählt und
   gespeichert, fehlen sie beim nächsten Öffnen. Gleichnamige unterscheidet
   die Anwendung nicht (OoS 4). */
export function VerantwortlicheWahl({
  mitglieder,
  bisher = [],
  wert,
  onChange,
  disabled,
}: {
  mitglieder: readonly TeamMitglied[];
  /** Die Einträge des geöffneten Termins; ohne: neuer Termin oder Serie. */
  bisher?: readonly Verantwortlicher[];
  wert: VerantwortlicheWert;
  onChange: (w: VerantwortlicheWert) => void;
  disabled?: boolean;
}) {
  const imTeam = new Set(mitglieder.map((m) => m.userId));
  // Ehemalig ist, wer nicht unter den geladenen Mitgliedern steht — nicht
  // bloss, wen der Termin als ehemalig führt. Sonst stünde ein eben
  // ausgetretenes Mitglied gewählt im Wert, aber in keiner Zeile der Liste,
  // und liesse sich nicht abwählen.
  const ehemalige = bisher.filter((v) => !v.userId || !imTeam.has(v.userId));
  const gruppiert = ehemalige.length > 0;
  const options = [
    ...mitglieder.map((m) => ({
      value: `u:${m.userId}`,
      label: m.anzeigeName,
      group: gruppiert ? "Mitglieder" : undefined,
    })),
    ...ehemalige.map((v) => ({
      value: v.userId ? `u:${v.userId}` : `a:${v.eintragId}`,
      label: v.name ? `${v.name} (nicht mehr im Team)` : EHEMALIGES_MITGLIED,
      group: "Ehemalige",
    })),
  ];
  const value = [...wert.userIds.map((u) => `u:${u}`), ...wert.anonyme.map((a) => `a:${a}`)];
  return (
    <MultiSelect
      label="Verantwortlich (optional)"
      placeholder="Verantwortlich (optional)"
      options={options}
      value={value}
      searchable={options.length > 8}
      actions={false}
      disabled={disabled}
      onChange={(vs) =>
        onChange({
          userIds: vs.filter((v) => v.startsWith("u:")).map((v) => v.slice(2)),
          anonyme: vs.filter((v) => v.startsWith("a:")).map((v) => v.slice(2)),
        })
      }
    />
  );
}
