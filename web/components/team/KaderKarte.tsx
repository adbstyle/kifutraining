"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info, Pencil, Plus, X } from "lucide-react";
import { Button, Dialog, IconButton, SectionMessage, Tabelle, TabellenZeile, TextField, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { benenneKaderUmAktion, entferneKaderAktion, legeKaderAnAktion } from "@/lib/actions/kader";
import { KADER_MAX, KADER_MELDUNG, KADER_NAME_MAX, KADER_TEXT, kaderVerfallText, type Kader } from "@/lib/kader";
import { VerfallBestaetigung } from "./VerfallBestaetigung";

/* Die Kader eines Teams (Epic #447, Story #452): anlegen, umbenennen,
   entfernen. Wer welchem Kader angehört, teilt die Spielerliste darüber zu
   (Spalte «Kader», Mehrfachauswahl). Beim Anlegen und Umbenennen steht im
   Dialog, dass ein Name nichts Heikles tragen soll (AK 13) — als Satz im
   Dialog und nicht hinter dem ⓘ, weil er gelesen werden muss, bevor man
   tippt. Entfernen fragt nach (AK 4) und nennt, was danach gilt. */
export function KaderKarte({ teamId, kader }: { teamId: string; kader: Kader[] }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  // `null`: zu; sonst neu (`id` leer) oder der umbenannte Kader.
  const [offen, setOffen] = useState<{ id: string | null } | null>(null);
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [entfernen, setEntfernen] = useState<Kader | null>(null);
  const [verfall, setVerfall] = useState<{ anzahl: number; text: string; weiter: () => void } | null>(null);
  const formId = useId();

  function oeffnen(k?: Kader) {
    setFehler(null);
    setName(k?.name ?? "");
    setOffen({ id: k?.id ?? null });
  }

  function schliessen() {
    setOffen(null);
    setName("");
    setFehler(null);
  }

  function speichern() {
    if (!offen || pending) return;
    startTransition(async () => {
      const r = offen.id ? await benenneKaderUmAktion(offen.id, name) : await legeKaderAnAktion(teamId, name);
      if (!r.ok) return setFehler(r.error);
      schliessen();
      router.refresh();
      melde(offen.id ? `Kader in «${r.name}» umbenannt.` : `Kader «${r.name}» angelegt.`);
    });
  }

  function entfernenAusfuehren(k: Kader, bestaetigt: number | false = false) {
    startTransition(async () => {
      const r = await entferneKaderAktion(k.id, bestaetigt);
      if (!r.ok && r.verfallend) {
        setEntfernen(null);
        setVerfall({
          anzahl: r.verfallend,
          text: bestaetigt === false ? kaderVerfallText(r.verfallend) : r.error,
          weiter: () => entfernenAusfuehren(k, r.verfallend!),
        });
        return;
      }
      setEntfernen(null);
      setVerfall(null);
      if (!r.ok) return melde(r.error);
      router.refresh();
      melde(`Kader «${r.name}» entfernt.`);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-title-large text-on-surface">
          Kader
          <span className="type-label-small ml-2 text-on-surface-mittel">
            {kader.length} von {KADER_MAX}
          </span>
        </h2>
        <Tooltip label="Kader anlegen" ende>
          <IconButton
            icon={Plus}
            label="Kader anlegen"
            aria-haspopup="dialog"
            disabled={kader.length >= KADER_MAX}
            onClick={() => oeffnen()}
          />
        </Tooltip>
      </div>

      {kader.length > 0 ? (
        <>
          <p className="type-body-medium mt-2 max-w-2xl text-on-surface-mittel">{KADER_TEXT.wirkung}</p>
          <Tabelle className="mt-4" spalten="sm:grid-cols-[minmax(0,1fr)_8.5rem_5rem]" kopf={["Name", "Spieler:innen", ""]}>
            {kader.map((k) => (
              <TabellenZeile key={k.id}>
                <span className="min-w-0 flex-1">
                  <span className="type-body-medium block truncate text-on-surface">{k.name}</span>
                  <span className="type-body-small block text-on-surface-mittel sm:hidden">{anzahlText(k.spielerIds.length)}</span>
                </span>
                <span className="type-body-medium hidden text-on-surface-mittel sm:block">{k.spielerIds.length}</span>
                <span className="flex justify-end gap-1">
                  <Tooltip label="Umbenennen">
                    <IconButton icon={Pencil} label={`${k.name} umbenennen`} onClick={() => oeffnen(k)} />
                  </Tooltip>
                  <Tooltip label="Entfernen" ende>
                    <IconButton icon={X} label={`${k.name} entfernen`} onClick={() => setEntfernen(k)} />
                  </Tooltip>
                </span>
              </TabellenZeile>
            ))}
          </Tabelle>
        </>
      ) : (
        <p className="type-body-medium mt-4 max-w-2xl text-on-surface-mittel">{KADER_TEXT.leer}</p>
      )}

      <Dialog
        open={offen !== null}
        onClose={() => !pending && schliessen()}
        title={offen?.id ? "Kader umbenennen" : "Kader anlegen"}
        actions={
          <>
            <Button type="button" variant="outlined" onClick={schliessen} disabled={pending}>
              Abbrechen
            </Button>
            <Button type="submit" form={formId} variant="filled" disabled={pending}>
              {offen?.id ? "Speichern" : "Anlegen"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            speichern();
          }}
        >
          {!offen?.id && <p>{KADER_TEXT.einleitung}</p>}
          <TextField
            label="Name"
            autoComplete="off"
            autoFocus
            maxLength={KADER_NAME_MAX}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFehler(null);
            }}
            error={!!fehler}
            supportingText={fehler ?? undefined}
          />
          <p className="flex items-start gap-3">
            <Info size={16} aria-hidden className="mt-0.5 shrink-0 text-icon-information" />
            <span>{KADER_TEXT.heikel}</span>
          </p>
        </form>
      </Dialog>

      <Dialog
        open={entfernen != null}
        onClose={() => setEntfernen(null)}
        title={`«${entfernen?.name ?? ""}» entfernen?`}
        actions={
          <>
            <Button variant="outlined" onClick={() => setEntfernen(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={() => entfernen && entfernenAusfuehren(entfernen)} disabled={pending}>
              Entfernen
            </Button>
          </>
        }
      >
        {entfernen && (
          <p>
            {entfernen.spielerIds.length === 0
              ? "Der Kader hat keine Spieler:innen."
              : `${anzahlText(entfernen.spielerIds.length)} verlieren den Kader und bleiben auf der Spielerliste.`}
          </p>
        )}
      </Dialog>

      <VerfallBestaetigung
        anzahl={verfall?.anzahl ?? null}
        text={verfall?.text}
        pending={pending}
        onClose={() => setVerfall(null)}
        onBestaetigen={() => verfall?.weiter()}
      />
      {/* Ein Kader mehr geht nicht (AK 11). */}
      {kader.length >= KADER_MAX && (
        <SectionMessage appearance="information" className="mt-4">
          {KADER_MELDUNG.KADER_VOLL}
        </SectionMessage>
      )}
    </>
  );
}

function anzahlText(n: number): string {
  return n === 1 ? "1 Spieler:in" : `${n} Spieler:innen`;
}
