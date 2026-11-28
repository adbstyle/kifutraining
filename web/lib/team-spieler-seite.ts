import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, getUserImRequest } from "@/lib/supabase/server";
import { anzahlSpieler, ladeSpielerliste, vereinVollFuerTeam } from "@/lib/kern/spieler";
import { ladeKader } from "@/lib/kern/kader";
import { leseProbetraining } from "@/lib/kern/probe";
import { spielerTeilnahme, type SpielerTeilnahme } from "@/lib/kern/teilnahme";
import { adresseMitWerten, type AdressParameter } from "@/lib/adresse";
import type { Kader } from "@/lib/kader";
import type { Probetraining } from "@/lib/probe";
import { spielerSperre, type Spieler, type SpielerSperre } from "@/lib/spieler";
import { teamSpielerPfad } from "@/lib/team-bereiche";
import { leseTabellenSortierung, tabellenSortierWerte, type TabellenSpalte } from "@/lib/team-tabellen";
import { liesSpielerAuswahl, liesZeitraum, teilnahmeWerte, type Zeitraum } from "@/lib/teilnahme";
import {
  bereinigeTeamEingrenzung,
  filtereSpieler,
  jahrgaengeDerListe,
  liesTeamEingrenzung,
  teamEingrenzungWerte,
  type TeamEingrenzung,
} from "@/lib/team-spielerliste";

/* Was die Sichten mit Eingrenzung unter «Spieler:innen» gemeinsam laden
 * (#704): die Spielerliste, die Kader und das Schnuppertraining des Teams,
 * die Eingrenzung (#601), den Zeitraum und die gewählte Spieler:in (#700).
 *
 * Was in der Adresse nicht stimmt — Kader und Jahrgänge, die es im Team
 * nicht (mehr) gibt, eine Spieler:in, die nicht im Team ist, unlesbare Tage —
 * fällt mit genau einer Weiterleitung auf die bereinigte Adresse weg, bei
 * einer Sicht mit sortierbarer Tabelle (`sortierbar`) auch eine unbekannte
 * oder als Vorgabe ausgeschriebene Sortierung (#702). Ist
 * eine Spieler:in gewählt, kommt ihre Teilnahme dazu (`spielerTeilnahme`, wie
 * im KI-Werkzeug, NFR 3). Den Zugriff hat der Team-Rahmen geprüft. */

/** Die Kader des Teams, einmal je Request: Der Rahmen der Spieler:innen
 *  (Dialog «Spieler:in hinzufügen») und die Sicht lesen dieselben. */
export const kaderDesTeams = cache(async (teamId: string) => {
  const user = await getUserImRequest();
  if (!user) redirect("/login");
  return ladeKader(await createClient(), user.id, { teamId });
});

/** Was «Spieler:in hinzufügen» im Rahmen der Spieler:innen braucht (#706):
 *  die Kader für den Dialog und ob das Hinzufügen gesperrt ist — die
 *  Spielerliste des Teams voll oder der Spielerbestand des Vereins
 *  (`team_verein_voll`, nur Ja oder Nein). */
export async function ladeHinzufuegen(teamId: string): Promise<{ kader: Kader[]; sperre: SpielerSperre | null }> {
  const supabase = await createClient();
  const [kader, imTeam, vereinVoll] = await Promise.all([
    kaderDesTeams(teamId),
    anzahlSpieler(supabase, teamId),
    vereinVollFuerTeam(supabase, teamId),
  ]);
  if (!kader.ok) throw new Error(kader.meldung);
  return { kader: kader.wert.kader, sperre: spielerSperre(imTeam, vereinVoll) };
}

export type SpielerAnsicht = {
  /** Die Adresse der Sicht, gegen die bereinigt wurde. */
  pfad: string;
  spieler: Spieler[];
  kader: Kader[];
  probe: Probetraining;
  eingrenzung: TeamEingrenzung;
  /** Die Spieler:innen, die die Eingrenzung erfüllen, in der Folge der Liste. */
  gefiltert: Spieler[];
  zeitraum: Zeitraum;
  ausgewaehlt: Spieler | null;
  /** Die Teilnahme der gewählten Spieler:in; `null` ohne Wahl. */
  teilnahme: SpielerTeilnahme | null;
};

/** `unterpfad`: der Pfad des Reiters unter `/team/<id>/spieler` (`""`: die
 *  Liste); `sortierbar`: die Spalten der Tabelle der Sicht, deren Sortierung
 *  in der Adresse steht (`lib/team-tabellen.ts`). */
export async function ladeSpielerAnsicht(
  teamId: string,
  sp: AdressParameter,
  unterpfad = "",
  opts: { sortierbar?: readonly TabellenSpalte<string>[] } = {},
): Promise<SpielerAnsicht> {
  const user = await getUserImRequest();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const [liste, kader, probe] = await Promise.all([
    ladeSpielerliste(supabase, user.id, { teamId }),
    kaderDesTeams(teamId),
    leseProbetraining(supabase, user.id, { teamId }),
  ]);
  if (!liste.ok) throw new Error(liste.meldung);
  if (!kader.ok) throw new Error(kader.meldung);
  if (!probe.ok) throw new Error(probe.meldung);

  const spieler = liste.wert.spieler;
  const eingrenzung = bereinigeTeamEingrenzung(liesTeamEingrenzung(sp), {
    kader: kader.wert.kader,
    jahrgaenge: jahrgaengeDerListe(spieler),
  });
  const auswahlId = liesSpielerAuswahl(sp);
  const ausgewaehlt = auswahlId ? (spieler.find((s) => s.id === auswahlId) ?? null) : null;

  const pfad = `${teamSpielerPfad(teamId)}${unterpfad}`;
  const sortierung = opts.sortierbar && tabellenSortierWerte(leseTabellenSortierung(sp, opts.sortierbar), opts.sortierbar);
  const sauber = adresseMitWerten(pfad, sp, {
    ...teamEingrenzungWerte(eingrenzung),
    ...teilnahmeWerte(sp, ausgewaehlt?.id ?? null),
    ...sortierung,
  });
  if (sauber) redirect(sauber);

  const zeitraum = liesZeitraum(sp);
  let teilnahme: SpielerTeilnahme | null = null;
  if (ausgewaehlt) {
    const r = await spielerTeilnahme(supabase, user.id, { teamId, spielerId: ausgewaehlt.id, ...zeitraum });
    if (!r.ok) throw new Error(r.meldung);
    teilnahme = r.wert;
  }

  return {
    pfad,
    spieler,
    kader: kader.wert.kader,
    probe: { anzahl: probe.wert.anzahl, info: probe.wert.info },
    eingrenzung,
    gefiltert: filtereSpieler(spieler, eingrenzung),
    zeitraum,
    ausgewaehlt,
    teilnahme,
  };
}
