"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { KopfAktionen, KopfKnopfText } from "@/components/layout/KopfAktionen";
import { VEREIN_SPIELER_GESPERRT_ID } from "@/lib/verein";
import type { SpielerEingrenzung } from "@/lib/verein-spielerliste";
import { VereinSpielerFormular } from "./VereinSpielerFormular";
import { VereinSpielerImport } from "./VereinSpielerImport";

/* Die Aktionen in der Kopfzeile der Spieler:innen des Vereins (#707 AK 2),
   nur für die Vereinsverwaltung: «Spieler:in hinzufügen» als Hauptaktion —
   derselbe Begriff wie im Team (#706), beide legen eine neue Person an —,
   «Spieler:innen importieren» als Zweitaktion in Kontur daneben. Auch im
   Leerzustand stehen sie nur hier.

   Hat der Verein seine Grenze erreicht (`voll`, AK 4), sind beide gesperrt
   und verweisen auf den Satz mit dem Grund unter der Kopfzeile
   (`VEREIN_SPIELER_GESPERRT_ID`, gesetzt von der Seite). Würde erst ein
   Import die Grenze überschreiten, meldet es seine Vorschau wie bisher.

   Der Import steht nur, solange er offen ist: Datei und Vorschau beginnen
   jedes Mal von vorn. Wechselt die Eingrenzung (etwa über die Zurück-Taste),
   schliessen beide Dialoge, wie die der Liste. */
export function VereinSpielerAktionen({
  vereinId,
  vereinName,
  pfad,
  voll,
  eingrenzung,
}: {
  vereinId: string;
  vereinName: string;
  pfad: string;
  voll: boolean;
  eingrenzung: SpielerEingrenzung;
}) {
  // `{ spieler: null }`: der Dialog «Spieler:in hinzufügen» ist offen.
  const [formular, setFormular] = useState<{ spieler: null } | null>(null);
  const [importOffen, setImportOffen] = useState(false);

  const schluessel = JSON.stringify(eingrenzung);
  const [schluesselVorher, setSchluesselVorher] = useState(schluessel);
  if (schluessel !== schluesselVorher) {
    setSchluesselVorher(schluessel);
    setFormular(null);
    setImportOffen(false);
  }

  const sperre = { disabled: voll, "aria-describedby": voll ? VEREIN_SPIELER_GESPERRT_ID : undefined };

  return (
    <>
      <KopfAktionen
        zweit={
          <Button variant="outlined" aria-haspopup="dialog" {...sperre} onClick={() => setImportOffen(true)}>
            <KopfKnopfText label="Spieler:innen importieren" kurz="Importieren" />
          </Button>
        }
        haupt={
          <Button variant="filled" aria-haspopup="dialog" {...sperre} onClick={() => setFormular({ spieler: null })}>
            <KopfKnopfText label="Spieler:in hinzufügen" kurz="Hinzufügen" />
          </Button>
        }
      />
      <VereinSpielerFormular offen={formular} vereinId={vereinId} vereinName={vereinName} onClose={() => setFormular(null)} />
      {importOffen && <VereinSpielerImport vereinId={vereinId} vereinName={vereinName} pfad={pfad} onClose={() => setImportOffen(false)} />}
    </>
  );
}
