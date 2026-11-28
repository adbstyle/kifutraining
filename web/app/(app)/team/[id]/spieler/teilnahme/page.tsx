import { SpielerTabellenSeite } from "@/components/team/SpielerTabellenSeite";
import { TeilnahmeTabelle } from "@/components/team/TeilnahmeTabelle";
import { createClient, getUserImRequest } from "@/lib/supabase/server";
import { teamTeilnahmeZahlen } from "@/lib/kern/teilnahme";
import type { AdressParameter } from "@/lib/adresse";
import { ladeSpielerAnsicht } from "@/lib/team-spieler-seite";
import { liesZeitraum, teilnahmeTabellenZeile, teilnahmeZahlen, TEILNAHME_TEXT, zeitraumWert } from "@/lib/teilnahme";
import { leseTabellenSortierung, sortiereZeilen, TEILNAHME_SPALTEN } from "@/lib/team-tabellen";
import { heuteAmTrainingsort } from "@/lib/zeit";
import { redirect } from "next/navigation";

/* Reiter «Teilnahme» unter «Spieler:innen» (#702): die Teilnahme aller
 * Spieler:innen, die aktuell im Team sind (auch Schnuppernde), nebeneinander
 * — je Spieler:in für Trainings und Spiele, wie oft da und nicht da, ohne
 * Abmeldung gefehlt, nicht aufgeboten und nicht gemeldet (AK 1–5).
 *
 * Alles steht in der Adresse und wird auf dem Server gerechnet: die
 * Eingrenzung der Spielerliste (AK 10, `?q=`, `?kader=`, `?jahrgang=`,
 * `?link=`), der Zeitraum (AK 7, `?von=`, `?bis=`), die Sortierung (AK 6,
 * `?sort=`, `?dir=`) und die geöffnete Spieler:in (AK 8, `?spieler=`). Ihre
 * Teilnahme steht daneben mit demselben Zeitraum; wer ihn dort ändert,
 * ändert ihn für die Übersicht (AK 9). Was in der Adresse nicht stimmt,
 * bereinigt `ladeSpielerAnsicht` in einer Weiterleitung.
 *
 * Gezählt wird mit `teamTeilnahmeZahlen` — dieselbe Zählregel wie die
 * Einzelteilnahme und das KI-Werkzeug (NFR 3). */
export default async function TeamTeilnahmePage({
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

  // Der Zeitraum, wie ihn die Bereinigung stehen lässt — so zählen beide parallel.
  const zeitraum = liesZeitraum(sp);
  const [ansicht, zahlen] = await Promise.all([
    ladeSpielerAnsicht(id, sp, "/teilnahme", { sortierbar: TEILNAHME_SPALTEN }),
    teamTeilnahmeZahlen(supabase, user.id, { teamId: id, ...zeitraum }),
  ]);
  if (!zahlen.ok) throw new Error(zahlen.meldung);

  const heute = heuteAmTrainingsort();
  const sortierung = leseTabellenSortierung(sp, TEILNAHME_SPALTEN);
  const leer = teilnahmeZahlen([]);
  const zeilen = sortiereZeilen(
    ansicht.gefiltert.map((s) => ({ ...s, werte: teilnahmeTabellenZeile(zahlen.wert.zahlen.get(s.id) ?? leer) })),
    sortierung,
    (z, spalte) => z.werte[spalte],
  ).map((z) => ({ spieler: z, werte: z.werte }));

  return (
    <SpielerTabellenSeite
      ansicht={ansicht}
      sp={sp}
      heute={heute}
      keineSpielerText={TEILNAHME_TEXT.keineSpielerText}
      leer={zeilen.length === 0}
      tabelle={
        <TeilnahmeTabelle
          zeilen={zeilen}
          sortierung={sortierung}
          pfad={ansicht.pfad}
          sp={sp}
          ausgewaehlt={ansicht.ausgewaehlt?.id ?? null}
          zeitraumText={zeitraumWert(ansicht.zeitraum, heute)}
        />
      }
      fussnote={TEILNAHME_TEXT.fussnote}
    />
  );
}
