"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Unlink } from "lucide-react";
import { Button, Dialog, IconButton, Leerzustand, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { widerrufeZugang } from "@/lib/actions/ki-zugaenge";
import type { KiZugang } from "@/lib/queries/ki-zugaenge";
import { datumKurz } from "@/lib/zeit";

/* Die KI-Zugänge des Kontos mit Widerruf (Story #142 AK 5, AK 6).
   Bewusst 1:1 wie die Mitgliederliste der Teams (NFR 6): Zeile mit rundem
   Zeichen, Entfernen über den Knopf am Zeilenende, Bestätigung im Dialog,
   Ergebnis in der Snackbar. Widerrufen betrifft genau einen Zugang — der
   Dialog sagt das ausdrücklich, weil ein Konto mehrere Geräte verbinden kann. */
export function KiZugaengeListe({ zugaenge }: { zugaenge: KiZugang[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const melde = useSnackbar();
  const [widerrufen, setWiderrufen] = useState<KiZugang | null>(null);

  function widerrufAusfuehren(zugang: KiZugang) {
    startTransition(async () => {
      const res = await widerrufeZugang(zugang.clientId);
      setWiderrufen(null);
      if (!res.ok) {
        melde(res.error);
        return;
      }
      router.refresh();
      melde(`«${zugang.name}» ist widerrufen.`);
    });
  }

  return (
    <>
      {zugaenge.length === 0 ? (
        <Leerzustand dicht icon={Bot} titel="Noch keine KI-Zugänge">
          Sobald du einem KI-Assistenten den Zugriff erlaubst, erscheint er hier.
        </Leerzustand>
      ) : (
        <ul className="flex flex-col gap-2">
          {zugaenge.map((z) => (
            <li
              key={z.clientId}
              className="flex items-center gap-3 rounded-flaeche bg-elev-01 px-4 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elev-08 text-on-surface">
                <Bot size={18} strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="type-body-large block truncate text-on-surface">{z.name}</span>
                {/* Bei eigenem Namen steht der des Clients daneben: Er ist der
                    einzige Hinweis darauf, welches Programm dahintersteckt. */}
                <span className="type-body-small block truncate text-on-surface-mittel">
                  Erlaubt am {datumKurz(z.erlaubtAm)}
                  {z.eigenerName && ` · ${z.clientName}`}
                </span>
              </span>
              <Tooltip label="Zugang widerrufen">
                <IconButton
                  icon={Unlink}
                  label={`${z.name} widerrufen`}
                  onClick={() => setWiderrufen(z)}
                />
              </Tooltip>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={widerrufen != null}
        onClose={() => setWiderrufen(null)}
        title="Zugang widerrufen?"
        actions={
          <>
            <Button variant="text" onClick={() => setWiderrufen(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => widerrufen && widerrufAusfuehren(widerrufen)}
              disabled={pending}
            >
              Widerrufen
            </Button>
          </>
        }
      >
        {/* PC 6: Der Widerruf wirkt auch auf eine noch laufende Sitzung. */}
        <p>
          <strong className="text-on-surface">{widerrufen?.name}</strong> kann danach
          nicht mehr auf dein Konto zugreifen, auch nicht mit einer noch laufenden
          Sitzung. Deine übrigen Zugänge bleiben bestehen.
        </p>
      </Dialog>
    </>
  );
}
