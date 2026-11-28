"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bold, Heading2, List, ListOrdered, Pencil, ScrollText, type LucideIcon } from "lucide-react";
import {
  Button,
  ChoiceChip,
  ChoiceChipGroup,
  Dialog,
  GegliederterText,
  IconButton,
  KuerzbarerText,
  Leerzustand,
  TextArea,
  Tooltip,
} from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { legeTeamInfosFestAktion } from "@/lib/actions/team-infos";
import { gliedere, type Gliederung } from "@/lib/gliederung";
import {
  TEAM_INFOS_MAX,
  TEAM_INFOS_TEXT,
  teamInfosBereinigt,
  teamInfosLaenge,
  teamInfosProblem,
  teamInfosStand,
  teamInfosZuletzt,
  zahlCh,
  type TeamInfos,
} from "@/lib/team-infos";

/* Die Infos zum Team (#598): gelesen in der Karte, gekürzt mit «Ganz lesen»,
   bearbeitet im Dialog — wie das Schnuppertraining (PO 2026-10-29). Unter dem
   Titel steht, wer sie sieht (AK 4), und der Stand (AK 7).

   Gegliedert wird mit wenigen Kürzeln im Textfeld (AK 2, PO 2026-11-18:
   Textfeld mit Leiste statt WYSIWYG). Die Leiste setzt sie ein, die Vorschau
   zeigt, wie die Eltern den Text sehen. Der Zähler zählt samt Kürzeln (AK 3). */

const LEISTE: { art: Gliederung; icon: LucideIcon; label: string }[] = [
  { art: "titel", icon: Heading2, label: TEAM_INFOS_TEXT.titelKnopf },
  { art: "fett", icon: Bold, label: TEAM_INFOS_TEXT.fettKnopf },
  { art: "aufzaehlung", icon: List, label: TEAM_INFOS_TEXT.aufzaehlungKnopf },
  { art: "nummeriert", icon: ListOrdered, label: TEAM_INFOS_TEXT.nummerierungKnopf },
];

export function TeamInfosKarte({ teamId, infos }: { teamId: string; infos: TeamInfos }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState("");
  const [vorschau, setVorschau] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const feld = useRef<HTMLTextAreaElement>(null);
  const formId = useId();
  const vorhanden = infos.text !== null;
  const laenge = teamInfosLaenge(text);

  function oeffnen() {
    setText(infos.text ?? "");
    setVorschau(false);
    setFehler(null);
    setOffen(true);
  }

  function gliedern(art: Gliederung) {
    const el = feld.current;
    if (!el) return;
    const r = gliedere({ text, start: el.selectionStart, ende: el.selectionEnd }, art);
    setText(r.text);
    if (fehler) setFehler(null);
    // Nach dem Rendern: Fokus und Auswahl zurück ins Feld.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.start, r.ende);
    });
  }

  function speichern() {
    if (pending) return;
    const problem = teamInfosProblem(text);
    if (problem) {
      setVorschau(false);
      return setFehler(problem);
    }
    startTransition(async () => {
      const r = await legeTeamInfosFestAktion(teamId, text);
      // Der Fehler steht unter dem Textfeld: aus der Vorschau dorthin zurück.
      if (!r.ok) {
        setVorschau(false);
        return setFehler(r.error);
      }
      setOffen(false);
      router.refresh();
      melde(r.entfernt ? TEAM_INFOS_TEXT.entfernt : TEAM_INFOS_TEXT.gespeichert);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 type-title-large text-on-surface">
          <ScrollText size={20} strokeWidth={2} aria-hidden />
          {TEAM_INFOS_TEXT.titel}
        </h3>
        {vorhanden && (
          <Tooltip label={TEAM_INFOS_TEXT.bearbeiten} ende>
            <IconButton icon={Pencil} label={TEAM_INFOS_TEXT.bearbeiten} aria-haspopup="dialog" onClick={oeffnen} />
          </Tooltip>
        )}
      </div>
      <p className="type-body-medium mt-2 max-w-2xl text-on-surface-mittel">
        {TEAM_INFOS_TEXT.wer}
        {infos.stand && ` · ${teamInfosStand(infos.stand)}`}
      </p>

      {vorhanden ? (
        <div className="mt-4 max-w-2xl">
          <KuerzbarerText text={infos.text!} gegliedert zeilen={5} />
        </div>
      ) : (
        <div className="mt-4">
          <Leerzustand
            dicht
            icon={ScrollText}
            titel={TEAM_INFOS_TEXT.leerTitel}
            aktion={
              <Button variant="link" aria-haspopup="dialog" onClick={oeffnen}>
                {TEAM_INFOS_TEXT.verfassen}
              </Button>
            }
          >
            {TEAM_INFOS_TEXT.leer}
          </Leerzustand>
        </div>
      )}

      <Dialog
        open={offen}
        onClose={() => !pending && setOffen(false)}
        title={vorhanden ? TEAM_INFOS_TEXT.bearbeiten : TEAM_INFOS_TEXT.verfassen}
        breit
        actions={
          <>
            {infos.stand && (
              <span className="type-body-small mr-auto self-center text-on-surface-mittel">
                {teamInfosZuletzt(infos.stand)}
              </span>
            )}
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
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            speichern();
          }}
        >
          <p>{TEAM_INFOS_TEXT.werDialog}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ChoiceChipGroup ariaLabel={`${TEAM_INFOS_TEXT.schreiben} oder ${TEAM_INFOS_TEXT.vorschau}`}>
              <ChoiceChip selected={!vorschau} onSelect={() => setVorschau(false)}>
                {TEAM_INFOS_TEXT.schreiben}
              </ChoiceChip>
              <ChoiceChip selected={vorschau} onSelect={() => setVorschau(true)}>
                {TEAM_INFOS_TEXT.vorschau}
              </ChoiceChip>
            </ChoiceChipGroup>
            {!vorschau && (
              <div role="toolbar" aria-label={TEAM_INFOS_TEXT.leiste} className="flex items-center gap-1">
                {LEISTE.map((w) => (
                  <Tooltip key={w.art} label={w.label}>
                    <IconButton
                      type="button"
                      icon={w.icon}
                      label={w.label}
                      // Die Auswahl im Textfeld bleibt, solange der Knopf den Fokus nicht nimmt.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => gliedern(w.art)}
                    />
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
          {vorschau ? (
            <div className="min-h-16 rounded-flaeche border border-linie p-3">
              {teamInfosBereinigt(text) ? (
                <GegliederterText text={text} />
              ) : (
                <p className="type-body-medium text-on-surface-mittel">{TEAM_INFOS_TEXT.vorschauLeer}</p>
              )}
            </div>
          ) : (
            <TextArea
              ref={feld}
              label={TEAM_INFOS_TEXT.feld}
              labelVersteckt
              autoFocus
              rows={12}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (fehler) setFehler(null);
              }}
              error={fehler !== null}
              supportingText={fehler ?? TEAM_INFOS_TEXT.unter}
            />
          )}
          <span
            className={`type-body-small self-end px-3 tabular-nums ${laenge > TEAM_INFOS_MAX ? "text-error" : "text-on-surface-mittel"}`}
          >
            {zahlCh(laenge)} / {zahlCh(TEAM_INFOS_MAX)}
          </span>
        </form>
      </Dialog>
    </>
  );
}
