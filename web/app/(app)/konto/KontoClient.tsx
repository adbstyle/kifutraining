"use client";

import { useActionState, useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button, ButtonLink, Dialog, SectionMessage } from "@/components/ui";
import { deleteAccount, type KontoLoeschenZustand } from "@/lib/actions/auth";

/* Konto-Löschung mit ausdrücklicher Bestätigung und Konsequenz-Hinweis
   (Story 9 EK2/EK3). Bleibt das Konto, weil es die letzte Verwaltung eines
   Vereins ist oder etwas schiefging, steht der Grund im Dialog (#577). Im
   ersten Fall gibt es nichts erneut zu versuchen: Der Dialog führt zur
   Verwaltung, wo sich jemand aufnehmen lässt (#581 AK 34). */
export function KontoClient() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 size={18} strokeWidth={2} aria-hidden />
        Konto löschen
      </Button>
      {/* Nur offen eingehängt: Schliessen verwirft die letzte Meldung. */}
      {open && <KontoLoeschenDialog onClose={() => setOpen(false)} />}
    </>
  );
}

const ANFANG: KontoLoeschenZustand = { fehler: null };

function KontoLoeschenDialog({ onClose }: { onClose: () => void }) {
  const [zustand, aktion, laeuft] = useActionState(deleteAccount, ANFANG);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Konto wirklich löschen?"
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            {zustand.letzteVerwaltung ? "Schliessen" : "Abbrechen"}
          </Button>
          {zustand.letzteVerwaltung ? (
            <ButtonLink href="/verein/verwaltung" variant="filled">
              Zur Verwaltung
            </ButtonLink>
          ) : (
            <form action={aktion}>
              <Button type="submit" variant="danger" disabled={laeuft}>
                Konto endgültig löschen
              </Button>
            </form>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {zustand.fehler && <SectionMessage appearance="error">{zustand.fehler}</SectionMessage>}
        {!zustand.letzteVerwaltung && (
          <>
            <p className="flex items-start gap-2">
              <AlertTriangle size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-error" aria-hidden />
              <span>Diese Aktion kann nicht rückgängig gemacht werden.</span>
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Deine <strong>öffentlichen</strong> Übungen bleiben anonymisiert erhalten und werden unveränderlich.</li>
              <li>Deine <strong>privaten</strong> Übungen werden samt Feld-Diagramm gelöscht.</li>
              <li>Teams, in denen du die letzte Trainer:in bist, bleiben ohne Trainer:in bestehen.</li>
              <li>Verbundene KI-Assistenten verlieren ihren Zugang.</li>
              <li>Du wirst abgemeldet und dein Konto entfernt.</li>
            </ul>
          </>
        )}
      </div>
    </Dialog>
  );
}
