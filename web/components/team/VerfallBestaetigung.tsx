"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { verfallDialogText } from "@/lib/spieler";
import { kaderVerfallText } from "@/lib/kader";
import { spielVerfallText } from "@/lib/spiel";

/* Verlegen lässt Abmeldungen verfallen (#437 AK 1, PC 1): Wer sich für den
   alten Zeitpunkt abgemeldet hat, gilt am neuen wieder als angemeldet. Das
   erfährt man vor dem Speichern — für einen einzelnen Termin und beim
   Zurücksetzen der Zeit auf die der Serie. Für die Serie sagt es
   `EntfallendBestaetigung`. Dieselbe Rückfrage stellt eine Änderung an
   Kadern, die Spieler:innen aus Terminen nimmt (#453 AK 10) — dann mit dem
   Satz `text`, und mit dem aktuellen Stand, wenn die Zahl inzwischen eine
   andere ist (AK 12). Gebaut wird sie über `useVerfallRueckfrage`. */
export function VerfallBestaetigung({
  anzahl,
  text,
  titel = "Abmeldungen verfallen",
  pending,
  onClose,
  onBestaetigen,
}: {
  /** `null`: geschlossen. */
  anzahl: number | null;
  /** Statt des Satzes zur Verlegung. */
  text?: string;
  /** Bei einem Spiel «Meldungen verfallen» (#463). */
  titel?: string;
  pending?: boolean;
  onClose: () => void;
  onBestaetigen: () => void;
}) {
  return (
    <Dialog
      open={anzahl !== null}
      onClose={onClose}
      title={titel}
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" disabled={pending} onClick={onBestaetigen}>Trotzdem ändern</Button>
        </>
      }
    >
      <p className="flex items-start gap-2">
        <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-icon-warning" />
        <span>{anzahl !== null && (text ?? verfallDialogText(anzahl))}</span>
      </p>
    </Dialog>
  );
}

type Frage = { anzahl: number; text?: string; titel?: string; weiter: () => void };

/** Was eine Aktion zurückmeldet, die Abmeldungen verfallen lassen kann;
 *  `nachtraege`: davon Nachträge zur Anwesenheit (#475 AK 12). */
type Antwort = {
  ok: boolean;
  error?: string;
  verfallend?: number;
  nachtraege?: number;
  /** Kader (#463 AK 14): davon Meldungen zu Spielen. */
  verfallendSpiele?: number;
  /** Verlegen eines Spiels (#463 AK 13, 26): die Frist ist danach abgelaufen. */
  fristAbgelaufen?: boolean;
  /** Davon Kennzeichnungen als nicht aufgeboten (#464 AK 10). */
  kennzeichnungen?: number;
};

/**
 * Die Rückfrage zu verfallenden Abmeldungen an einer Stelle: Zustand, Dialog
 * und die Regel des Wortlauts. «Trotzdem ändern» schliesst und setzt mit
 * `weiter` fort; stimmt die Zahl dann nicht mehr, fragt der nächste Aufruf
 * mit dem neuen Stand erneut.
 *
 * - `nachKader(r, bestaetigt, weiter)` (#453 AK 10, 12): Meldet die Antwort
 *   `verfallend`, fragt sie nach und gibt `true` zurück. Die erste Rückfrage
 *   (`bestaetigt === false`) nennt den Satz zu Kadern, eine weitere den
 *   aktuellen Stand der Datenebene. `weiter` erhält die zu bestätigende Zahl.
 * - `nachVerlegung(r, weiter)` (#437 AK 1, #475 AK 12): der Satz zur
 *   Verlegung, samt verfallender Nachträge.
 */
export function useVerfallRueckfrage(pending?: boolean) {
  const [frage, setFrage] = useState<Frage | null>(null);

  function nachKader(r: Antwort, bestaetigt: number | false, weiter: (anzahl: number) => void): boolean {
    if (r.ok || !r.verfallend) return false;
    const n = r.verfallend;
    setFrage({ anzahl: n, text: bestaetigt === false ? kaderVerfallText(n, r.verfallendSpiele, r.kennzeichnungen) : r.error, weiter: () => weiter(n) });
    return true;
  }

  function nachVerlegung(r: Antwort & { verfallend: number }, weiter: () => void) {
    // Ein Spiel (#463 AK 13, 26; #464 AK 10): Meldungen, Kennzeichnungen und die Frist.
    if (r.fristAbgelaufen !== undefined) {
      const k = r.kennzeichnungen ?? 0;
      const meldungen = r.verfallend - k;
      const text = `${spielVerfallText(meldungen, r.fristAbgelaufen, k)}${meldungen > 0 ? " Für den neuen Tag melden sich alle neu." : ""}`;
      const titel = meldungen > 0 ? "Meldungen verfallen" : k > 0 ? "Kennzeichnungen verfallen" : "Meldefrist abgelaufen";
      setFrage({ anzahl: r.verfallend, text, titel, weiter });
      return;
    }
    const nachtraege = r.nachtraege ?? 0;
    setFrage({ anzahl: r.verfallend, text: verfallDialogText(r.verfallend - nachtraege, nachtraege), weiter });
  }

  const dialog = (
    <VerfallBestaetigung
      anzahl={frage?.anzahl ?? null}
      text={frage?.text}
      titel={frage?.titel}
      pending={pending}
      onClose={() => setFrage(null)}
      onBestaetigen={() => {
        const f = frage;
        setFrage(null);
        f?.weiter();
      }}
    />
  );

  return { dialog, nachKader, nachVerlegung };
}
