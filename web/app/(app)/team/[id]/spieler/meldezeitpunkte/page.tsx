import { MeldeTabelle } from "@/components/team/MeldeTabelle";
import { MeldeTeam } from "@/components/team/MeldeTeam";
import { SpielerTabellenSeite } from "@/components/team/SpielerTabellenSeite";
import { createClient, getUserImRequest } from "@/lib/supabase/server";
import { teamMeldeZahlen, teamTeilnahmeZahlen } from "@/lib/kern/teilnahme";
import type { AdressParameter } from "@/lib/adresse";
import { fasseFensterZusammen, leereMediane, MELDE_TEXT, meldeMediane } from "@/lib/meldezeitpunkte";
import { ladeSpielerAnsicht } from "@/lib/team-spieler-seite";
import { liesZeitraum, teamSummen, zeitraumWert } from "@/lib/teilnahme";
import { leseTabellenSortierung, MELDE_SPALTEN, sortiereZeilen } from "@/lib/team-tabellen";
import { heuteAmTrainingsort } from "@/lib/zeit";
import { redirect } from "next/navigation";

/* Reiter «Meldezeitpunkte» unter «Spieler:innen» (#703, Variante M2): wie
 * lange vor Beginn bzw. Anpfiff sich die Spieler:innen von Trainings abmelden
 * und zu Spielen an- und abmelden.
 *
 * Oben die Meldungen im Team — je Meldeart die Verteilung auf fünf
 * Zeitfenster (AK 5), daneben «Ohne Abmeldung gefehlt» und «Nicht gemeldet»
 * (AK 7, 8) —, darunter je Spieler:in die drei Mediane, sortierbar (AK 1–4,
 * 11). Die Teamzahlen sind die Summe der eingegrenzten Spieler:innen (AK 9,
 * 10); «Ohne Abmeldung gefehlt» und «Nicht gemeldet» kommen aus derselben
 * Zählung wie die Teilnahme-Übersicht (`teamTeilnahmeZahlen`, NFR 3).
 *
 * Eingrenzung, Zeitraum, Sortierung und die geöffnete Spieler:in stehen in
 * der Adresse wie im Reiter «Teilnahme»; der Zeitraum gilt auch für die
 * Teilnahme daneben und reist beim Reiterwechsel mit (AK 12). */
export default async function TeamMeldezeitpunktePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<AdressParameter>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await getUserImRequest();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // Der Zeitraum, wie ihn die Bereinigung stehen lässt — so zählen alle parallel.
  const zeitraum = liesZeitraum(sp);
  const [ansicht, melde, teilnahme] = await Promise.all([
    ladeSpielerAnsicht(id, sp, "/meldezeitpunkte", { sortierbar: MELDE_SPALTEN }),
    teamMeldeZahlen(supabase, user.id, { teamId: id, ...zeitraum }),
    teamTeilnahmeZahlen(supabase, user.id, { teamId: id, ...zeitraum }),
  ]);
  if (!melde.ok) throw new Error(melde.meldung);
  if (!teilnahme.ok) throw new Error(teilnahme.meldung);

  const heute = heuteAmTrainingsort();
  const zeitraumText = zeitraumWert(ansicht.zeitraum, heute);
  const ids = ansicht.gefiltert.map((s) => s.id);
  const je = meldeMediane(melde.wert.zeilen);
  const sortierung = leseTabellenSortierung(sp, MELDE_SPALTEN);
  const zeilen = sortiereZeilen(
    ansicht.gefiltert.map((s) => ({ ...s, mediane: je.get(s.id)?.mediane ?? leereMediane() })),
    sortierung,
    (z, spalte) => z.mediane[spalte],
  ).map((z) => ({ spieler: z, mediane: z.mediane }));

  return (
    <SpielerTabellenSeite
      ansicht={ansicht}
      sp={sp}
      heute={heute}
      keineSpielerText={MELDE_TEXT.keineSpielerText}
      leer={zeilen.length === 0}
      vorTabelle={
        <>
          <MeldeTeam
            fenster={fasseFensterZusammen(melde.wert.zeilen, ids)}
            summen={teamSummen(teilnahme.wert.zahlen, ids)}
            zeitraumText={zeitraumText}
          />
          <h3 className="mt-2 type-title-medium text-on-surface">{MELDE_TEXT.jeSpielerin}</h3>
        </>
      }
      tabelle={
        <MeldeTabelle
          zeilen={zeilen}
          sortierung={sortierung}
          pfad={ansicht.pfad}
          sp={sp}
          ausgewaehlt={ansicht.ausgewaehlt?.id ?? null}
          zeitraumText={zeitraumText}
        />
      }
      fussnote={MELDE_TEXT.fussnote}
    />
  );
}
