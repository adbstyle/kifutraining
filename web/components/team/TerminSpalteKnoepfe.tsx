"use client";

import { CalendarOff, CalendarPlus, PlayCircle, Undo2 } from "lucide-react";
import { Button, ButtonLink, OverflowMenu } from "@/components/ui";
import { datumKurz } from "@/lib/zeit";
import type { TerminZeile } from "@/lib/queries/termine-fuer";
import { useTerminAktionen } from "./TerminBereich";
import { terminMenue } from "./TerminHandgriffe";

/* Die Handgriffe der Termin-Spalte (#435), rechtsbündig über dem Inhalt des
   Reiters — dieselben Aktionen wie an der Zeile im Plan (`useTerminAktionen`). */

/** Reiter «Termin»: ausfallen lassen bzw. zurücknehmen, ändern; der Rest im Menü. */
export function TerminKnoepfe({ t }: { t: TerminZeile }) {
  const a = useTerminAktionen();
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {t.ausgefallen ? (
        <Button variant="outlined" disabled={a.pending} onClick={() => a.ausfallZuruecknehmen(t)}>
          <Undo2 size={18} aria-hidden />
          Ausfall zurücknehmen
        </Button>
      ) : (
        <Button variant="outlined" aria-haspopup="dialog" onClick={() => a.ausfallen(t)}>
          <CalendarOff size={18} aria-hidden />
          Ausfallen lassen
        </Button>
      )}
      <Button variant={t.spiel ? "outlined" : "filled"} aria-haspopup="dialog" onClick={() => a.bearbeiten(t)}>
        {t.spiel ? "Spiel ändern" : "Ändern"}
      </Button>
      <OverflowMenu label={`Weitere Aktionen zum Termin ${datumKurz(t.datum)}`} items={terminMenue(t, a)} />
    </div>
  );
}

/** Reiter «Training»: durchführen und öffnen, ersetzen — oder eines hinzufügen. */
export function TrainingKnoepfe({ t }: { t: TerminZeile }) {
  const a = useTerminAktionen();
  if (!t.training)
    return t.ausgefallen ? null : (
      <div className="flex justify-end">
        <Button aria-haspopup="dialog" onClick={() => a.zuordnen(t)}>
          <CalendarPlus size={18} aria-hidden />
          Training hinzufügen
        </Button>
      </div>
    );
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {!t.ausgefallen && (
        <>
          <Button variant="outlined" aria-haspopup="dialog" onClick={() => a.zuordnen(t)}>
            Ersetzen
          </Button>
          <ButtonLink variant="outlined" href={`/training/${t.training.id}/durchfuehren?termin=${t.id}`}>
            <PlayCircle size={18} aria-hidden />
            Durchführen
          </ButtonLink>
        </>
      )}
      <ButtonLink href={`/training/${t.training.id}`}>Training öffnen</ButtonLink>
    </div>
  );
}
