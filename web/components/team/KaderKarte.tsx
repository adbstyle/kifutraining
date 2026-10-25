"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Tag, TriangleAlert, X } from "lucide-react";
import { Button, Dialog, IconButton, SectionMessage, Tabelle, TabellenZeile, TextField, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { benenneKaderUmAktion, entferneKaderAktion, kaderEntfernenFolgenAktion, legeKaderAnAktion } from "@/lib/actions/kader";
import { KADER_MAX, KADER_MELDUNG, KADER_NAME_MAX, KADER_TEXT, kaderVerfallText, type Kader } from "@/lib/kader";
import type { KaderEntfernenFolgen } from "@/lib/kern/kader";
import { wochentageText, type Wochentag } from "@/lib/serie";
import { datumKurz } from "@/lib/zeit";
import { useVerfallRueckfrage } from "./VerfallBestaetigung";

/* Die Kader eines Teams (Epic #447, Story #452): anlegen, umbenennen,
   entfernen. Wer welchem Kader angehört, teilt die Spielerliste darüber zu
   (Spalte «Kader», Mehrfachauswahl). Dass ein Name nichts Heikles tragen
   soll (AK 13), steht als Hinweis unter dem Namensfeld, solange kein Fehler
   dasteht — bewusst nicht hinter dem ⓘ: Er muss gelesen werden, bevor man
   tippt, und im niedrigen Dialog schnitte dieser das Panel ab (PO
   2026-10-18). Entfernen fragt nach (AK 4) und nennt, was danach gilt. */
export function KaderKarte({ teamId, kader }: { teamId: string; kader: Kader[] }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  // `null`: zu; sonst neu (`id` leer) oder der umbenannte Kader.
  const [offen, setOffen] = useState<{ id: string | null } | null>(null);
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [entfernen, setEntfernen] = useState<{ kader: Kader; folgen: KaderEntfernenFolgen } | null>(null);
  const verfall = useVerfallRueckfrage(pending);
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

  /** Vor der Rückfrage: was das Entfernen bewirkte (#453 AK 11). */
  function entfernenFragen(k: Kader) {
    startTransition(async () => {
      const r = await kaderEntfernenFolgenAktion(k.id);
      if (!r.ok) return melde(r.error);
      setEntfernen({ kader: k, folgen: r.folgen });
    });
  }

  function entfernenAusfuehren(k: Kader, bestaetigt: number | false = false) {
    startTransition(async () => {
      const r = await entferneKaderAktion(k.id, bestaetigt);
      setEntfernen(null);
      if (verfall.nachKader(r, bestaetigt, (n) => entfernenAusfuehren(k, n))) return;
      if (!r.ok) return melde(r.error);
      router.refresh();
      melde(`Kader «${r.name}» entfernt.`);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 type-title-large text-on-surface">
          <Tag size={20} strokeWidth={2} aria-hidden className="shrink-0 text-on-surface-mittel" />
          <span>
            Kader
            <span className="type-label-small ml-2 text-on-surface-mittel">
              {kader.length} von {KADER_MAX}
            </span>
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
                    <IconButton icon={X} label={`${k.name} entfernen`} disabled={pending} onClick={() => entfernenFragen(k)} />
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
            supportingText={fehler ?? KADER_TEXT.heikel}
          />
        </form>
      </Dialog>

      <Dialog
        open={entfernen != null}
        onClose={() => setEntfernen(null)}
        title={`«${entfernen?.kader.name ?? ""}» entfernen?`}
        actions={
          <>
            <Button variant="outlined" onClick={() => setEntfernen(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => entfernen && entfernenAusfuehren(entfernen.kader, entfernen.folgen.verfallend || false)}
              disabled={pending}
            >
              Entfernen
            </Button>
          </>
        }
      >
        {entfernen && <EntfernenFolgen name={entfernen.kader.name} folgen={entfernen.folgen} />}
      </Dialog>

      {verfall.dialog}
      {/* Ein Kader mehr geht nicht (AK 11). */}
      {kader.length >= KADER_MAX && (
        <SectionMessage appearance="information" className="mt-4">
          {KADER_MELDUNG.KADER_VOLL}
        </SectionMessage>
      )}
    </>
  );
}

/** Was das Entfernen bewirkt (#452 PC 1; #453 AK 10, 11, PC 2, 4). */
function EntfernenFolgen({ name, folgen }: { name: string; folgen: KaderEntfernenFolgen }) {
  const fuerAlle = folgen.serien.length + folgen.termine.length;
  return (
    <>
      <p>
        {folgen.spieler === 0
          ? "Der Kader hat keine Spieler:innen."
          : `${anzahlText(folgen.spieler)} ${folgen.spieler === 1 ? "verliert" : "verlieren"} den Kader und ${folgen.spieler === 1 ? "bleibt" : "bleiben"} auf der Spielerliste.`}
      </p>
      {fuerAlle > 0 && (
        <>
          <p className="mt-3">Diese anstehenden Termine und Serien tragen nur «{name}» und gelten danach für alle:</p>
          <ul className="mt-2 flex flex-col gap-1.5 rounded-flaeche bg-elev-08 p-3 type-body-small text-on-surface">
            {folgen.serien.map((s) => (
              <li key={s.id}>
                Terminserie {wochentageText(s.wochentage as Wochentag[])} · {s.beginn}–{s.ende} Uhr · bis {datumKurz(s.bis)}
              </li>
            ))}
            {folgen.termine
              .filter((t) => !t.serieId || !folgen.serien.some((s) => s.id === t.serieId))
              .map((t) => (
                <li key={t.id}>
                  {datumKurz(t.datum)} · {t.beginn}–{t.ende} Uhr
                </li>
              ))}
          </ul>
        </>
      )}
      <p className="mt-3">Begonnene Termine behalten ihn als ehemaligen Kader.</p>
      {folgen.verfallend > 0 && (
        <p className="mt-3 flex items-start gap-2 text-on-surface">
          <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-icon-warning" />
          <span>{kaderVerfallText(folgen.verfallend, folgen.verfallendSpiele, folgen.verfallendKennzeichnungen)}</span>
        </p>
      )}
    </>
  );
}

function anzahlText(n: number): string {
  return n === 1 ? "1 Spieler:in" : `${n} Spieler:innen`;
}
