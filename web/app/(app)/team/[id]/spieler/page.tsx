import { redirect } from "next/navigation";
import { ListeMitDetail } from "@/components/layout/ListeMitDetail";
import { EinzelteilnahmeRechts } from "@/components/team/EinzelteilnahmeRechts";
import { SpielerListe } from "@/components/team/SpielerListe";
import { getTeam } from "@/lib/queries/teams";
import { getMeinVerein } from "@/lib/queries/verein";
import type { AdressParameter } from "@/lib/adresse";
import { ladeSpielerAnsicht } from "@/lib/team-spieler-seite";

/* Reiter «Liste» unter «Spieler:innen» (#704): die Spielerliste samt
 * Link-Dialog je Spieler:in und Zuteilen zu Kadern (#434, #452). Die übrigen
 * Reiter: kader/ (Kader und Schnuppertraining), link/ (Selbstabholung und
 * Infos zum Team). «Spieler:innen» in der Seitenleiste öffnet immer hier.
 *
 * Suche und Eingrenzung (#601) stehen in der Adresse (`?q=`, `?kader=`,
 * `?jahrgang=`, `?link=`); die Liste grenzt im Browser ein. Der Name einer
 * Spieler:in öffnet daneben ihre Teilnahme (#700, `?spieler=`) mit dem
 * Zeitraum in der Adresse (`?von=`, `?bis=`); wie die Trainings des Teams
 * (`ListeMitDetail`), schmal ersetzt die Spalte die Liste. Was in der Adresse
 * nicht stimmt, bereinigt `ladeSpielerAnsicht` mit einer Weiterleitung. */
export default async function TeamSpielerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<AdressParameter>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // `getTeam` antwortet aus dem Request-Cache des Rahmens, der den Zugriff geprüft hat.
  const [team, verein, ansicht] = await Promise.all([getTeam(id), getMeinVerein(), ladeSpielerAnsicht(id, sp)]);
  if (!team) redirect("/teams");

  return (
    <ListeMitDetail
      spaltenName="Teilnahme"
      links={
        // Ohne Karte und ohne Überschrift (#706): Eingrenzung, Anzahl und
        // Tabelle stehen wie in den übrigen Reitern direkt unter den Reitern.
        <div>
          <SpielerListe
            teamId={team.id}
            teamName={team.name}
            vereinName={verein?.name ?? null}
            spieler={ansicht.spieler}
            kader={ansicht.kader}
            probeAnzahl={ansicht.probe.anzahl}
            eingrenzung={ansicht.eingrenzung}
            ausgewaehlt={ansicht.ausgewaehlt?.id ?? null}
          />
        </div>
      }
      // `ListeMitDetail` teilt die Fläche nur mit einem Detail; ohne Wahl bleibt `rechts` leer.
      rechts={ansicht.teilnahme && <EinzelteilnahmeRechts ansicht={ansicht} sp={sp} />}
    />
  );
}
