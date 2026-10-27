"use client";

import { ExternalLink } from "lucide-react";
import { Feldgruppe, TextField } from "@/components/ui";
import { feldTrailingKnopf } from "@/components/ui/TextField";
import { KARTENLINK_MAX, ORT_MAX, TERMIN_TEXT, kartenlinkProblem, leerZuNull } from "@/lib/termin";

/* Ort und Kartenlink eines Termins oder einer Serie (#533) — als Paar in der
   Feldgruppe «Ort»: Der Link gehört zum Ort, ohne Ort ist er gesperrt (AK 4).
   Ein dynamischer Hinweis (etwa «fällt weg», AK 12) steht unter dem Link;
   wer den Link liest, steht fest hinter dem ⓘ. Ein gültiger Link lässt sich
   am Feld öffnen, um ihn zu prüfen. */
export function OrtFelder({
  ort,
  ortLink,
  onOrt,
  onOrtLink,
  fehlerOrt,
  fehlerLink,
  hinweis,
  disabled,
}: {
  ort: string;
  ortLink: string;
  onOrt: (v: string) => void;
  onOrtLink: (v: string) => void;
  fehlerOrt?: string;
  fehlerLink?: string;
  hinweis?: string;
  disabled?: boolean;
}) {
  const ohneOrt = leerZuNull(ort) === null;
  const link = leerZuNull(ortLink);
  const oeffnen =
    link && !kartenlinkProblem(link) ? (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        aria-label="Kartenlink öffnen"
        className={feldTrailingKnopf}
      >
        <ExternalLink size={20} aria-hidden />
      </a>
    ) : undefined;
  return (
    <Feldgruppe legende="Ort">
      <TextField
        label="Ort (optional)"
        maxLength={ORT_MAX}
        value={ort}
        onChange={(e) => onOrt(e.target.value)}
        error={!!fehlerOrt}
        supportingText={fehlerOrt}
        disabled={disabled}
      />
      <TextField
        label="Kartenlink (optional)"
        type="url"
        inputMode="url"
        autoComplete="off"
        maxLength={KARTENLINK_MAX}
        value={ortLink}
        onChange={(e) => onOrtLink(e.target.value)}
        info={TERMIN_TEXT.kartenlinkSichtbar}
        error={!!fehlerLink}
        supportingText={fehlerLink ?? hinweis ?? (ohneOrt ? TERMIN_TEXT.kartenlinkOhneOrt : undefined)}
        disabled={disabled || ohneOrt}
        trailing={oeffnen}
      />
    </Feldgruppe>
  );
}
