"use client";

import { X } from "lucide-react";
import { Feldgruppe, HinzufuegenFeld, IconButton, TextField, TimeField } from "@/components/ui";
import { TREFFPUNKT_ORT_MAX } from "@/lib/spiel";
import {
  TERMIN_TEXT,
  istUhrzeit,
  treffpunktVorlauf,
  treffpunktZeit,
  type TerminTreffpunkt,
} from "@/lib/termin";

/** Der Treffpunkt eines Trainings im Dialog (#561), solange getippt wird:
 *  Die Uhrzeit gilt zum Beginn, zu dem sie eingegeben wurde (`beginn`). */
export type TrainingsTreffpunktEingabe = { zeit: string; ort: string; beginn: string } | null;

/** Die Eingabe eines gespeicherten Treffpunkts zum Beginn des Termins. */
export function treffpunktEingabe(t: TerminTreffpunkt | null | undefined, beginn: string): TrainingsTreffpunktEingabe {
  return t ? { zeit: t.zeit, ort: t.ort, beginn } : null;
}

/** Die Uhrzeit zum aktuellen Beginn im Dialog: Wird er verlegt, wandert der
 *  Treffpunkt im selben Abstand mit (#561 PC 1). `entfaellt`, wenn er dann am
 *  Vortag läge (PC 4) — gespeichert entscheidet der Kern samt Rückfrage. */
function zumBeginn(e: NonNullable<TrainingsTreffpunktEingabe>, beginn: string): { zeit: string; entfaellt: boolean } {
  if (!istUhrzeit(e.zeit) || !istUhrzeit(e.beginn) || !istUhrzeit(beginn)) return { zeit: e.zeit, entfaellt: false };
  const vorlauf = treffpunktVorlauf(e.beginn, e.zeit);
  // Nach dem Beginn eingegeben: Sie bleibt stehen, die Prüfung meldet es (AK 5).
  if (vorlauf < 0) return { zeit: e.zeit, entfaellt: false };
  const zeit = treffpunktZeit(beginn, vorlauf);
  return zeit === null ? { zeit: e.zeit, entfaellt: true } : { zeit, entfaellt: false };
}

/** Was der Dialog sendet: `null` ohne Treffpunkt; `undefined`, wenn er mit
 *  dem neuen Beginn entfiele — dann lässt der Dialog ihn unverändert, und der
 *  Kern fragt vor dem Speichern nach (PC 5). */
export function treffpunktAusEingabe(e: TrainingsTreffpunktEingabe, beginn: string): TerminTreffpunkt | null | undefined {
  if (!e) return null;
  const z = zumBeginn(e, beginn);
  return z.entfaellt ? undefined : { zeit: z.zeit, ort: e.ort };
}

/** Wie lange der Treffpunkt vor dem Beginn liegt: «15 Minuten vor Beginn». */
function abstandText(zeit: string, beginn: string): string | undefined {
  if (!istUhrzeit(zeit) || !istUhrzeit(beginn) || zeit > beginn) return undefined;
  const m = treffpunktVorlauf(beginn, zeit);
  if (m === 0) return "Zum Beginn";
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const teile = [h > 0 && `${h} ${h === 1 ? "Stunde" : "Stunden"}`, rest > 0 && `${rest} ${rest === 1 ? "Minute" : "Minuten"}`];
  return `${teile.filter(Boolean).join(" ")} vor Beginn`;
}

/* Der Treffpunkt eines Trainings (#561 AK 1, 3, 11): eine Feldgruppe wie der
   Ort — Uhrzeit am Termintag und Ort, beides Pflicht. Ohne Treffpunkt steht
   «Treffpunkt hinzufügen (optional)»; das ✕ entfernt ihn. Wer ihn sieht und
   was beim Verlegen geschieht, steht fest hinter dem ⓘ; unter der Uhrzeit,
   wie lange er vor dem Beginn liegt. */
export function TreffpunktFelder({
  wert,
  onChange,
  beginn,
  fehler,
  disabled,
}: {
  wert: TrainingsTreffpunktEingabe;
  onChange: (w: TrainingsTreffpunktEingabe) => void;
  /** Der Beginn im Dialog `HH:MM`. */
  beginn: string;
  fehler?: string;
  disabled?: boolean;
}) {
  if (!wert)
    return (
      <HinzufuegenFeld info={TERMIN_TEXT.treffpunktSichtbar} disabled={disabled} onClick={() => onChange({ zeit: "", ort: "", beginn })}>
        Treffpunkt hinzufügen (optional)
      </HinzufuegenFeld>
    );
  const z = zumBeginn(wert, beginn);
  return (
    <Feldgruppe legende="Treffpunkt">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row">
          <TimeField
            label="Uhrzeit"
            className="sm:w-40"
            value={z.zeit}
            info={TERMIN_TEXT.treffpunktSichtbar}
            error={!!fehler}
            supportingText={z.entfaellt ? TERMIN_TEXT.treffpunktEntfaellt : abstandText(z.zeit, beginn)}
            disabled={disabled}
            onChange={(e) => onChange({ ...wert, zeit: e.target.value, beginn })}
          />
          <TextField
            label="Ort"
            className="flex-1"
            maxLength={TREFFPUNKT_ORT_MAX}
            value={wert.ort}
            error={!!fehler}
            disabled={disabled}
            onChange={(e) => onChange({ ...wert, ort: e.target.value })}
          />
        </div>
        <IconButton type="button" icon={X} label="Treffpunkt entfernen" disabled={disabled} onClick={() => onChange(null)} />
      </div>
      {fehler && <p className="type-body-small px-3.5 text-error">{fehler}</p>}
    </Feldgruppe>
  );
}
