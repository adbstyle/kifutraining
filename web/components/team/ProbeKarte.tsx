"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Sprout } from "lucide-react";
import { Button, Dialog, IconButton, Leerzustand, TextField, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { legeProbetrainingFestAktion } from "@/lib/actions/probe";
import { PROBE_ANZAHL_MAX, PROBE_TEXT, probeAnzahlProblem, type Probetraining } from "@/lib/probe";
import { nurZiffern, spielerName, type Spieler } from "@/lib/spieler";
import { ProbeLozenge } from "./ProbeLozenge";

/* Das Probetraining eines Teams (Epic #554, Story #555): gelesen in der
   Karte, bearbeitet im Dialog (PO 2026-10-29). Ohne Anzahl steht das
   Leerfeld mit dem einen Weg heraus — «Probetraining konfigurieren»; danach
   nennt die Karte die Anzahl und wer im Probe-Modus ist, je mit Plakette.
   Den Probe-Modus selbst schaltet man im Dialog «Spieler:in ändern». */
export function ProbeKarte({
  teamId,
  probetraining,
  spieler,
}: {
  teamId: string;
  probetraining: Probetraining;
  /** Die ganze Spielerliste; die Karte nennt, wer im Probe-Modus ist. */
  spieler: Spieler[];
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);
  const [anzahl, setAnzahl] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const formId = useId();
  const konfiguriert = probetraining.anzahl !== null;
  const probe = spieler.filter((s) => s.probe);

  function oeffnen() {
    setAnzahl(probetraining.anzahl === null ? "" : String(probetraining.anzahl));
    setFehler(null);
    setOffen(true);
  }

  function speichern() {
    if (pending) return;
    const n = anzahl === "" ? null : Number(anzahl);
    const problem = probeAnzahlProblem(n);
    if (problem) return setFehler(problem);
    startTransition(async () => {
      const r = await legeProbetrainingFestAktion(teamId, n!);
      if (!r.ok) return setFehler(r.error);
      setOffen(false);
      router.refresh();
      melde(PROBE_TEXT.festgelegt);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 type-title-large text-on-surface">
          <Sprout size={20} strokeWidth={2} aria-hidden />
          <span>
            {PROBE_TEXT.titel}
            {konfiguriert && (
              <span className="type-label-small ml-2 text-on-surface-mittel">
                {probe.length === 1 ? "1 Spieler:in" : `${probe.length} Spieler:innen`} im Probe-Modus
              </span>
            )}
          </span>
        </h2>
        {konfiguriert && (
          <Tooltip label={PROBE_TEXT.bearbeiten} ende>
            <IconButton icon={Pencil} label={PROBE_TEXT.bearbeiten} aria-haspopup="dialog" onClick={oeffnen} />
          </Tooltip>
        )}
      </div>
      <p className="type-body-medium mt-2 max-w-2xl text-on-surface-mittel">{PROBE_TEXT.karte}</p>

      {konfiguriert ? (
        <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-y-3">
          <dt className="type-body-small text-on-surface-mittel sm:leading-[21px]">{PROBE_TEXT.anzahl}</dt>
          <dd className="type-body-medium mb-2 text-on-surface sm:mb-0">{probetraining.anzahl}</dd>
          <dt className="type-body-small text-on-surface-mittel sm:leading-[21px]">{PROBE_TEXT.imProbeModus}</dt>
          <dd className="type-body-medium text-on-surface">
            {probe.length === 0 ? (
              <span className="text-on-surface-mittel">{PROBE_TEXT.niemand}</span>
            ) : (
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {probe.map((s) => (
                  <li key={s.id} className="inline-flex items-center gap-2">
                    {spielerName(s)}
                    <ProbeLozenge stand={s.probe} />
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </dl>
      ) : (
        <div className="mt-4">
          <Leerzustand
            dicht
            icon={Sprout}
            titel={PROBE_TEXT.leerTitel}
            aktion={
              <Button variant="link" aria-haspopup="dialog" onClick={oeffnen}>
                {PROBE_TEXT.konfigurieren}
              </Button>
            }
          >
            {PROBE_TEXT.leer}
          </Leerzustand>
        </div>
      )}

      <Dialog
        open={offen}
        onClose={() => !pending && setOffen(false)}
        title={konfiguriert ? PROBE_TEXT.bearbeiten : PROBE_TEXT.konfigurieren}
        actions={
          <>
            <Button type="button" variant="outlined" onClick={() => setOffen(false)} disabled={pending}>
              Abbrechen
            </Button>
            <Button type="submit" form={formId} variant="filled" disabled={pending}>
              Speichern
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
          <p>{PROBE_TEXT.dialog}</p>
          <TextField
            label={PROBE_TEXT.anzahl}
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={String(PROBE_ANZAHL_MAX).length}
            className="max-w-60"
            value={anzahl}
            onChange={(e) => {
              setAnzahl(nurZiffern(e.target.value));
              setFehler(null);
            }}
            error={!!fehler}
            supportingText={fehler ?? PROBE_TEXT.anzahlHinweis}
          />
        </form>
      </Dialog>
    </>
  );
}
