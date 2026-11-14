"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import {
  AuswahlLeiste,
  AuswahlListe,
  Button,
  Checkbox,
  Dialog,
  Leerzustand,
  Lozenge,
  OverflowMenu,
  SectionMessage,
  Tabelle,
  TabellenZeile,
} from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { ordneSpielerZuAktion } from "@/lib/actions/verein";
import { TeamLozenges } from "@/components/team/TeamLozenges";
import type { VereinSpieler, VereinTeam } from "@/lib/kern/verein";
import { SPIELER_MAX, spielerName } from "@/lib/spieler";
import { SPIELER_BESTAND_LEER, spielerKopfText, zielWeg, zugeordnetText, zuordnenEinleitung } from "@/lib/verein";
import { VereinSpielerFormular } from "./VereinSpielerFormular";
import { VereinSpielerLinkDialog } from "./VereinSpielerLinkDialog";
import { VereinSpielerLoeschen } from "./VereinSpielerLoeschen";

/* Der Spielerbestand des Vereins (Epic Vereine #575): alle Spieler:innen mit
   Vorname, Nachname, Jahrgang, ihren Teams, J+S-Nummer und dem Stand ihres
   privaten Links — auch die ohne Team. Nur die Vereinsverwaltung sieht sie;
   Lesesicht für Mitglieder, Suche und Filter bringt Story #580.

   Je Zeile liegen die Aktionen im ⋮-Menü (Story #582): Ändern, Privater Link,
   Einem Team zuordnen und — zweistufig, mit Bestätigung — Löschen. Über der
   Liste erfasst «Spieler:in erfassen» eine Spieler:in ohne Team. Zugeordnet
   wird einzeln über das Menü oder gesammelt über die Auswahl (#579 AK 2, 20):
   Beide öffnen denselben Dialog «Einem Team zuordnen», der die Teams mit
   ihrem Füllstand «16 von 100» zeigt. Gesammelt gilt ganz oder gar nicht (AK
   21): Lässt sich eine nicht zuordnen, bleibt der Dialog offen und nennt die
   Befunde (AK 22). Danach nennt die Snackbar, wo die erwartete Spielerzahl
   wegfiel (AK 23). Bausteine des Kits: Tabelle, Checkbox, AuswahlLeiste,
   AuswahlListe, OverflowMenu, Dialog, SectionMessage, Lozenge. */

const TITEL_ABWEISUNG = "Keine Spieler:in zugeordnet";

export function VereinSpielerListe({
  vereinId,
  vereinName,
  spieler,
  teams,
}: {
  vereinId: string;
  vereinName: string;
  spieler: VereinSpieler[];
  teams: VereinTeam[];
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [auswahl, setAuswahl] = useState<string[]>([]);
  // Wer im Dialog zugeordnet wird: die Auswahl oder die eine der Zeile.
  const [zuordnen, setZuordnen] = useState<VereinSpieler[] | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [abweisung, setAbweisung] = useState<string | null>(null);
  // Der Dialog zum Erfassen (`{ spieler: null }`) oder Ändern, der Link, das Löschen.
  const [formular, setFormular] = useState<{ spieler: VereinSpieler | null } | null>(null);
  const [link, setLink] = useState<VereinSpieler | null>(null);
  const [loeschen, setLoeschen] = useState<VereinSpieler | null>(null);

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
      if (!r.ok) {
        setAbweisung(r.error);
        // Das Team ist inzwischen aufgelöst (oder das Recht weg): Die Seite
        // lädt neu, damit die Auswahl der Teams wieder stimmt.
        if (zielWeg(r.feld)) router.refresh();
        return;
      }
      setZuordnen(null);
      setAuswahl([]);
      router.refresh();
      melde(zugeordnetText(wer.map(spielerName), team.name, r.ersetzt));
    });
  }

  const kopf = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="type-title-large text-on-surface">
        Spieler:innen
        <span className="type-label-small ml-2 text-on-surface-mittel">{spielerKopfText(spieler.length, ohneTeam)}</span>
      </h2>
      <Button variant="outlined" aria-haspopup="dialog" onClick={() => setFormular({ spieler: null })}>
        <Plus size={18} strokeWidth={2} aria-hidden />
        Spieler:in erfassen
      </Button>
    </div>
  );

  const dialoge = (
    <>
      <VereinSpielerFormular offen={formular} vereinId={vereinId} vereinName={vereinName} onClose={() => setFormular(null)} />
      <VereinSpielerLinkDialog spieler={link} onClose={() => setLink(null)} />
      <VereinSpielerLoeschen spieler={loeschen} onClose={() => setLoeschen(null)} />
    </>
  );

  if (spieler.length === 0)
    return (
      <>
        {kopf}
        <div className="mt-4">
          <Leerzustand icon={Users} titel={SPIELER_BESTAND_LEER.titel}>
            {SPIELER_BESTAND_LEER.text}
          </Leerzustand>
        </div>
        {dialoge}
      </>
    );

  return (
    <>
      {kopf}
      <Tabelle
        className="mt-4"
        spalten="sm:grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem_minmax(0,1.5fr)_7rem_6rem_3rem]"
        kopf={["", "Vorname", "Nachname", "Jahrgang", "Teams", "J+S-Nummer", "Privater Link", ""]}
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
                {s.js && ` · J+S ${s.js}`}
                {s.teams.length === 0 && " · ohne Team"}
                {` · Link ${s.linkBezogen ? "bezogen" : "offen"}`}
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
              <span className="type-body-medium hidden text-on-surface-mittel sm:block">{s.js ?? "–"}</span>
              <span className="hidden sm:block">
                <Lozenge appearance={s.linkBezogen ? "success" : "neutral"}>{s.linkBezogen ? "bezogen" : "offen"}</Lozenge>
              </span>
            </span>
            <span className="flex justify-end">
              <OverflowMenu
                label={`Weitere Aktionen zu ${spielerName(s)}`}
                items={[
                  { label: "Ändern", icon: Pencil, onSelect: () => setFormular({ spieler: s }) },
                  { label: "Privater Link", icon: Link2, onSelect: () => setLink(s) },
                  { label: "Einem Team zuordnen", icon: UserPlus, onSelect: () => oeffnen([s]) },
                  { label: "Löschen", icon: Trash2, danger: true, trenner: true, onSelect: () => setLoeschen(s) },
                ]}
              />
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
      {dialoge}
    </>
  );
}
