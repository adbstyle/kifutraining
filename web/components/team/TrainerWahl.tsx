"use client";

import { MultiSelect, Select } from "@/components/ui";
import type { TeamMitglied } from "@/lib/queries/teams";
import { EHEMALIGES_MITGLIED, TRAINER_TEXT, type TerminTrainer, type TrainerWert } from "@/lib/trainer";

export { gleicheMenge, trainerAenderung, trainerStart, trainerVorwahl, type TrainerAenderung, type TrainerWert } from "@/lib/trainer";

/* Eingeladene und Verantwortliche eines Termins oder einer Serie (#519 AK 1–9).
   Zur Wahl stehen die aktuellen Mitglieder; Einträge ehemaliger Mitglieder an
   einem Termin (`bisher`) bleiben wählbar, damit man sie ausladen kann, lassen
   sich aber nicht neu einladen (AK 11). Unter jedem Mitglied steht seine
   E-Mail-Adresse (#425 AK 2).

   Wer verantwortlich wird, ist damit eingeladen (PC 13); wer die
   Verantwortliche auslädt, lässt den Termin ohne Verantwortliche:n (AK 9).
   Leeren lässt sich das Feld «Verantwortlich» nicht: Die Verantwortung geht
   nur weiter oder fällt mit dem Ausladen weg (AK 10). */
export function TrainerWahl({
  mitglieder,
  ich,
  bisher = [],
  wert,
  onChange,
  fehler,
  disabled,
}: {
  mitglieder: readonly TeamMitglied[];
  /** Das eigene Konto — es steht mit «(du)» da. */
  ich: string;
  /** Die Einträge des geöffneten Termins; ohne: neuer Termin oder Serie. */
  bisher?: readonly TerminTrainer[];
  wert: TrainerWert;
  onChange: (w: TrainerWert) => void;
  /** Etwa: Beim Festlegen ist niemand verantwortlich (AK 3). */
  fehler?: string;
  disabled?: boolean;
}) {
  const imTeam = new Set(mitglieder.map((m) => m.userId));
  const name = (m: TeamMitglied) => (m.userId === ich ? `${m.anzeigeName} (du)` : m.anzeigeName);
  // Ehemalig ist, wer nicht unter den geladenen Mitgliedern steht — nicht
  // bloss, wen der Termin als ehemalig führt. Sonst stünde ein eben
  // ausgetretenes Mitglied gewählt im Wert, aber in keiner Zeile der Liste.
  const ehemalige = bisher.filter((t) => !t.userId || !imTeam.has(t.userId));
  const bekannt = new Set(ehemalige.flatMap((t) => (t.userId ? [t.userId] : [])));
  const unbekannte = wert.eingeladene.filter((u) => !imTeam.has(u) && !bekannt.has(u));
  const ehemaligName = (t: TerminTrainer) => (t.name ? `${t.name} (nicht mehr im Team)` : EHEMALIGES_MITGLIED);
  const gruppiert = ehemalige.length > 0 || unbekannte.length > 0;
  const optionen = [
    ...mitglieder.map((m) => ({
      value: `u:${m.userId}`,
      label: name(m),
      zusatz: m.email,
      group: gruppiert ? "Mitglieder" : undefined,
    })),
    ...ehemalige.map((t) => ({
      value: t.userId ? `u:${t.userId}` : `a:${t.eintragId}`,
      label: ehemaligName(t),
      group: "Ehemalige",
    })),
    ...unbekannte.map((u) => ({ value: `u:${u}`, label: EHEMALIGES_MITGLIED, group: "Ehemalige" })),
  ];
  const eingeladen = [...wert.eingeladene.map((u) => `u:${u}`), ...wert.anonyme.map((a) => `a:${a}`)];

  // Verantwortlich werden nur aktuelle Mitglieder; eine ehemalige
  // Verantwortliche bleibt sichtbar, bis jemand übernimmt oder sie ausgeladen ist.
  const bisherige = ehemalige.find((t) => t.userId && t.userId === wert.verantwortlich);
  const verantwortlichOptionen = [
    ...mitglieder.map((m) => ({ value: m.userId, label: name(m) })),
    ...(bisherige ? [{ value: bisherige.userId!, label: ehemaligName(bisherige) }] : []),
  ];
  const zahl = wert.eingeladene.filter((u) => imTeam.has(u)).length;

  return (
    <>
      <MultiSelect
        label="Eingeladen"
        options={optionen}
        value={eingeladen}
        searchable={optionen.length > 8}
        actions={false}
        disabled={disabled}
        supportingText={`${zahl} von ${mitglieder.length} Mitgliedern eingeladen.`}
        onChange={(vs) => {
          const eingeladene = vs.filter((v) => v.startsWith("u:")).map((v) => v.slice(2));
          onChange({
            eingeladene,
            anonyme: vs.filter((v) => v.startsWith("a:")).map((v) => v.slice(2)),
            // Ausladen wirkt immer, auch bei der Verantwortlichen (AK 9).
            verantwortlich: wert.verantwortlich && eingeladene.includes(wert.verantwortlich) ? wert.verantwortlich : null,
          });
        }}
      />
      <Select
        label="Verantwortlich"
        options={verantwortlichOptionen}
        value={wert.verantwortlich ?? ""}
        disabled={disabled}
        error={!!fehler}
        supportingText={fehler ?? (wert.verantwortlich ? undefined : "Niemand ist verantwortlich.")}
        info={`${TRAINER_TEXT.verantwortlichHinweis} Lädst du sie aus, steht der Termin ohne Verantwortliche da.`}
        onChange={(v) =>
          onChange({
            ...wert,
            verantwortlich: v,
            // Wer verantwortlich wird, ist damit eingeladen (PC 13).
            eingeladene: wert.eingeladene.includes(v) ? wert.eingeladene : [...wert.eingeladene, v],
          })
        }
      />
    </>
  );
}
