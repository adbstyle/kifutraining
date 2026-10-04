"use client";

import { useRef, useState, startTransition } from "react";
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
  const melde = useSnackbar();
  const [wert, setWertState] = useState(aktuell);
  const [fehler, setFehler] = useState<string | undefined>();
  // Als Refs, weil das Speichern über die Antwort des Servers hinweg den
  // jeweils neuesten Stand braucht, nicht den beim Absenden eingefangenen.
  const wertRef = useRef(aktuell);
  const gespeichert = useRef(aktuell);
  const laeuft = useRef(false);
  const nochmal = useRef(false);

  function setWert(neu: string) {
    wertRef.current = neu;
    setWertState(neu);
  }

  function speichern() {
    const neu = wertRef.current;
    if (neu.trim() === gespeichert.current) return;
    // Läuft schon ein Speichern, wird nach dessen Antwort mit dem dann
    // aktuellen Stand nachgespeichert — eine Änderung in der Zwischenzeit
    // geht so nicht verloren.
    if (laeuft.current) {
      nochmal.current = true;
      return;
    }
    laeuft.current = true;
    setFehler(undefined);
    startTransition(async () => {
      const res = await setzeAnzeigename(neu);
      laeuft.current = false;
      if (res.ok) {
        gespeichert.current = res.anzeigeName;
        // Die bereinigte Fassung des Servers nur übernehmen, wenn seither
        // nichts mehr getippt wurde.
        if (wertRef.current === neu) setWert(res.anzeigeName);
        melde("Anzeigename gespeichert.");
        router.refresh();
        if (nochmal.current) {
          nochmal.current = false;
          speichern();
        }
      } else {
        nochmal.current = false;
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
          setWert(gespeichert.current);
          setFehler(undefined);
        }
      }}
      error={!!fehler}
      supportingText={fehler}
      info="Für Team-Mitglieder und an deinen veröffentlichten Vorlagen öffentlich sichtbar. Deine E-Mail-Adresse sieht niemand."
    />
  );
}
