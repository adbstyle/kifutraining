"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import {
  AuswahlLeiste,
  AuswahlListe,
  Button,
  Checkbox,
  Dialog,
  Lozenge,
  OverflowMenu,
  SectionMessage,
  Tabelle,
  TabellenZeile,
} from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { ordneSpielerZuAktion } from "@/lib/actions/verein";
import type { VereinSpieler, VereinTeam } from "@/lib/kern/verein";
import { SPIELER_MAX, spielerName } from "@/lib/spieler";
import {
  SCHNUPPERN_ZUORDNEN_HINWEIS,
  SCHNUPPERN_ZUORDNEN_LABEL,
  schnuppernZugeordnetText,
  zielWeg,
  zugeordnetText,
  zuordnenEinleitung,
} from "@/lib/verein";
import { SchnupperLozenge } from "@/components/spieler/SchnupperLozenge";
import type { SpielerEingrenzung } from "@/lib/verein-spielerliste";
import { VereinSpielerFilter } from "./VereinSpielerFilter";
import { VereinSpielerFormular } from "./VereinSpielerFormular";
import { VereinSpielerLinkDialog } from "./VereinSpielerLinkDialog";
import { VereinSpielerLoeschen } from "./VereinSpielerLoeschen";
import { SpielerFuss, SpielerKopf, SpielerLeer, SpielerTeams } from "./VereinSpielerTeile";

/* Der Spielerbestand des Vereins (Epic Vereine #575): alle Spieler:innen mit
   Vorname, Nachname, Jahrgang, ihren Teams, J+S-Nummer und dem Stand ihres
   privaten Links — auch die ohne Team. Nur die Vereinsverwaltung sieht diese
   Sicht; Mitglieder haben ihre lesende (`VereinSpielerAnsicht`). Suche und
   Eingrenzung (Story #580) laufen auf dem Server: Die Liste bekommt die
   Treffer und zeigt davon eine Seite; Auswahl und Aktionen gelten für die
   Zeilen, die stehen, und die Auswahl leert sich, wenn Suche oder
   Eingrenzung wechseln.

   Je Zeile liegen die Aktionen im ⋮-Menü (Story #582): Ändern, Privater Link,
   Einem Team zuordnen und — zweistufig, mit Bestätigung — Löschen. Über der
   Liste erfasst «Spieler:in erfassen» eine Spieler:in ohne Team. Zugeordnet
   wird einzeln über das Menü oder gesammelt über die Auswahl (#579 AK 2, 20):
   Beide öffnen denselben Dialog «Einem Team zuordnen», der die Teams mit
   ihrem Füllstand «16 von 100» zeigt. Gesammelt gilt ganz oder gar nicht (AK
   21): Lässt sich eine nicht zuordnen, bleibt der Dialog offen und nennt die
   Befunde (AK 22). Danach nennt die Snackbar, wo die erwartete Spielerzahl
   wegfiel (AK 23). Bei genau einer gewählten Spieler:in ohne Team bietet der
   Dialog zusätzlich «Zum Schnuppern zuordnen» (#584 AK 8): sonst gar nicht,
   nie als gesperrtes Feld; angehakt steht der Satz zur Regel darunter. Die
   Teams-Spalte zeigt «Schnuppern n/m». Bausteine des Kits: Tabelle, Checkbox, AuswahlLeiste,
   AuswahlListe, OverflowMenu, Dialog, SectionMessage, Lozenge. */

const TITEL_ABWEISUNG = "Keine Spieler:in zugeordnet";

export function VereinSpielerListe({
  vereinId,
  vereinName,
  spieler,
  treffer,
  gesamt,
  ohneTeam,
  teams,
  jahrgaenge,
  eingrenzung,
  weiterHref,
  pfad,
}: {
  vereinId: string;
  vereinName: string;
  /** Die Zeilen, die stehen (eine Seite oder mehr); `treffer` zählt alle. */
  spieler: VereinSpieler[];
  treffer: number;
  /** Alle Spieler:innen des Vereins und davon die ohne Team, ungefiltert. */
  gesamt: number;
  ohneTeam: number;
  teams: VereinTeam[];
  jahrgaenge: number[];
  eingrenzung: SpielerEingrenzung;
  weiterHref: string | null;
  pfad: string;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [auswahl, setAuswahl] = useState<string[]>([]);
  // Wer im Dialog zugeordnet wird: die Auswahl oder die eine der Zeile.
  const [zuordnen, setZuordnen] = useState<VereinSpieler[] | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [abweisung, setAbweisung] = useState<string | null>(null);
  const [schnuppern, setSchnuppern] = useState(false);
  // Der Dialog zum Erfassen (`{ spieler: null }`) oder Ändern, der Link, das Löschen.
  const [formular, setFormular] = useState<{ spieler: VereinSpieler | null } | null>(null);
  const [link, setLink] = useState<VereinSpieler | null>(null);
  const [loeschen, setLoeschen] = useState<VereinSpieler | null>(null);

  // Andere Suche, andere Eingrenzung: Die Auswahl gilt nur für die Zeilen,
  // die man sieht, und beginnt von vorn.
  const schluessel = JSON.stringify(eingrenzung);
  const [schluesselVorher, setSchluesselVorher] = useState(schluessel);
  if (schluessel !== schluesselVorher) {
    setSchluesselVorher(schluessel);
    setAuswahl([]);
  }

  // Nur, wer noch dasteht, bleibt ausgewählt.
  const gewaehlt = auswahl.filter((id) => spieler.some((s) => s.id === id));

  function oeffnen(wer: VereinSpieler[]) {
    setZuordnen(wer);
    setTeamId(null);
    setAbweisung(null);
    setSchnuppern(false);
  }

  // Zum Schnuppern lässt sich nur eine einzelne Spieler:in ohne Team zuordnen (#584 AK 8).
  const kannSchnuppern = zuordnen !== null && zuordnen.length === 1 && zuordnen[0].teams.length === 0;

  function ausfuehren() {
    const team = teams.find((t) => t.id === teamId);
    if (!zuordnen || !team) return;
    const wer = zuordnen;
    startTransition(async () => {
      const zumSchnuppern = kannSchnuppern && schnuppern;
      const r = await ordneSpielerZuAktion(team.id, team.name, wer.map((s) => s.id), zumSchnuppern);
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
      melde(
        zumSchnuppern ? schnuppernZugeordnetText(spielerName(wer[0]), team.name) : zugeordnetText(wer.map(spielerName), team.name, r.ersetzt),
      );
    });
  }

  const kopf = (
    <SpielerKopf
      gesamt={gesamt}
      ohneTeam={ohneTeam}
      aktion={
        <Button variant="outlined" aria-haspopup="dialog" onClick={() => setFormular({ spieler: null })}>
          <Plus size={18} strokeWidth={2} aria-hidden />
          Spieler:in erfassen
        </Button>
      }
    />
  );

  const dialoge = (
    <>
      <VereinSpielerFormular offen={formular} vereinId={vereinId} vereinName={vereinName} onClose={() => setFormular(null)} />
      <VereinSpielerLinkDialog spieler={link} onClose={() => setLink(null)} />
      <VereinSpielerLoeschen spieler={loeschen} onClose={() => setLoeschen(null)} />
    </>
  );

  return (
    <>
      {kopf}
      {/* Die Leiste steht an derselben Stelle, ob Treffer da sind oder nicht:
          Wer tippt, behält den Fokus im Suchfeld. */}
      {gesamt > 0 && <VereinSpielerFilter eingrenzung={eingrenzung} teams={teams} jahrgaenge={jahrgaenge} />}
      {treffer === 0 ? (
        <div className="mt-4">
          <SpielerLeer vereinLeer={gesamt === 0} verwaltung pfad={pfad} />
        </div>
      ) : (
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
                  {` · Link ${s.linkBezogen ? "bezogen" : "offen"}`}
                </span>
                <span className="type-body-medium hidden text-on-surface-mittel sm:block">{s.jahrgang}</span>
                <span className="mt-1 block min-w-0 sm:mt-0">
                  <SpielerTeams teams={s.teams}>{s.schnuppern && <SchnupperLozenge stand={s.schnuppern} />}</SpielerTeams>
                </span>
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
      )}
      <SpielerFuss angezeigt={spieler.length} treffer={treffer} weiterHref={weiterHref} />

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
            {kannSchnuppern && teams.length > 0 && (
              <div className="flex flex-col gap-1">
                <Checkbox
                  label={SCHNUPPERN_ZUORDNEN_LABEL}
                  checked={schnuppern}
                  disabled={pending}
                  onChange={(e) => {
                    setSchnuppern(e.target.checked);
                    setAbweisung(null);
                  }}
                />
                {schnuppern && <p className="type-body-small text-on-surface-mittel">{SCHNUPPERN_ZUORDNEN_HINWEIS}</p>}
              </div>
            )}
          </div>
        )}
      </Dialog>
      {dialoge}
    </>
  );
}
