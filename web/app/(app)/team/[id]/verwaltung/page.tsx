import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { ListeMitDetail } from "@/components/layout/ListeMitDetail";
import { SpielerListe } from "@/components/team/SpielerListe";
import { SpielerTeilnahmeSpalte } from "@/components/team/SpielerTeilnahmeSpalte";
import { getTeam } from "@/lib/queries/teams";
import { getMeinVerein } from "@/lib/queries/verein";
import { createClient, getUserImRequest } from "@/lib/supabase/server";
import { ladeSpielerliste } from "@/lib/kern/spieler";
import { ladeKader } from "@/lib/kern/kader";
import { leseProbetraining } from "@/lib/kern/probe";
import { spielerTeilnahme, type SpielerTeilnahme } from "@/lib/kern/teilnahme";
import { kaderVon } from "@/lib/kader";
import { heuteAmTrainingsort } from "@/lib/zeit";
import { SPIELER_AUSWAHL_PARAM, bereinigteTeilnahmeAdresse, liesSpielerAuswahl, liesZeitraum } from "@/lib/teilnahme";
import { adresseMitWerten, type AdressParameter } from "@/lib/adresse";
import { teamVerwaltungPfad } from "@/lib/team-bereiche";
import {
  bereinigeTeamEingrenzung,
  bereinigteTeamAdresse,
  jahrgaengeDerListe,
  liesTeamEingrenzung,
} from "@/lib/team-spielerliste";

/* Bereich «Spieler:innen» der Team-Verwaltung (#656): die Spielerliste samt
 * Link-Dialog je Spieler:in und Zuteilen zu Kadern (#434, #452).
 *
 * Er liegt auf der bisherigen Adresse der Team-Verwaltung, damit Lesezeichen
 * und Verweise darauf weiter gelten (#656 PC 1). Die übrigen Bereiche:
 * kader/ (Kader und Schnuppertraining), link/ (Selbstabholung und Infos zum
 * Team), trainer/ (Teamangaben, Mitglieder, Gefahrenzone).
 *
 * Suche und Eingrenzung (#601) stehen in der Adresse (`?q=`, `?kader=`,
 * `?jahrgang=`, `?link=`); die Liste grenzt im Browser ein. Kader und
 * Jahrgänge, die es im Team nicht (mehr) gibt, und unbrauchbare Werte leiten
 * einmal auf die bereinigte Adresse weiter.
 *
 * Der Name einer Spieler:in öffnet daneben ihre Teilnahme (#700, `?spieler=`)
 * mit dem Zeitraum in der Adresse (`?von=`, `?bis=`); wie die Trainings des
 * Teams (`ListeMitDetail`), schmal ersetzt die Spalte die Liste. Eine
 * Spieler:in, die nicht (mehr) im Team ist, und unlesbare Tage fallen mit
 * einer Weiterleitung weg. */
export default async function TeamSpielerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<AdressParameter>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Den Zugriff hat der Rahmen bereits geprüft (team/[id]/layout.tsx).
  const user = await getUserImRequest();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // `getTeam` antwortet aus dem Request-Cache des Rahmens.
  const [team, verein, liste, kader, probe] = await Promise.all([
    getTeam(id),
    getMeinVerein(),
    ladeSpielerliste(supabase, user.id, { teamId: id }),
    ladeKader(supabase, user.id, { teamId: id }),
    leseProbetraining(supabase, user.id, { teamId: id }),
  ]);
  if (!team) redirect("/teams");
  if (!liste.ok) throw new Error(liste.meldung);
  if (!kader.ok) throw new Error(kader.meldung);
  if (!probe.ok) throw new Error(probe.meldung);

  const eingrenzung = bereinigeTeamEingrenzung(liesTeamEingrenzung(sp), {
    kader: kader.wert.kader,
    jahrgaenge: jahrgaengeDerListe(liste.wert.spieler),
  });
  const pfad = teamVerwaltungPfad(team.id);
  const sauber = bereinigteTeamAdresse(pfad, sp, eingrenzung);
  if (sauber) redirect(sauber);

  const auswahlId = liesSpielerAuswahl(sp);
  const ausgewaehlt = auswahlId ? (liste.wert.spieler.find((s) => s.id === auswahlId) ?? null) : null;
  const teilnahmeSauber = bereinigteTeilnahmeAdresse(pfad, sp, ausgewaehlt?.id ?? null);
  if (teilnahmeSauber) redirect(teilnahmeSauber);

  let teilnahme: SpielerTeilnahme | null = null;
  if (ausgewaehlt) {
    const r = await spielerTeilnahme(supabase, user.id, { teamId: team.id, spielerId: ausgewaehlt.id, ...liesZeitraum(sp) });
    if (!r.ok) throw new Error(r.meldung);
    teilnahme = r.wert;
  }

  return (
    <ListeMitDetail
      spaltenName="Teilnahme"
      links={
        <Card className="p-5 sm:p-6">
          <SpielerListe
            teamId={team.id}
            teamName={team.name}
            vereinName={verein?.name ?? null}
            spieler={liste.wert.spieler}
            kader={kader.wert.kader}
            probeAnzahl={probe.wert.anzahl}
            eingrenzung={eingrenzung}
            ausgewaehlt={ausgewaehlt?.id ?? null}
          />
        </Card>
      }
      rechts={
        ausgewaehlt &&
        teilnahme && (
          <SpielerTeilnahmeSpalte
            teilnahme={teilnahme}
            jahrgang={ausgewaehlt.jahrgang}
            kaderNamen={kaderVon(ausgewaehlt.id, kader.wert.kader).map((k) => k.name)}
            heute={heuteAmTrainingsort()}
            // Schliessen: dieselbe Adresse ohne Spieler:in — Eingrenzung und Zeitraum bleiben.
            schliessenHref={adresseMitWerten(pfad, sp, { [SPIELER_AUSWAHL_PARAM]: "" }) ?? pfad}
          />
        )
      }
    />
  );
}
