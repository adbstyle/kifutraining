import { Users } from "lucide-react";
import { Leerzustand } from "@/components/ui";
import { ListeMitDetail } from "@/components/layout/ListeMitDetail";
import { EinzelteilnahmeRechts } from "@/components/team/EinzelteilnahmeRechts";
import { TeamSpielerFilter } from "@/components/team/TeamSpielerFilter";
import { TeilnahmeLeer } from "@/components/team/TeilnahmeLeer";
import { TeilnahmeTabelle } from "@/components/team/TeilnahmeTabelle";
import { TeilnahmeZeitraum } from "@/components/team/TeilnahmeZeitraum";
import { TabellenAuswahl } from "@/components/training/TabellenAuswahl";
import { createClient, getUserImRequest } from "@/lib/supabase/server";
import { teamTeilnahmeZahlen } from "@/lib/kern/teilnahme";
import type { AdressParameter } from "@/lib/adresse";
import { ladeSpielerAnsicht } from "@/lib/team-spieler-seite";
import { jahrgaengeDerListe } from "@/lib/team-spielerliste";
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
    <ListeMitDetail
      spaltenName="Teilnahme"
      links={
        <div className="flex flex-col gap-4">
          {ansicht.spieler.length === 0 ? (
            <Leerzustand icon={Users} titel={TEILNAHME_TEXT.keineSpieler}>
              {TEILNAHME_TEXT.keineSpielerText}
            </Leerzustand>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <TeamSpielerFilter
                  className=""
                  eingrenzung={ansicht.eingrenzung}
                  kader={ansicht.kader}
                  jahrgaenge={jahrgaengeDerListe(ansicht.spieler)}
                />
                <TeilnahmeZeitraum zeitraum={ansicht.zeitraum} heute={heute} />
              </div>
              {zeilen.length === 0 ? (
                <TeilnahmeLeer />
              ) : (
                <>
                  {/* Fokus und Sichtbarkeit beim Öffnen und Schliessen der Teilnahme daneben. */}
                  <TabellenAuswahl ausgewaehlt={ansicht.ausgewaehlt?.id} attribut="data-spieler-zeile" />
                  <TabellenAuswahl ausgewaehlt={ansicht.ausgewaehlt?.id} attribut="data-spieler-karte" />
                  <TeilnahmeTabelle
                    zeilen={zeilen}
                    sortierung={sortierung}
                    pfad={ansicht.pfad}
                    sp={sp}
                    ausgewaehlt={ansicht.ausgewaehlt?.id ?? null}
                    zeitraumText={zeitraumWert(ansicht.zeitraum, heute)}
                  />
                  <p className="type-body-small text-on-surface-mittel">{TEILNAHME_TEXT.fussnote}</p>
                </>
              )}
            </>
          )}
        </div>
      }
      // `ListeMitDetail` teilt die Fläche nur mit einem Detail; ohne Wahl bleibt `rechts` leer.
      rechts={ansicht.teilnahme && <EinzelteilnahmeRechts ansicht={ansicht} sp={sp} />}
    />
  );
}
