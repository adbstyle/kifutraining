"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { setzeAnzeigename } from "@/lib/actions/profil";
import { useBlurSpeichern } from "@/lib/use-blur-speichern";

/* Der Anzeigename als Feld (Team-Epic Story 2) — gespeichert wird beim
   Verlassen oder mit Enter, ohne Knopf, wie der Teamname und der
   Trainingsname (`useBlurSpeichern`); Esc nimmt die Eingabe zurück. Wer noch
   keinen eigenen Namen gewählt hat, sieht den automatisch vergebenen als
   Wert — so, wie er heute erscheint. Eine leere Eingabe oder eine, die der
   Server abweist, fällt auf den gespeicherten Namen zurück und meldet sich am
   Bildschirmrand, ein gelungenes Speichern ebenfalls.

   Der Hinweis hinter dem ⓘ sagt, wer den Namen sieht: Er ist die einzige
   Personenangabe, die andere zu sehen bekommen, auch an öffentlichen
   Vorlagen. */
export function AnzeigenameForm({ aktuell }: { aktuell: string }) {
  const router = useRouter();
  const melde = useSnackbar();
  // Der Name gilt sofort, nicht erst mit frischen Serverdaten (wie beim
  // Teamnamen): Sonst wäre bis dahin der alte Name der Vergleichswert.
  const [gilt, setGilt] = useState(aktuell);

  async function speichere(naechster: string) {
    const vorher = gilt;
    setGilt(naechster);
    const res = await setzeAnzeigename(naechster);
    if (!res.ok) {
      setGilt(vorher);
      melde(res.error);
      return;
    }
    melde("Anzeigename gespeichert.");
    router.refresh();
  }

  const { entwurf, setEntwurf, beiVerlassen } = useBlurSpeichern({
    wert: gilt,
    pruefe: (name) => (name ? null : "Bitte einen Anzeigenamen angeben."),
    speichere: (naechster) => void speichere(naechster),
    onFehler: melde,
  });

  return (
    <TextField
      label="Anzeigename"
      value={entwurf}
      maxLength={40}
      onChange={(e) => setEntwurf(e.target.value)}
      onBlur={beiVerlassen}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setEntwurf(gilt);
        }
      }}
      info="Für Team-Mitglieder und an deinen veröffentlichten Vorlagen öffentlich sichtbar. Deine E-Mail-Adresse sieht niemand."
    />
  );
}
