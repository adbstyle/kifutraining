"use client";

import { Checkbox } from "@/components/ui";
import { BENACHRICHTIGEN_HINWEIS, BENACHRICHTIGEN_TEXT, type BenachrichtigungEreignis } from "@/lib/benachrichtigung";

/* Das Häkchen «Spielervertretungen benachrichtigen» (Epic #641, Prinzip 4) in
   den Dialogen der Mitglieder — vorbelegt an, mit der Zeile darunter, was die
   Spielervertretung davon sieht. Label und Zeilen stehen in
   `lib/benachrichtigung.ts`, dieselben Wörter trägt die Beschreibung des
   KI-Werkzeugs. Ob das Feld erscheint, entscheidet der Dialog (nur dort, wo
   eine Benachrichtigung entstehen kann); es trägt nichts, was nicht
   erscheint. */
export function BenachrichtigenFeld({
  vorgang,
  checked,
  onChange,
  disabled,
  className,
}: {
  vorgang: BenachrichtigungEreignis;
  checked: boolean;
  onChange: (an: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Checkbox
      label={BENACHRICHTIGEN_TEXT.label}
      hinweis={BENACHRICHTIGEN_HINWEIS[vorgang]}
      className={className}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
