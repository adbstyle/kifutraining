"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, RefreshCw } from "lucide-react";
import { Button, Dialog, IconButton, OverflowMenu, Switch, TextField, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { erneuereAbholungAktion, schalteAbholungAktion } from "@/lib/actions/spieler";
import { ABHOLUNG_TEXT } from "@/lib/spieler";

/* Die Selbstabholung eines Teams (#438 AK 1–5): ein Schalter, darunter die
   Abholadresse zum Kopieren und im Menü «Abholadresse erneuern» mit
   Bestätigung. Was die Adresse kann und was Ausschalten bewirkt, steht immer
   dabei (AK 3, 5). Aus und wieder ein gilt dieselbe Adresse (PC 5). Die Karte
   ist nicht modal — Ergebnisse meldet die Snackbar. */
export function Selbstabholung({ teamId, start }: { teamId: string; start: { url: string | null; aktiv: boolean } }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [stand, setStand] = useState(start);
  const [erneuern, setErneuern] = useState(false);

  function schalten(aktiv: boolean) {
    setStand((s) => ({ ...s, aktiv }));
    startTransition(async () => {
      const r = await schalteAbholungAktion(teamId, aktiv);
      if (!r.ok) {
        setStand((s) => ({ ...s, aktiv: !aktiv }));
        return melde(r.error);
      }
      setStand({ url: r.url, aktiv: r.aktiv });
      router.refresh();
      melde(aktiv ? ABHOLUNG_TEXT.eingeschaltet : ABHOLUNG_TEXT.ausgeschaltet);
    });
  }

  function erneuernAusfuehren() {
    startTransition(async () => {
      const r = await erneuereAbholungAktion(teamId);
      setErneuern(false);
      if (!r.ok) return melde(r.error);
      setStand((s) => ({ ...s, url: r.url }));
      router.refresh();
      melde(ABHOLUNG_TEXT.erneuert);
    });
  }

  async function kopieren() {
    if (!stand.url) return;
    try {
      await navigator.clipboard.writeText(stand.url);
      melde("Abholadresse kopiert.");
    } catch {
      melde("Kopieren ging nicht - markiere die Adresse und kopiere sie von Hand.");
    }
  }

  return (
    <section aria-labelledby="selbstabholung" className="rounded-flaeche bg-elev-01 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="selbstabholung" className="type-title-medium text-on-surface">
          Selbstabholung
        </h3>
        <Switch checked={stand.aktiv} neutral={!stand.aktiv} disabled={pending} onChange={(e) => schalten(e.target.checked)} aria-label="Selbstabholung" />
      </div>
      {stand.aktiv && stand.url ? (
        <>
          <p className="type-body-medium mt-2 text-on-surface-mittel">{ABHOLUNG_TEXT.beschreibung}</p>
          <div className="mt-3 flex items-center gap-1">
            <TextField
              className="min-w-0 flex-1"
              label="Abholadresse"
              value={stand.url}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <Tooltip label="Kopieren">
              <IconButton icon={Copy} label="Abholadresse kopieren" onClick={kopieren} />
            </Tooltip>
            <OverflowMenu
              label="Weitere Aktionen zur Abholadresse"
              items={[{ label: "Abholadresse erneuern", icon: RefreshCw, onSelect: () => setErneuern(true) }]}
            />
          </div>
        </>
      ) : (
        <p className="type-body-medium mt-2 text-on-surface-mittel">{ABHOLUNG_TEXT.aus}</p>
      )}

      <Dialog
        open={erneuern}
        onClose={() => setErneuern(false)}
        title="Abholadresse erneuern?"
        actions={
          <>
            <Button variant="outlined" onClick={() => setErneuern(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={erneuernAusfuehren} disabled={pending}>
              Erneuern
            </Button>
          </>
        }
      >
        <p>{ABHOLUNG_TEXT.erneuern}</p>
      </Dialog>
    </section>
  );
}
