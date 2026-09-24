"use client";

import { useState, useTransition } from "react";
import { Button, Meldung, TextField } from "@/components/ui";
import {
  erlaubeZugang,
  lehneZugangAb,
  type ZustimmungErgebnis,
} from "@/lib/actions/ki-zugaenge";
import { ZUGANGSNAME_MAX } from "@/lib/mcp/regeln";

/* Erlauben oder Ablehnen einer KI-Client-Anfrage (Story #142 AK 1, AK 3).
 *
 * Die Actions werden direkt aufgerufen, die Argumente baut das Formular
 * selbst — Hidden-Inputs aus State serialisieren unter Next 15/React 19 nicht
 * verlässlich. Weitergeleitet wird im Browser (`window.location.assign`), weil
 * die Rücksprung-Adresse eines KI-Clients ein eigenes Schema tragen kann. */
export function ZustimmungFormular({
  authorizationId,
  clientName,
  grenze,
}: {
  authorizationId: string;
  /** Vorbelegung des Namensfelds (PC 2): wer nichts ändert, behält ihn. */
  clientName: string;
  /** AK 11: Die Grenze ist erreicht — dann bleibt nur das Ablehnen. */
  grenze: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(clientName.slice(0, ZUGANGSNAME_MAX));
  const [feldFehler, setFeldFehler] = useState<string | undefined>();
  const [meldung, setMeldung] = useState<string | null>(null);
  const [weiter, setWeiter] = useState(false);

  function auswerten(res: ZustimmungErgebnis) {
    if (res.status === "weiter") {
      // PC 4: zurück zum Client, der damit ohne weiteres Zutun fertig ist.
      setWeiter(true);
      window.location.assign(res.url);
      return;
    }
    if (res.status === "fehler" && res.feld === "name") {
      setFeldFehler(res.meldung);
      return;
    }
    setMeldung(res.meldung);
  }

  function ausfuehren(aktion: "erlauben" | "ablehnen") {
    setFeldFehler(undefined);
    setMeldung(null);
    startTransition(async () => {
      auswerten(
        aktion === "erlauben"
          ? await erlaubeZugang(authorizationId, name)
          : await lehneZugangAb(authorizationId),
      );
    });
  }

  if (weiter) {
    return (
      <Meldung tone="erfolg">Du wirst zurück zu deinem KI-Client geleitet …</Meldung>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        ausfuehren("erlauben");
      }}
    >
      {!grenze && (
        <TextField
          label="Name für diesen Zugang"
          value={name}
          maxLength={ZUGANGSNAME_MAX}
          onChange={(e) => setName(e.target.value)}
          error={!!feldFehler}
          supportingText={
            feldFehler ??
            `So erscheint der Zugang in deinem Konto, etwa «Claude auf dem Laptop». Höchstens ${ZUGANGSNAME_MAX} Zeichen.`
          }
        />
      )}

      {meldung && (
        <Meldung tone="fehler" className="mt-4">
          {meldung}
        </Meldung>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {!grenze && (
          <Button type="submit" variant="filled" disabled={pending}>
            Erlauben
          </Button>
        )}
        <Button
          type="button"
          variant="outlined"
          disabled={pending}
          onClick={() => ausfuehren("ablehnen")}
        >
          Ablehnen
        </Button>
      </div>

      <p className="type-body-small mt-5 text-on-surface-mittel">
        Du kannst den Zugang jederzeit im Konto unter «KI-Zugänge» widerrufen.
      </p>
    </form>
  );
}
