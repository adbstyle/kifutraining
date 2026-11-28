"use client";

import { Button, ZeitraumFilter } from "@/components/ui";
import { useAdressFilter } from "@/lib/use-adress-filter";
import { TEILNAHME_TEXT, ZEITRAUM_KURZWAHL, kurzwahlVon, zeitraumWert, type Zeitraum } from "@/lib/teilnahme";

/* Der Zeitraum der Teilnahme-Statistik (#700) in der Adresse (`?von=`,
   `?bis=`): Er bleibt stehen, wenn man daneben eine andere Spieler:in
   öffnet (PC 1), und «Zurücksetzen» hebt ihn auf — dann zählt die ganze
   Zeit im Team (AK 7). Die übrigen Parameter der Spielerliste bleiben. */
export function TeilnahmeZeitraum({ zeitraum, heute }: { zeitraum: Zeitraum; heute: string }) {
  const filter = useAdressFilter();
  const aktiv = kurzwahlVon(zeitraum, heute);
  const gesetzt = zeitraum.von !== null || zeitraum.bis !== null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ZeitraumFilter
        label={TEILNAHME_TEXT.zeitraum}
        wert={zeitraumWert(zeitraum, heute)}
        von={zeitraum.von}
        bis={zeitraum.bis}
        bisHoechstens={heute}
        kurzwahl={ZEITRAUM_KURZWAHL.map((k) => ({ id: k.id, label: k.label, von: k.von(heute), aktiv: aktiv?.id === k.id }))}
        texte={TEILNAHME_TEXT}
        onChange={(z) => filter.setzeWerte({ von: z.von, bis: z.bis })}
      />
      {gesetzt && (
        <Button variant="text" onClick={() => filter.setzeWerte({ von: "", bis: "" })}>
          {TEILNAHME_TEXT.zuruecksetzen}
        </Button>
      )}
    </div>
  );
}
