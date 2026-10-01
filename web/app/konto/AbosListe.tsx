"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Link2, Unlink } from "lucide-react";
import { Button, Dialog, IconButton, Leerzustand, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { AboDialog } from "@/components/team/AboDialog";
import { widerrufeAboAktion } from "@/lib/actions/abos";
import type { MeinAbo } from "@/lib/queries/abos";

/* Die Kalender-Abos des Kontos (Story #330 AK 4, 5, 7, 8). Bewusst 1:1 wie die
   KI-Zugänge (`KiZugaengeListe`): Zeile mit rundem Zeichen, Knöpfe am
   Zeilenende, Bestätigung im Dialog, Ergebnis in der Snackbar. «Link anzeigen»
   öffnet denselben Dialog wie im Team — mit derselben Warnung. */
export function AbosListe({ abos }: { abos: MeinAbo[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const melde = useSnackbar();
  const [anzeigen, setAnzeigen] = useState<MeinAbo | null>(null);
  const [widerrufen, setWiderrufen] = useState<MeinAbo | null>(null);
  const liste = useRef<HTMLDivElement>(null);

  function widerrufAusfuehren(abo: MeinAbo) {
    startTransition(async () => {
      const res = await widerrufeAboAktion(abo.id);
      setWiderrufen(null);
      if (!res.ok) {
        melde(res.error);
        return;
      }
      router.refresh();
      melde(`Abo für «${abo.team.name}» widerrufen.`);
      // Die Zeile mit dem Knopf verschwindet, und der Dialog gäbe den Fokus
      // an sie zurück; er bleibt darum bei der Liste, nicht auf <body>. Erst
      // nach dem Schliessen des Dialogs, das den Fokus selbst zurückholt.
      requestAnimationFrame(() => liste.current?.focus());
    });
  }

  return (
    <>
      <div ref={liste} tabIndex={-1} className="outline-none">
        {abos.length === 0 ? (
          <Leerzustand dicht icon={CalendarDays} titel="Noch keine Abos">
            Hole dir im Trainingsplan eines Teams den Link «Kalender abonnieren».
          </Leerzustand>
        ) : (
          <ul className="flex flex-col gap-2">
            {abos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-flaeche bg-elev-01 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elev-08 text-on-surface">
                  <CalendarDays size={18} strokeWidth={2} aria-hidden />
                </span>
                <span className="type-body-large min-w-0 flex-1 truncate text-on-surface">{a.team.name}</span>
                <Tooltip label="Link anzeigen">
                  <IconButton icon={Link2} label={`Abo-Link für ${a.team.name} anzeigen`} onClick={() => setAnzeigen(a)} />
                </Tooltip>
                <Tooltip label="Abo widerrufen">
                  <IconButton icon={Unlink} label={`Abo für ${a.team.name} widerrufen`} onClick={() => setWiderrufen(a)} />
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AboDialog
        links={anzeigen ? { url: anzeigen.url, webcal: anzeigen.webcal } : null}
        teamName={anzeigen?.team.name ?? ""}
        onClose={() => setAnzeigen(null)}
      />

      <Dialog
        open={widerrufen != null}
        onClose={() => setWiderrufen(null)}
        title="Abo widerrufen?"
        actions={
          <>
            <Button variant="text" onClick={() => setWiderrufen(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={() => widerrufen && widerrufAusfuehren(widerrufen)} disabled={pending}>
              Widerrufen
            </Button>
          </>
        }
      >
        <p>
          Der Link liefert danach keine Termine mehr. Einen neuen holst du dir jederzeit im Team.
        </p>
      </Dialog>
    </>
  );
}
