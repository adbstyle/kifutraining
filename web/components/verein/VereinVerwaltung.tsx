"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Pencil, Plus, Shield, X } from "lucide-react";
import {
  Button,
  Card,
  Dialog,
  Gefahrenzone,
  IconButton,
  PersonAufnehmen,
  SectionMessage,
  Tabelle,
  TabellenZeile,
  TextField,
  Tooltip,
} from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import {
  benenneVereinUmAktion,
  entferneAusVerwaltungAktion,
  nimmInVerwaltungAufAktion,
  sucheVereinPersonAktion,
} from "@/lib/actions/verein";
import type { VerwaltungPerson } from "@/lib/kern/verein";
import { VEREIN_MELDUNG, VEREIN_TEAMS_MAX, vereinsNameProblem, zielWeg } from "@/lib/verein";

/* Die Verwaltung des Vereins (Epic Vereine #575, Story #581 AK 3, 6, 23,
   30–34): Vereinsname, die Personen der Vereinsverwaltung mit Adresse,
   Aufnehmen und Entfernen und — als Gefahrenzone — der eigene Austritt. Nur für
   die Verwaltung; wer sie nicht ist, sieht die Seite nicht.

   Alle Personen der Verwaltung sind gleichberechtigt. Die letzte kann weder
   entfernt werden noch austreten (AK 33, 34): Der Knopf ist dann gesperrt und
   der Satz dazu steht sichtbar daneben. «Verein löschen» gibt es hier noch
   nicht (Story #587). */

/** Die Verwaltung, die die Seite zeigt: nur wer zur Verwaltung gehört, sieht
 *  sie, darum tragen alle Einträge Kennung und Adresse. */
export type VerwaltungEintrag = VerwaltungPerson & { userId: string; email: string; auchTrainerIn: { id: string; name: string }[] };

/** «A», «A und B», «A, B und C». */
function aufzaehlung(teile: string[]) {
  return teile.length <= 1 ? (teile[0] ?? "") : `${teile.slice(0, -1).join(", ")} und ${teile.at(-1)}`;
}

export function VereinVerwaltung({
  vereinId,
  vereinName,
  anzahlTeams,
  verwaltung,
}: {
  vereinId: string;
  vereinName: string;
  anzahlTeams: number;
  verwaltung: VerwaltungEintrag[];
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [umbenennen, setUmbenennen] = useState(false);
  const [aufnahme, setAufnahme] = useState(false);
  const [entfernen, setEntfernen] = useState<VerwaltungEintrag | null>(null);
  const [austreten, setAustreten] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const ich = verwaltung.find((v) => v.ich);
  const letzte = verwaltung.length <= 1;

  function entfernenAusfuehren(p: VerwaltungEintrag) {
    setFehler(null);
    startTransition(async () => {
      const r = await entferneAusVerwaltungAktion(vereinId, p.userId);
      if (!r.ok) {
        setFehler(r.error);
        if (zielWeg(r.feld)) router.refresh();
        return;
      }
      setEntfernen(null);
      router.refresh();
      melde(`${p.anzeigeName ?? "Die Person"} ist nicht mehr in der Vereinsverwaltung.`);
    });
  }

  function austretenAusfuehren() {
    if (!ich) return;
    setFehler(null);
    startTransition(async () => {
      // Gelingt es, leitet die Action selbst nach /teams um: Wer nicht mehr
      // zur Verwaltung gehört, hat hier nichts mehr zu tun.
      const r = await entferneAusVerwaltungAktion(vereinId, ich.userId);
      if (!r.ok) {
        setFehler(r.error);
        if (zielWeg(r.feld)) router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="type-title-medium text-on-surface">Verein</h2>
            <p className="type-body-small text-on-surface-mittel">Gilt für alle Teams</p>
          </div>
          <Button variant="outlined" aria-haspopup="dialog" onClick={() => setUmbenennen(true)}>
            <Pencil size={18} strokeWidth={2} aria-hidden />
            Umbenennen
          </Button>
        </div>
        <dl className="mt-3">
          <div className="flex items-center justify-between gap-3 border-t border-linie py-2">
            <dt className="type-body-medium text-on-surface-mittel">Name</dt>
            <dd className="type-body-medium min-w-0 break-words text-right font-medium text-on-surface">{vereinName}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-linie py-2">
            <dt className="type-body-medium text-on-surface-mittel">Teams</dt>
            {/* Über der Grenze nur die Zahl, nie ein negativer Rest (PC 7). */}
            <dd className="type-body-medium text-right font-medium text-on-surface">
              {anzahlTeams <= VEREIN_TEAMS_MAX ? `${anzahlTeams} von ${VEREIN_TEAMS_MAX}` : `${anzahlTeams} (höchstens ${VEREIN_TEAMS_MAX} Teams)`}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 type-title-large text-on-surface">
              <Shield size={20} strokeWidth={2} aria-hidden />
              Vereinsverwaltung
            </h2>
            <p className="type-body-small text-on-surface-mittel">
              {verwaltung.length === 1 ? "1 Person" : `${verwaltung.length} Personen`}, alle gleichberechtigt
            </p>
          </div>
          <Button variant="outlined" aria-haspopup="dialog" onClick={() => setAufnahme(true)}>
            <Plus size={18} strokeWidth={2} aria-hidden />
            Person aufnehmen
          </Button>
        </div>
        <Tabelle className="mt-4" spalten="sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem]" kopf={["Name", "E-Mail-Adresse", ""]}>
          {verwaltung.map((v) => (
            <TabellenZeile key={v.userId}>
              <span className="min-w-0 flex-1">
                <span className="type-body-medium block truncate text-on-surface">
                  {v.anzeigeName ?? "Vereinsverwaltung"}
                  {v.ich && <span className="type-label-small ml-2 text-on-surface-mittel">(du)</span>}
                </span>
                {/* Auch ohne Anzeigenamen sieht die Verwaltung die Adresse (AK 6). */}
                <span className="type-body-small block break-all text-on-surface-mittel sm:hidden">{v.email}</span>
                {v.anzeigeName === null && <span className="type-body-small block text-on-surface-mittel">ohne Anzeigenamen</span>}
                {v.auchTrainerIn.length > 0 && (
                  <span className="type-body-small block text-on-surface-mittel">
                    auch Trainer:in in {aufzaehlung(v.auchTrainerIn.map((t) => t.name))}
                  </span>
                )}
              </span>
              <span className="type-body-medium hidden break-all text-on-surface-mittel sm:block">{v.email}</span>
              <span className="flex justify-end">
                {/* Sich selbst nimmt man über den Austritt in der Gefahrenzone heraus. */}
                {!v.ich && (
                  <Tooltip label="Aus der Vereinsverwaltung entfernen" ende>
                    <IconButton
                      icon={X}
                      label={`${v.anzeigeName ?? "Vereinsverwaltung"} (${v.email}) aus der Vereinsverwaltung entfernen`}
                      aria-haspopup="dialog"
                      onClick={() => {
                        setFehler(null);
                        setEntfernen(v);
                      }}
                    />
                  </Tooltip>
                )}
              </span>
            </TabellenZeile>
          ))}
        </Tabelle>
      </Card>

      <Gefahrenzone beschreibung="Austreten betrifft nur dich; in deinen Teams bleibst du Trainer:in.">
        <div className="flex flex-col items-start gap-3">
          <Button
            variant="outlined"
            disabled={letzte || !ich}
            aria-describedby={letzte ? "letzte-verwaltung" : undefined}
            aria-haspopup="dialog"
            onClick={() => {
              setFehler(null);
              setAustreten(true);
            }}
          >
            <LogOut size={18} strokeWidth={2} aria-hidden />
            Aus der Verwaltung austreten
          </Button>
          {letzte && (
            <SectionMessage appearance="warning">
              <span id="letzte-verwaltung">{VEREIN_MELDUNG.LETZTE_VERWALTUNG}</span>
            </SectionMessage>
          )}
        </div>
      </Gefahrenzone>

      <VereinUmbenennen offen={umbenennen} onClose={() => setUmbenennen(false)} vereinId={vereinId} name={vereinName} />

      <PersonAufnehmen
        offen={aufnahme}
        onClose={() => setAufnahme(false)}
        titel="Person in die Verwaltung aufnehmen"
        einleitung="Die Person braucht ein Konto bei KiFu. Sie ist sofort in der Verwaltung, ohne Annahme."
        tragweite={[
          `Sie gehört damit zum ${vereinName} und verwaltet Teams, Spieler:innen und den Verein mit. Solange sie dabei ist, kann sie keinem anderen Verein beitreten und keinen eigenen gründen. Die Verwaltung und die Trainer:innen ihrer Teams sehen ihre E-Mail-Adresse. Prüfe, dass es das richtige Konto ist.`,
        ]}
        suche={async (email) => {
          const r = await sucheVereinPersonAktion(vereinId, email);
          if (!r.ok && r.zielWeg) router.refresh();
          return r;
        }}
        aufnahme={async (email) => {
          const r = await nimmInVerwaltungAufAktion(vereinId, email);
          if (!r.ok && r.zielWeg) router.refresh();
          return r;
        }}
        onAufgenommen={(anzeigeName) => {
          router.refresh();
          melde(`${anzeigeName} gehört jetzt zur Vereinsverwaltung.`);
        }}
      />

      <Dialog
        open={entfernen != null}
        onClose={() => !pending && setEntfernen(null)}
        title="Aus der Vereinsverwaltung entfernen?"
        actions={
          <>
            <Button variant="outlined" onClick={() => setEntfernen(null)} disabled={pending}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={() => entfernen && entfernenAusfuehren(entfernen)} disabled={pending}>
              Entfernen
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>}
          <p>
            <strong className="text-on-surface">{entfernen?.anzeigeName ?? "Vereinsverwaltung"}</strong>{" "}
            <span className="break-all">({entfernen?.email})</span> verwaltet den {vereinName} danach nicht mehr. In
            den eigenen Teams bleibt die Person Trainer:in.
          </p>
        </div>
      </Dialog>

      <Dialog
        open={austreten}
        onClose={() => !pending && setAustreten(false)}
        title="Aus der Verwaltung austreten?"
        actions={
          <>
            <Button variant="outlined" onClick={() => setAustreten(false)} disabled={pending}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={austretenAusfuehren} disabled={pending}>
              Austreten
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>}
          <p>Du verwaltest den {vereinName} danach nicht mehr. In deinen Teams bleibst du Trainer:in.</p>
        </div>
      </Dialog>
    </div>
  );
}

/* Den Verein umbenennen: Knopf und Dialog (AK 23). Leer und über der Grenze
   weist schon das Feld ab (`vereinsNameProblem`); das letzte Wort hat die
   Datenebene. */
function VereinUmbenennen({ offen, onClose, vereinId, name }: { offen: boolean; onClose: () => void; vereinId: string; name: string }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [neu, setNeu] = useState(name);
  const [fehler, setFehler] = useState<string | null>(null);

  const [zuletztOffen, setZuletztOffen] = useState(false);
  if (offen !== zuletztOffen) {
    setZuletztOffen(offen);
    if (offen) {
      setNeu(name);
      setFehler(null);
    }
  }

  function speichern() {
    const problem = vereinsNameProblem(neu);
    if (problem) return setFehler(problem);
    setFehler(null);
    startTransition(async () => {
      const r = await benenneVereinUmAktion(vereinId, neu);
      if (!r.ok) {
        setFehler(r.error);
        if (zielWeg(r.feld)) router.refresh();
        return;
      }
      onClose();
      router.refresh();
      melde("Vereinsname gespeichert.");
    });
  }

  const schliessen = () => !pending && onClose();
  const formId = "verein-umbenennen";

  return (
    <Dialog
      open={offen}
      onClose={schliessen}
      title="Verein umbenennen"
      actions={
        <>
          <Button type="button" variant="outlined" onClick={schliessen} disabled={pending}>
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
        onSubmit={(e) => {
          e.preventDefault();
          speichern();
        }}
      >
        <TextField label="Name" value={neu} onChange={(e) => setNeu(e.target.value)} autoComplete="off" autoFocus error={!!fehler} supportingText={fehler ?? undefined} />
      </form>
    </Dialog>
  );
}
