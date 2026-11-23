import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { SpielerListe } from "@/components/team/SpielerListe";
import { getTeam } from "@/lib/queries/teams";
import { getMeinVerein } from "@/lib/queries/verein";
import { createClient, getUserImRequest } from "@/lib/supabase/server";
import { ladeSpielerliste } from "@/lib/kern/spieler";
import { ladeKader } from "@/lib/kern/kader";
import { leseProbetraining } from "@/lib/kern/probe";
import type { AdressParameter } from "@/lib/adresse";
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
 * einmal auf die bereinigte Adresse weiter. */
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
  const sauber = bereinigteTeamAdresse(teamVerwaltungPfad(team.id), sp, eingrenzung);
  if (sauber) redirect(sauber);

  return (
    <Card className="p-5 sm:p-6">
      <SpielerListe
        teamId={team.id}
        teamName={team.name}
        vereinName={verein?.name ?? null}
        spieler={liste.wert.spieler}
        kader={kader.wert.kader}
        probeAnzahl={probe.wert.anzahl}
        eingrenzung={eingrenzung}
      />
    </Card>
  );
}
