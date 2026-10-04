"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { setzeAnzeigename } from "@/lib/actions/profil";

/* Anzeigenamen setzen oder ändern (Team-Epic Story 2) — ein einzelnes Feld,
   das beim Verlassen oder mit Enter speichert, wie die Felder in der Ansicht
   (Epic #364); Esc nimmt die Eingabe zurück. Gespeichert wird nur, was sich
   geändert hat. Wer noch keinen eigenen Namen gewählt hat, sieht den
   automatisch vergebenen als Wert — so, wie er heute erscheint. Der Hinweis
   hinter dem ⓘ sagt, wer den Namen sieht: Er ist die einzige Personenangabe,
   die andere zu sehen bekommen, auch an öffentlichen Vorlagen. */
export function AnzeigenameForm({ aktuell }: { aktuell: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gespeichert, setGespeichert] = useState(aktuell);
  const [wert, setWert] = useState(aktuell);
  const [fehler, setFehler] = useState<string | undefined>();
  const melde = useSnackbar();

  function speichern() {
    if (pending || wert.trim() === gespeichert) return;
    setFehler(undefined);
    startTransition(async () => {
      const res = await setzeAnzeigename(wert);
      if (res.ok) {
        setWert(res.anzeigeName);
        setGespeichert(res.anzeigeName);
        melde("Anzeigename gespeichert.");
        router.refresh();
      } else {
        setFehler(res.error);
      }
    });
  }

  return (
    <TextField
      label="Anzeigename"
      value={wert}
      maxLength={40}
      onChange={(e) => setWert(e.target.value)}
      onBlur={speichern}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setWert(gespeichert);
          setFehler(undefined);
        }
      }}
      error={!!fehler}
      supportingText={fehler}
      info="Für Team-Mitglieder und an deinen veröffentlichten Vorlagen öffentlich sichtbar. Deine E-Mail-Adresse sieht niemand."
    />
  );
}
