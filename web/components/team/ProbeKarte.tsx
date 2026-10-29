"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Sprout } from "lucide-react";
import { Button, Dialog, IconButton, KuerzbarerText, Leerzustand, TextArea, TextField, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { legeProbetrainingFestAktion } from "@/lib/actions/probe";
import {
  PROBE_ANZAHL_MAX,
  PROBE_INFO_MAX,
  PROBE_TEXT,
  probeAnzahlProblem,
  probeInfoLaenge,
  probeInfoProblem,
  type Probetraining,
} from "@/lib/probe";
import { nurZiffern, spielerName, type Spieler } from "@/lib/spieler";
import { ProbeLozenge } from "./ProbeLozenge";

/* Das Probetraining eines Teams (Epic #554, Story #555): gelesen in der
   Karte, bearbeitet im Dialog (PO 2026-10-29). Ohne Anzahl steht das
   Leerfeld mit dem einen Weg heraus — «Probetraining konfigurieren»; danach
   nennt die Karte die Anzahl und wer im Probe-Modus ist, je mit Plakette.
   Den Probe-Modus selbst schaltet man im Dialog «Spieler:in ändern».

   Das Info-Schreiben (#556) steht im selben Dialog unter der Anzahl: wer es
   sieht hinter dem ⓘ (AK 3), darunter, dass es nur Text ist, und der Zähler
   (AK 2). In der Karte steht es gekürzt mit «Ganz lesen» (AK 7). */
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
  const [info, setInfo] = useState("");
  const [fehler, setFehler] = useState<{ feld: "anzahl" | "info"; text: string } | null>(null);
  const formId = useId();
  const konfiguriert = probetraining.anzahl !== null;
  const probe = spieler.filter((s) => s.probe);

  function oeffnen() {
    setAnzahl(probetraining.anzahl === null ? "" : String(probetraining.anzahl));
    setInfo(probetraining.info ?? "");
    setFehler(null);
    setOffen(true);
  }

  function speichern() {
    if (pending) return;
    const n = anzahl === "" ? null : Number(anzahl);
    const problem = probeAnzahlProblem(n);
    if (problem) return setFehler({ feld: "anzahl", text: problem });
    const infoProblem = probeInfoProblem(info);
    if (infoProblem) return setFehler({ feld: "info", text: infoProblem });
    startTransition(async () => {
      const r = await legeProbetrainingFestAktion(teamId, n!, info);
      if (!r.ok) return setFehler({ feld: r.feld === "info" ? "info" : "anzahl", text: r.error });
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
          <dt className="type-body-small text-on-surface-mittel sm:leading-[21px]">{PROBE_TEXT.info}</dt>
          <dd className="type-body-medium mb-2 text-on-surface sm:mb-0">
            {probetraining.info ? (
              <KuerzbarerText text={probetraining.info} />
            ) : (
              <span className="text-on-surface-tief">{PROBE_TEXT.infoKeines}</span>
            )}
          </dd>
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
            error={fehler?.feld === "anzahl"}
            supportingText={fehler?.feld === "anzahl" ? fehler.text : PROBE_TEXT.anzahlHinweis}
          />
          <div className="flex flex-col gap-1">
            <TextArea
              label={PROBE_TEXT.infoFeld}
              info={PROBE_TEXT.infoWer}
              value={info}
              rows={6}
              onChange={(e) => {
                setInfo(e.target.value);
                if (fehler?.feld === "info") setFehler(null);
              }}
              error={fehler?.feld === "info"}
              supportingText={fehler?.feld === "info" ? fehler.text : PROBE_TEXT.infoUnter}
            />
            <span
              className={`type-body-small self-end px-3 tabular-nums ${probeInfoLaenge(info) > PROBE_INFO_MAX ? "text-error" : "text-on-surface-mittel"}`}
            >
              {probeInfoLaenge(info)} / {PROBE_INFO_MAX}
            </span>
          </div>
        </form>
      </Dialog>
    </>
  );
}
