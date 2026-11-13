"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users } from "lucide-react";
import {
  AuswahlLeiste,
  AuswahlListe,
  Button,
  Checkbox,
  Dialog,
  IconButton,
  Leerzustand,
  SectionMessage,
  Tabelle,
  TabellenZeile,
  Tooltip,
} from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { ordneSpielerZuAktion } from "@/lib/actions/verein";
import { TeamLozenges } from "@/components/team/TeamLozenges";
import type { VereinSpieler, VereinTeam } from "@/lib/kern/verein";
import { SPIELER_MAX, spielerName } from "@/lib/spieler";
import { VEREIN_SPIELER_MAX, zugeordnetText, zuordnenEinleitung } from "@/lib/verein";

/* Der Spielerbestand des Vereins, Grundfassung (Epic Vereine #575, Story
   #579): alle Spieler:innen mit Vorname, Nachname, Jahrgang und ihren Teams —
   auch die ohne Team. Nur die Vereinsverwaltung sieht sie (AK 1); Lesesicht
   für Mitglieder, Suche und Filter bringt Story #580.

   Zugeordnet wird einzeln über das Symbol der Zeile oder gesammelt über die
   Auswahl (AK 2, 20): Beide öffnen denselben Dialog «Einem Team zuordnen»,
   der die Teams mit ihrem Füllstand «16 von 100» zeigt. Gesammelt gilt ganz
   oder gar nicht (AK 21): Lässt sich eine nicht zuordnen, bleibt der Dialog
   offen und nennt die Befunde (AK 22). Danach nennt die Snackbar, wo die
   erwartete Spielerzahl wegfiel (AK 23). Bausteine des Kits: Tabelle,
   Checkbox, AuswahlLeiste, AuswahlListe, Dialog, SectionMessage. */

const TITEL_ABWEISUNG = "Keine Spieler:in zugeordnet";

export function VereinSpielerListe({ spieler, teams }: { spieler: VereinSpieler[]; teams: VereinTeam[] }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [auswahl, setAuswahl] = useState<string[]>([]);
  // Wer im Dialog zugeordnet wird: die Auswahl oder die eine der Zeile.
  const [zuordnen, setZuordnen] = useState<VereinSpieler[] | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [abweisung, setAbweisung] = useState<string | null>(null);

  // Nur, wer noch im Bestand steht, bleibt ausgewählt.
  const gewaehlt = auswahl.filter((id) => spieler.some((s) => s.id === id));
  const ohneTeam = spieler.filter((s) => s.teams.length === 0).length;

  function oeffnen(wer: VereinSpieler[]) {
    setZuordnen(wer);
    setTeamId(null);
    setAbweisung(null);
  }

  function ausfuehren() {
    const team = teams.find((t) => t.id === teamId);
    if (!zuordnen || !team) return;
    const wer = zuordnen;
    startTransition(async () => {
      const r = await ordneSpielerZuAktion(team.id, team.name, wer.map((s) => s.id));
      if (!r.ok) return setAbweisung(r.error);
      setZuordnen(null);
      setAuswahl([]);
      router.refresh();
      melde(zugeordnetText(wer.map(spielerName), team.name, r.ersetzt));
    });
  }

  const kopf = (
    <h2 className="type-title-large text-on-surface">
      Spieler:innen
      <span className="type-label-small ml-2 text-on-surface-mittel">
        {spieler.length} {spieler.length === 1 ? "Spieler:in" : "Spieler:innen"}
        {ohneTeam > 0 && ` · ${ohneTeam} ohne Team`}
        {` · höchstens ${VEREIN_SPIELER_MAX} je Verein`}
      </span>
    </h2>
  );

  if (spieler.length === 0)
    return (
      <>
        {kopf}
        <div className="mt-4">
          <Leerzustand icon={Users} titel="Noch keine Spieler:innen">
            Der Verein führt noch keine Spieler:innen. Sie kommen über die Spielerliste eines Teams dazu.
          </Leerzustand>
        </div>
      </>
    );

  return (
    <>
      {kopf}
      <Tabelle
        className="mt-4"
        spalten="sm:grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem_minmax(0,1.5fr)_3rem]"
        kopf={["", "Vorname", "Nachname", "Jahrgang", "Teams", ""]}
      >
        {spieler.map((s) => (
          <TabellenZeile key={s.id}>
            <Checkbox
              label={<span className="sr-only">{`${spielerName(s)} auswählen`}</span>}
              checked={gewaehlt.includes(s.id)}
              onChange={(e) => {
                const an = e.target.checked;
                setAuswahl((a) => (an ? [...a.filter((id) => id !== s.id), s.id] : a.filter((id) => id !== s.id)));
              }}
            />
            <span className="min-w-0 flex-1 sm:contents">
              <span className="type-body-medium block truncate text-on-surface">
                {s.vorname}
                <span className="sm:hidden"> {s.nachname}</span>
              </span>
              <span className="type-body-medium hidden truncate text-on-surface sm:block">{s.nachname}</span>
              <span className="type-body-small block text-on-surface-mittel sm:hidden">
                {s.jahrgang}
                {s.teams.length === 0 && " · ohne Team"}
              </span>
              <span className="type-body-medium hidden text-on-surface-mittel sm:block">{s.jahrgang}</span>
              <span className="hidden min-w-0 sm:block">
                {s.teams.length > 0 ? (
                  <TeamLozenges namen={s.teams.map((t) => t.name)} ids={s.teams.map((t) => t.id)} />
                ) : (
                  <span className="type-body-medium text-on-surface-tief">ohne Team</span>
                )}
              </span>
              <TeamLozenges namen={s.teams.map((t) => t.name)} ids={s.teams.map((t) => t.id)} className="mt-1 sm:hidden" />
            </span>
            <span className="flex justify-end">
              <Tooltip label="Einem Team zuordnen" ende>
                <IconButton
                  icon={UserPlus}
                  label={`${spielerName(s)} einem Team zuordnen`}
                  aria-haspopup="dialog"
                  onClick={() => oeffnen([s])}
                />
              </Tooltip>
            </span>
          </TabellenZeile>
        ))}
      </Tabelle>

      <AuswahlLeiste offen={gewaehlt.length > 0} titel={`${gewaehlt.length} ausgewählt`} onAufheben={() => setAuswahl([])}>
        <Button variant="filled" aria-haspopup="dialog" onClick={() => oeffnen(spieler.filter((s) => gewaehlt.includes(s.id)))}>
          Einem Team zuordnen
        </Button>
      </AuswahlLeiste>

      <Dialog
        open={zuordnen !== null}
        onClose={() => !pending && setZuordnen(null)}
        title="Einem Team zuordnen"
        actions={
          <>
            <Button variant="outlined" onClick={() => setZuordnen(null)} disabled={pending}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={ausfuehren} disabled={pending || teamId === null}>
              {zuordnen && zuordnen.length > 1 ? `${zuordnen.length} zuordnen` : "Zuordnen"}
            </Button>
          </>
        }
      >
        {zuordnen && (
          <div className="flex flex-col gap-3">
            {abweisung && (
              <SectionMessage appearance="error">
                <strong className="type-title-small block">{TITEL_ABWEISUNG}</strong>
                {abweisung}
              </SectionMessage>
            )}
            <p>{zuordnenEinleitung(zuordnen.map(spielerName))}</p>
            {teams.length === 0 ? (
              <p className="text-on-surface-mittel">Der Verein hat noch kein Team.</p>
            ) : (
              <AuswahlListe
                ariaLabel="Team"
                items={teams.map((t) => ({
                  id: t.id,
                  titel: t.name,
                  untertitel: `${t.anzahl} von ${SPIELER_MAX}`,
                  gedaempft: t.anzahl >= SPIELER_MAX,
                }))}
                wert={teamId}
                onWahl={(id) => {
                  setTeamId(id);
                  setAbweisung(null);
                }}
              />
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
