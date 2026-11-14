"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Shield, Trash2, UserRound, Users, X } from "lucide-react";
import {
  Button,
  Card,
  Dialog,
  Gefahrenzone,
  IconButton,
  Leerzustand,
  Lozenge,
  NamenBestaetigen,
  PersonAufnehmen,
  SectionMessage,
  Tabelle,
  TabellenZeile,
  TextField,
  Tooltip,
  namenStimmen,
} from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { TeamLozenges } from "@/components/team/TeamLozenges";
import {
  benenneTeamUmAktion,
  entferneAusTeamAktion,
  loeseTeamAufAktion,
  nimmInsTeamAufAktion,
  nimmMichInsTeamAktion,
  nimmSpielerAusTeamImVereinAktion,
  sucheVereinPersonAktion,
} from "@/lib/actions/verein";
import type { VereinTeamAnsicht, VereinTeamSpieler, VereinTeamTrainer } from "@/lib/kern/verein";
import { SPIELER_MAX } from "@/lib/spieler";
import { teamNameProblem } from "@/lib/team";

/* Ein Team aus Sicht der Vereinsverwaltung (Epic Vereine #575, Story #581
   AK 10–14, 19–22, 24, 25; Story #579 AK 11, 17): Name, Trainerteam,
   Spieler:innen und die Gefahrenzone «Team auflösen». Mehr zeigt die Seite
   nicht — keine J+S-Nummer, keinen Link, keine Termine, Trainings oder Kader
   (AK 10), auch nicht bei einem eigenen Team: Dafür gibt es den Team-Bereich.

   Alles hier geht über die `verein_*`-Aktionen. Umbenennen und Auflösen sind
   Knopf und Dialog; der Dialog bleibt bei einer Abweisung offen und nennt sie
   am Feld bzw. als Section Message (eine Snackbar läge unter ihm, #234). Ist
   das Team inzwischen aufgelöst (oder das Recht weg), nennt er «Team nicht
   gefunden», und die Seite lädt neu: Sie leitet dann zur Übersicht. */

/** Die Action fand ihr Ziel nicht mehr (Team aufgelöst, Recht weg): Die
 *  Seite ist überholt und wird neu geladen. */
function zielWeg(feld?: string) {
  return feld === "team_id" || feld === "verein_id";
}

/** «1 Training», «2 Trainings». */
function n(zahl: number, eins: string, mehr: string) {
  return `${zahl} ${zahl === 1 ? eins : mehr}`;
}

/** «A», «A und B», «A, B und C». */
function aufzaehlung(teile: string[]) {
  return teile.length <= 1 ? (teile[0] ?? "") : `${teile.slice(0, -1).join(", ")} und ${teile.at(-1)}`;
}

/** Der Satz der Gefahrenzone: was mit dem Team verschwindet (nur, was es
 *  gibt) und was mit den Spieler:innen geschieht (nur, wenn es welche gibt). */
function aufloesenBeschreibung(team: VereinTeamAnsicht) {
  const f = team.aufloesung;
  const inhalte = [
    f.trainings > 0 && n(f.trainings, "Training", "Trainings"),
    f.termine > 0 && n(f.termine, "Termin", "Termine"),
    f.spiele > 0 && n(f.spiele, "Spiel", "Spiele"),
    f.kader > 0 && n(f.kader, "Kader", "Kader"),
  ].filter((t): t is string => !!t);
  const loescht = inhalte.length > 0 ? `Auflösen löscht ${aufzaehlung(inhalte)} des Teams.` : "Auflösen löscht das Team.";
  const spieler =
    team.spielerZahl === 0
      ? ""
      : team.spielerZahl === 1
        ? " Die Spieler:in bleibt samt privatem Link im Verein; hat sie kein anderes Team, ist sie danach ohne Team."
        : ` Die ${team.spielerZahl} Spieler:innen bleiben samt privatem Link im Verein; wer kein anderes Team hat, ist danach ohne Team.`;
  return `${loescht}${spieler} Zum Auflösen gibst du den Teamnamen ein.`;
}

export function VereinTeamVerwaltung({
  vereinId,
  vereinName,
  team,
}: {
  vereinId: string;
  vereinName: string;
  team: VereinTeamAnsicht;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [umbenennen, setUmbenennen] = useState(false);
  const [aufnahme, setAufnahme] = useState(false);
  const [entfernen, setEntfernen] = useState<VereinTeamTrainer | null>(null);
  const [entfernenFehler, setEntfernenFehler] = useState<string | null>(null);
  const [herausnehmen, setHerausnehmen] = useState<VereinTeamSpieler | null>(null);
  const [herausnehmenFehler, setHerausnehmenFehler] = useState<string | null>(null);
  const [aufloesen, setAufloesen] = useState(false);

  function michAufnehmen() {
    startTransition(async () => {
      const r = await nimmMichInsTeamAktion(team.id);
      if (!r.ok) {
        melde(r.error);
        if (zielWeg(r.feld)) router.refresh();
        return;
      }
      router.refresh();
      melde(`Du bist jetzt im Team ${team.name}.`);
    });
  }

  function trainerEntfernen(p: VereinTeamTrainer) {
    setEntfernenFehler(null);
    startTransition(async () => {
      const r = await entferneAusTeamAktion(team.id, p.userId);
      if (!r.ok) {
        setEntfernenFehler(r.error);
        if (zielWeg(r.feld)) router.refresh();
        return;
      }
      setEntfernen(null);
      router.refresh();
      melde(`${p.anzeigeName} ist nicht mehr im Team.`);
    });
  }

  function spielerHerausnehmen(s: VereinTeamSpieler) {
    setHerausnehmenFehler(null);
    startTransition(async () => {
      const r = await nimmSpielerAusTeamImVereinAktion(team.id, s.id);
      if (!r.ok) {
        setHerausnehmenFehler(r.error);
        if (zielWeg(r.feld)) router.refresh();
        return;
      }
      setHerausnehmen(null);
      router.refresh();
      melde(`${s.vorname} ist nicht mehr im Team ${team.name}.`);
    });
  }

  const nichtMitglied = !team.ichMitglied;

  return (
    <div className="flex flex-col gap-4">
      {/* Der Hinweis sagt, was diese Ansicht ist und was sie nicht zeigt. */}
      {nichtMitglied ? (
        <SectionMessage
          appearance="information"
          actions={
            <Button variant="link" onClick={michAufnehmen} disabled={pending}>
              Mich aufnehmen
            </Button>
          }
        >
          Du verwaltest dieses Team, ohne selbst Trainer:in zu sein. Termine, Trainings, Spiele und Kader siehst du nur
          als Trainer:in im Team.
        </SectionMessage>
      ) : (
        <SectionMessage
          appearance="information"
          actions={
            <Link href={`/team/${team.id}`} className="font-medium text-primary hover:underline">
              Zum Team
            </Link>
          }
        >
          Du bist Trainer:in dieses Teams. Termine, Trainings, Spiele und Kader siehst du im Team; hier verwaltest du es.
        </SectionMessage>
      )}

      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="type-title-medium text-on-surface">Teamangaben</h2>
            <p className="type-body-small text-on-surface-mittel">Gilt für alle im Team</p>
          </div>
          <Button variant="outlined" aria-haspopup="dialog" onClick={() => setUmbenennen(true)}>
            <Pencil size={18} strokeWidth={2} aria-hidden />
            Umbenennen
          </Button>
        </div>
        <dl className="mt-3">
          <div className="flex items-center justify-between gap-3 border-t border-linie py-2">
            <dt className="type-body-medium text-on-surface-mittel">Name</dt>
            <dd className="type-body-medium min-w-0 break-words text-right font-medium text-on-surface">{team.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-linie py-2">
            <dt className="type-body-medium text-on-surface-mittel">Spieler:innen</dt>
            {/* Über der Grenze keine negative Restzahl, nur die Zahl (PC 7). */}
            <dd className="type-body-medium text-right font-medium text-on-surface">
              {team.spielerZahl <= SPIELER_MAX ? `${team.spielerZahl} von ${SPIELER_MAX}` : `${team.spielerZahl}, höchstens ${SPIELER_MAX} je Team`}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 type-title-large text-on-surface">
            <UserRound size={20} strokeWidth={2} aria-hidden />
            <span>
              Trainerteam
              <span className="type-label-small ml-2 text-on-surface-mittel">
                {team.trainer.length === 0 ? "noch niemand" : team.trainer.length}
              </span>
            </span>
          </h2>
          <Button variant="outlined" aria-haspopup="dialog" onClick={() => setAufnahme(true)}>
            <Plus size={18} strokeWidth={2} aria-hidden />
            Trainer:in aufnehmen
          </Button>
        </div>

        {team.trainer.length === 0 ? (
          <div className="mt-4">
            <Leerzustand
              dicht
              icon={Shield}
              titel="Das Team hat noch keine Trainer:in"
              aktion={
                nichtMitglied ? (
                  <Button variant="outlined" onClick={michAufnehmen} disabled={pending}>
                    Mich aufnehmen
                  </Button>
                ) : undefined
              }
            >
              Ohne Trainer:in plant niemand Termine und Trainings. Nimm jemanden auf oder dich selbst.
            </Leerzustand>
          </div>
        ) : (
          <Tabelle className="mt-4" spalten="sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem]" kopf={["Name", "E-Mail-Adresse", ""]}>
            {team.trainer.map((p) => (
              <TabellenZeile key={p.userId}>
                <span className="min-w-0 flex-1">
                  <span className="type-body-medium block truncate text-on-surface">
                    {p.anzeigeName}
                    {p.ich && <span className="type-label-small ml-2 text-on-surface-mittel">(du)</span>}
                    {p.istVerwaltung && (
                      <Lozenge appearance="neutral" className="ml-2 align-middle">
                        Vereinsverwaltung
                      </Lozenge>
                    )}
                  </span>
                  <span className="type-body-small block break-all text-on-surface-mittel sm:hidden">{p.email}</span>
                </span>
                <span className="type-body-medium hidden break-all text-on-surface-mittel sm:block">{p.email}</span>
                <span className="flex justify-end">
                  {/* Auch die eigene Person: Es gibt hier keinen «Verlassen»-Umweg (AK 14). */}
                  <Tooltip label="Aus dem Team entfernen" ende>
                    <IconButton
                      icon={X}
                      label={`${p.anzeigeName} (${p.email}) aus dem Team entfernen`}
                      aria-haspopup="dialog"
                      onClick={() => {
                        setEntfernenFehler(null);
                        setEntfernen(p);
                      }}
                    />
                  </Tooltip>
                </span>
              </TabellenZeile>
            ))}
          </Tabelle>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 type-title-large text-on-surface">
          <Users size={20} strokeWidth={2} aria-hidden />
          <span>
            Spieler:innen
            <span className="type-label-small ml-2 text-on-surface-mittel">{team.spieler.length}</span>
          </span>
        </h2>
        <p className="type-body-medium mt-2 text-on-surface-mittel">
          Zuordnen unter{" "}
          <Link href="/verein/spieler" className="font-medium text-primary hover:underline">
            Verein › Spieler:innen
          </Link>
          .
        </p>
        {team.spieler.length === 0 ? (
          <p className="type-body-medium mt-3 text-on-surface-tief">Noch keine Spieler:innen im Team.</p>
        ) : (
          <Tabelle
            className="mt-4"
            spalten="sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem_minmax(0,1.5fr)_3rem]"
            kopf={["Vorname", "Nachname", "Jahrgang", "Teams", ""]}
          >
            {team.spieler.map((s) => (
              <TabellenZeile key={s.id}>
                <span className="min-w-0 flex-1 sm:contents">
                  <span className="type-body-medium block truncate text-on-surface">
                    {s.vorname}
                    <span className="sm:hidden"> {s.nachname}</span>
                  </span>
                  <span className="type-body-medium hidden truncate text-on-surface sm:block">{s.nachname}</span>
                  <span className="type-body-small block text-on-surface-mittel sm:hidden">{s.jahrgang}</span>
                  <span className="type-body-medium hidden text-on-surface-mittel sm:block">{s.jahrgang}</span>
                  <span className="hidden min-w-0 sm:flex sm:flex-wrap sm:gap-1">
                    <TeamLozenges namen={s.teams.map((t) => t.name)} ids={s.teams.map((t) => t.id)} />
                    {s.schnuppert && <Lozenge appearance="discovery">Schnuppern</Lozenge>}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1 sm:hidden">
                    <TeamLozenges namen={s.teams.map((t) => t.name)} ids={s.teams.map((t) => t.id)} />
                    {s.schnuppert && <Lozenge appearance="discovery">Schnuppern</Lozenge>}
                  </span>
                </span>
                <span className="flex justify-end">
                  <Tooltip label="Aus dem Team nehmen" ende>
                    <IconButton
                      icon={X}
                      label={`${s.vorname} ${s.nachname} aus dem Team nehmen`}
                      aria-haspopup="dialog"
                      onClick={() => {
                        setHerausnehmenFehler(null);
                        setHerausnehmen(s);
                      }}
                    />
                  </Tooltip>
                </span>
              </TabellenZeile>
            ))}
          </Tabelle>
        )}
      </Card>

      <Gefahrenzone
        beschreibung={aufloesenBeschreibung(team)}
      >
        <Button variant="danger" aria-haspopup="dialog" onClick={() => setAufloesen(true)}>
          <Trash2 size={18} strokeWidth={2} aria-hidden />
          Team auflösen
        </Button>
      </Gefahrenzone>

      <TeamUmbenennen offen={umbenennen} onClose={() => setUmbenennen(false)} teamId={team.id} name={team.name} />

      <PersonAufnehmen
        offen={aufnahme}
        onClose={() => setAufnahme(false)}
        titel="Trainer:in aufnehmen"
        einleitung="Die Person braucht ein Konto bei KiFu. Sie ist sofort im Team, ohne Einladung."
        tragweite={[
          `Sie gehört damit zum ${vereinName}. Solange sie dabei ist, kann sie keinem anderen Verein beitreten und keinen gründen. Die Vereinsverwaltung und das Trainerteam sehen ihre E-Mail-Adresse. Prüfe, dass es das richtige Konto ist.`,
        ]}
        suche={async (email) => {
          const r = await sucheVereinPersonAktion(vereinId, email, team.id);
          if (!r.ok && r.zielWeg) router.refresh();
          return r;
        }}
        aufnahme={async (email) => {
          const r = await nimmInsTeamAufAktion(team.id, email);
          if (!r.ok && r.zielWeg) router.refresh();
          return r;
        }}
        onAufgenommen={(anzeigeName) => {
          router.refresh();
          melde(`${anzeigeName} ist jetzt im Team.`);
        }}
      />

      <Dialog
        open={entfernen != null}
        onClose={() => !pending && setEntfernen(null)}
        title="Aus dem Trainerteam entfernen?"
        actions={
          <>
            <Button variant="outlined" onClick={() => setEntfernen(null)} disabled={pending}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={() => entfernen && trainerEntfernen(entfernen)} disabled={pending}>
              Entfernen
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {entfernenFehler && <SectionMessage appearance="error">{entfernenFehler}</SectionMessage>}
          <p>
            <strong className="text-on-surface">{entfernen?.anzeigeName}</strong>{" "}
            <span className="break-all">({entfernen?.email})</span> sieht die Trainings und Termine dieses Teams danach
            nicht mehr. Bleibt niemand übrig, besteht das Team ohne Trainer:in weiter.
          </p>
        </div>
      </Dialog>

      <Dialog
        open={herausnehmen != null}
        onClose={() => !pending && setHerausnehmen(null)}
        title={herausnehmen ? `${herausnehmen.vorname} ${herausnehmen.nachname} aus ${team.name} nehmen` : undefined}
        actions={
          <>
            <Button variant="outlined" onClick={() => setHerausnehmen(null)} disabled={pending}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={() => herausnehmen && spielerHerausnehmen(herausnehmen)} disabled={pending}>
              Aus dem Team nehmen
            </Button>
          </>
        }
      >
        {herausnehmen && (
          <div className="flex flex-col gap-3">
            {herausnehmenFehler && <SectionMessage appearance="error">{herausnehmenFehler}</SectionMessage>}
            <p>
              {herausnehmen.vorname} bleibt samt privatem Link im {vereinName}.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Künftige Abmeldungen, Spiel-Meldungen und Kader in diesem Team verfallen.</li>
              {herausnehmen.schnuppert && <li>Das Schnuppertraining endet samt Zählung.</li>}
              {herausnehmen.teams.length <= 1 && <li>{herausnehmen.vorname} ist danach keinem Team mehr zugeordnet.</li>}
            </ul>
          </div>
        )}
      </Dialog>

      <TeamAufloesen offen={aufloesen} onClose={() => setAufloesen(false)} team={team} />
    </div>
  );
}

/* Umbenennen: Knopf und Dialog. Der Name wird nicht normalisiert verglichen —
   auch eine andere Schreibweise des eigenen Namens lässt sich speichern (AK
   22); ob der Name im Verein vergeben ist, entscheidet allein die Datenebene
   (AK 20, 21) und nennt das Team am Feld. */
function TeamUmbenennen({ offen, onClose, teamId, name }: { offen: boolean; onClose: () => void; teamId: string; name: string }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [neu, setNeu] = useState(name);
  const [fehler, setFehler] = useState<{ feld: boolean; text: string } | null>(null);

  // Jeder Anlauf beginnt mit dem aktuellen Namen und ohne alte Meldung.
  const [zuletztOffen, setZuletztOffen] = useState(false);
  if (offen !== zuletztOffen) {
    setZuletztOffen(offen);
    if (offen) {
      setNeu(name);
      setFehler(null);
    }
  }

  function speichern() {
    const problem = teamNameProblem(neu);
    if (problem) return setFehler({ feld: true, text: problem });
    setFehler(null);
    startTransition(async () => {
      const r = await benenneTeamUmAktion(teamId, neu);
      if (!r.ok) {
        setFehler({ feld: r.feld === "name", text: r.error });
        if (zielWeg(r.feld)) router.refresh();
        return;
      }
      onClose();
      router.refresh();
      melde("Teamname gespeichert.");
    });
  }

  const schliessen = () => !pending && onClose();
  const formId = `team-umbenennen-${teamId}`;

  return (
    <Dialog
      open={offen}
      onClose={schliessen}
      title="Team umbenennen"
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
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          speichern();
        }}
      >
        {fehler && !fehler.feld && <SectionMessage appearance="error">{fehler.text}</SectionMessage>}
        <TextField
          label="Name"
          value={neu}
          onChange={(e) => setNeu(e.target.value)}
          autoComplete="off"
          autoFocus
          error={!!fehler?.feld}
          supportingText={fehler?.feld ? fehler.text : "Im Verein eindeutig"}
        />
      </form>
    </Dialog>
  );
}

/* Auflösen: der Dialog nennt, was mit dem Team verschwindet, und verlangt den
   Teamnamen (AK 24, 25). Die Spieler:innen bleiben im Verein (PC 1). Stimmt der
   Name nicht mehr, weil das Team inzwischen umbenannt wurde, bleibt der Dialog
   offen und nennt den aktuellen Namen. Danach leitet die Action zur Übersicht,
   die es meldet. */
function TeamAufloesen({ offen, onClose, team }: { offen: boolean; onClose: () => void; team: VereinTeamAnsicht }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const f = team.aufloesung;
  const passt = namenStimmen(eingabe, team.name);

  const [zuletztOffen, setZuletztOffen] = useState(false);
  if (offen !== zuletztOffen) {
    setZuletztOffen(offen);
    if (offen) {
      setEingabe("");
      setFehler(null);
    }
  }

  function ausfuehren() {
    if (!passt) return;
    setFehler(null);
    startTransition(async () => {
      // Gelingt es, leitet die Action selbst zur Übersicht um.
      const r = await loeseTeamAufAktion(team.id, eingabe);
      setFehler(r.error);
      // Der Name hat sich geändert: die Ansicht nachladen, damit der verlangte
      // Name im Dialog der aktuelle ist. Ist das Team weg, leitet sie um.
      if (r.feld === "teamname" || zielWeg(r.feld)) router.refresh();
    });
  }

  const schliessen = () => !pending && onClose();
  const formId = `team-aufloesen-${team.id}`;

  return (
    <Dialog
      open={offen}
      onClose={schliessen}
      title="Team auflösen?"
      actions={
        <>
          <Button type="button" variant="outlined" onClick={schliessen} disabled={pending}>
            Abbrechen
          </Button>
          <Button type="submit" form={formId} variant="danger" disabled={!passt || pending}>
            Team auflösen
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
          ausfuehren();
        }}
      >
        <p>Mit dem Team verschwinden unwiderruflich:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{n(f.trainings, "Team-Training", "Team-Trainings")}</li>
          <li>{n(f.termine, "Trainingstermin", "Trainingstermine")} samt Abmeldungen und Anwesenheiten</li>
          <li>{n(f.spiele, "Spiel", "Spiele")} samt Meldungen und Aufgeboten</li>
          {team.spielerZahl > 0 && (
            <li>die Zuordnung von {n(team.spielerZahl, "Spieler:in", "Spieler:innen")} zu diesem Team</li>
          )}
          <li>{n(f.kader, "Kader", "Kader")}</li>
        </ul>
        <p>Persönliche Trainings der Trainer:innen bleiben erhalten - auch Kopien aus diesem Team.</p>
        {team.spielerZahl === 1 && (
          <p>
            Die Spieler:in bleibt samt privatem Link im Verein. Gehört sie keinem anderen Team an, ist sie danach
            keinem Team mehr zugeordnet; ändern, einem Team zuordnen oder löschen kann sie dann nur die
            Vereinsverwaltung.
          </p>
        )}
        {team.spielerZahl > 1 && (
          <p>
            Die Spieler:innen bleiben samt privatem Link im Verein. Wer keinem anderen Team angehört, ist danach
            keinem Team mehr zugeordnet; ändern, einem Team zuordnen oder löschen kann sie dann nur die
            Vereinsverwaltung.
          </p>
        )}
        <NamenBestaetigen name={team.name} wert={eingabe} onChange={setEingabe} label="Teamname" fehler={fehler} />
      </form>
    </Dialog>
  );
}
