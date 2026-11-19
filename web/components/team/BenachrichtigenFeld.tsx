"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Checkbox } from "@/components/ui";
import { cn } from "@/lib/cn";
import { BENACHRICHTIGEN_HINWEIS, BENACHRICHTIGEN_TEXT, type BenachrichtigenVorgang } from "@/lib/benachrichtigung";

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
  vorgang: BenachrichtigenVorgang;
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

/** Das Häkchen eines Dialogs samt Rahmen: vorbelegt an und bei jedem Öffnen
 *  wieder an (`offen` wechselt: der Dialog öffnet oder zeigt einen anderen
 *  Termin). `wert` ist der Entscheid, den der Dialog sendet — `false`, wo das
 *  Feld nicht erscheint (`sichtbar`); `feld` steht im Dialog, wo es
 *  erscheinen soll (`null`, wenn nicht sichtbar). `imStapel`: Der Dialog
 *  reiht seine Abschnitte mit Abstand (gap) — dann kein eigener. */
export function useBenachrichtigen(
  vorgang: BenachrichtigenVorgang,
  { offen, sichtbar, pending, imStapel }: { offen: unknown; sichtbar: boolean; pending?: boolean; imStapel?: boolean },
): { wert: boolean; feld: ReactNode } {
  const [an, setAn] = useState(true);
  useEffect(() => {
    setAn(true);
  }, [offen]);
  return {
    wert: sichtbar && an,
    feld: sichtbar ? (
      <div className={cn("border-t border-linie pt-4", !imStapel && "mt-4")}>
        <BenachrichtigenFeld vorgang={vorgang} className="px-3.5" checked={an} onChange={setAn} disabled={pending} />
      </div>
    ) : null,
  };
}
