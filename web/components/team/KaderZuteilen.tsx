"use client";

import { useEffect, useState } from "react";
import { Button, Checkbox, Dialog } from "@/components/ui";
import { zugehoerigkeit, type Kader, type Zugehoerigkeit } from "@/lib/kader";

/** Was das Übernehmen ändert: wem alle zugeteilt und aus welchen alle
 *  genommen werden. Ein Kader, dem nur ein Teil angehört und den niemand
 *  angeklickt hat, bleibt, wie er ist. */
export type ZuteilungAenderung = { dazu: string[]; weg: string[] };

/* Mehrere Spieler:innen in einem Schritt zuteilen und herausnehmen (#452
   AK 6). Je Kader ein Kästchen: gewählt, wenn alle Ausgewählten ihm
   angehören, mit Strich, wenn nur ein Teil, leer, wenn keine. Ein Klick
   teilt allen zu, der nächste nimmt alle heraus; der Strich kehrt erst beim
   neuen Öffnen zurück. */
export function KaderZuteilen({
  offen,
  kader,
  auswahl,
  pending,
  onClose,
  onUebernehmen,
}: {
  offen: boolean;
  kader: Kader[];
  auswahl: readonly string[];
  pending?: boolean;
  onClose: () => void;
  onUebernehmen: (a: ZuteilungAenderung) => void;
}) {
  const [stand, setStand] = useState<Record<string, Zugehoerigkeit>>({});
  const [anfang, setAnfang] = useState<Record<string, Zugehoerigkeit>>({});

  useEffect(() => {
    if (!offen) return;
    const s = Object.fromEntries(kader.map((k) => [k.id, zugehoerigkeit(k, auswahl)]));
    setStand(s);
    setAnfang(s);
  }, [offen, kader, auswahl]);

  function umschalten(id: string) {
    setStand((s) => ({ ...s, [id]: s[id] === "alle" ? "keine" : "alle" }));
  }

  function uebernehmen() {
    const geaendert = kader.filter((k) => stand[k.id] !== anfang[k.id]);
    onUebernehmen({
      dazu: geaendert.filter((k) => stand[k.id] === "alle").map((k) => k.id),
      weg: geaendert.filter((k) => stand[k.id] === "keine").map((k) => k.id),
    });
  }

  return (
    <Dialog
      open={offen}
      onClose={onClose}
      title={auswahl.length === 1 ? "Kader für 1 Spieler:in" : `Kader für ${auswahl.length} Spieler:innen`}
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="filled" disabled={pending} onClick={uebernehmen}>
            Übernehmen
          </Button>
        </>
      }
    >
      <ul className="flex flex-col">
        {kader.map((k) => (
          <li key={k.id}>
            <Checkbox
              label={k.name}
              className="w-full"
              checked={stand[k.id] === "alle"}
              teilweise={stand[k.id] === "teil"}
              onChange={() => umschalten(k.id)}
            />
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
