import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { KopfAktionen } from "@/components/layout/KopfAktionen";
import { Flash } from "@/components/Flash";
import { TeamAnlegen } from "@/components/verein/TeamAnlegen";
import { VereinSeite } from "@/components/verein/VereinSeite";
import { Leerzustand, Lozenge, SectionMessage, Tabelle, TabellenZeile } from "@/components/ui";
import { ladeVereinAnsicht, ladeVereinbarung, type VerwaltungPerson } from "@/lib/kern/verein";
import { getMeinVereinOderWurf } from "@/lib/queries/verein";
import { createClient } from "@/lib/supabase/server";
import {
  TEAMS_GESPERRT_ID,
  VEREIN_MELDUNG,
  VEREIN_SEITEN,
  VEREIN_VEREINBARUNG_TEXT,
  vereinKopfText,
  vereinTeamsVoll,
  vereinbarungLage,
} from "@/lib/verein";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Teams im Verein - KiFu", robots: { index: false } };

/* Die Übersicht des Vereins (Epic Vereine #575, Story #581 AK 1–9, 11, 17,
   18): alle Mitglieder sehen den Vereinsnamen, die Anzeigenamen der
   Verwaltung (die eigene Person als «du», ohne Anzeigenamen nur als
   «Vereinsverwaltung», nie mit Adresse) und alle Teams. Von fremden Teams
   zeigt die Seite einem Mitglied ohne Verwaltung nur den Namen; eigene Teams
   führen in den Team-Bereich.

   Die Verwaltung sieht je Team Trainer:innen mit Adresse und die Spielerzahl,
   wie die Grenze von 100 sie zählt, und öffnet jedes Team unter
   `/verein/team/[teamId]`. Umbenennen und Auflösen stehen dort, nicht in der
   Liste. Was gezeigt wird, entscheidet die Datenebene (`verein_ansicht` lässt
   die Felder für die Verwaltung bei allen anderen weg); die Seite zeigt nur,
   was sie bekommt.

   Wie die Seiten eines Teams (#707): «Teams» als letzte Brotkrume ohne
   sichtbare Überschrift, «Team anlegen» als Hauptaktion in der Kopfzeile —
   nur für die Verwaltung, an der Grenze gesperrt mit dem Satz darunter —,
   die Zahlen in der Zeile über der Liste.

   Konto ohne Verein: zu den Teams. Ein Datenbankfehler wirft (Fehlerseite),
   ausser beim Hinweis zur Vereinbarung (#675), der dann fehlt. */
export default async function VereinPage({
  searchParams,
}: {
  searchParams: Promise<{ aufgeloest?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const verein = await getMeinVereinOderWurf();
  if (!verein) redirect("/teams");

  const istVerwaltung = verein.istVerwaltung;
  // Die Vereinbarung liest nur die Verwaltung (#675 AK 4); alle anderen fragen gar nicht.
  const [ansicht, vereinbarung] = await Promise.all([
    ladeVereinAnsicht(supabase, user.id, { vereinId: verein.id }),
    istVerwaltung ? ladeVereinbarung(supabase, user.id, { vereinId: verein.id }) : null,
  ]);
  if (!ansicht.ok) throw new Error(ansicht.meldung);
  // Die Vereinbarung ist auf der Übersicht nur ein Hinweis: Scheitert ihr
  // Lesen (etwa im Deploy-Fenster, bevor `verein_vereinbarung` auf der
  // Datenbank ist), fehlt der Hinweis, die Übersicht bleibt. Die Verwaltung
  // zeigt die Vereinbarung selbst und wirft dort.
  if (vereinbarung && !vereinbarung.ok) console.error("verein_vereinbarung:", vereinbarung.meldung);
  const { name, verwaltung, teams, spielerZahl } = ansicht.wert;
  // Eine neue Fassung meldet auch die Übersicht, damit die Verwaltung sie nicht erst in «Verwaltung» findet.
  const neueFassung =
    vereinbarung?.ok === true &&
    vereinbarungLage(vereinbarung.wert.geltend, vereinbarung.wert.zustimmung?.fassung ?? null) === "neue_fassung";

  const spalten = istVerwaltung
    ? // Kopf und Zeilen sind getrennte Raster: die letzte Spalte fest, breit
      // genug für ihren Kopf «Spieler:innen».
      "sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_7rem]"
    : "sm:grid-cols-[minmax(0,1fr)]";

  const teamsVoll = vereinTeamsVoll(teams.length);

  return (
    <VereinSeite
      vereinName={name}
      seite={VEREIN_SEITEN.teams}
      aktionen={istVerwaltung ? <KopfAktionen haupt={<TeamAnlegen vereinId={verein.id} anzahlTeams={teams.length} />} /> : undefined}
    >
      {/* Nach dem Auflösen eines Teams (`/verein/team/[teamId]`). */}
      {sp.aufgeloest && <Flash message={`Das Team ${sp.aufgeloest.slice(0, 120)} ist aufgelöst.`} param="aufgeloest" />}
      <div className="flex flex-col gap-4">
        {istVerwaltung && teamsVoll && (
          <div id={TEAMS_GESPERRT_ID}>
            <SectionMessage>{VEREIN_MELDUNG.VEREIN_TEAMS_VOLL}</SectionMessage>
          </div>
        )}

        {neueFassung && (
          <SectionMessage appearance="information">
            {VEREIN_VEREINBARUNG_TEXT.neueFassung}{" "}
            <Link href="/verein/verwaltung" className="font-semibold text-primary hover:underline">
              {VEREIN_VEREINBARUNG_TEXT.zurVerwaltung}
            </Link>
          </SectionMessage>
        )}

        {istVerwaltung && (
          <SectionMessage appearance="information">
            Die Inhalte eines Teams siehst du nur als Trainer:in im Team. Im Team nimmst du dich mit «Mich aufnehmen»
            selbst auf.
          </SectionMessage>
        )}

        {/* Die Zeilen über der Liste (#707 AK 3): Anzahl und Höchstzahl, dazu die Verwaltung. */}
        <div className="flex flex-col gap-1">
          <p className="type-body-medium text-on-surface">Vereinsverwaltung: {verwaltungsZeile(verwaltung)}</p>
          <p className="type-label-small text-on-surface-mittel">{vereinKopfText(teams.length, spielerZahl)}</p>
        </div>
      </div>

      <div className="mt-4">
        {teams.length === 0 ? (
          <Leerzustand icon={Shield} titel="Noch keine Teams">
            {istVerwaltung
              ? "Lege das erste Team an und nimm dich selbst oder andere Trainer:innen auf."
              : "Der Verein führt noch keine Teams."}
          </Leerzustand>
        ) : (
          <Tabelle spalten={spalten} kopf={istVerwaltung ? ["Team", "Trainer:innen", "Spieler:innen"] : ["Team"]}>
            {teams.map((t) => {
              // Die Verwaltung öffnet jedes Team im Verein-Bereich; wer nur
              // Mitglied ist, öffnet das eigene im Team-Bereich, andere nicht.
              const href = istVerwaltung ? `/verein/team/${t.id}` : t.istMitglied ? `/team/${t.id}` : null;
              const trainer = t.trainer ?? [];
              const ohne = t.ohneMitglied ?? (istVerwaltung && trainer.length === 0);
              return (
                <TabellenZeile key={t.id}>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      {href ? (
                        <Link href={href} className="type-body-medium font-semibold text-primary hover:underline">
                          {t.name}
                        </Link>
                      ) : (
                        <span className="type-body-medium text-on-surface">{t.name}</span>
                      )}
                      {t.istMitglied && <Lozenge appearance="discovery">Mein Team</Lozenge>}
                    </span>
                    {istVerwaltung && (
                      <span className="mt-1 flex flex-col gap-1 sm:hidden">
                        <TrainerSpalte trainer={trainer} ohne={ohne} />
                        <span className="type-body-small text-on-surface-mittel">{t.spielerZahl ?? 0} Spieler:innen</span>
                      </span>
                    )}
                  </span>
                  {istVerwaltung && (
                    <>
                      <span className="hidden min-w-0 sm:flex sm:flex-col sm:gap-1.5">
                        <TrainerSpalte trainer={trainer} ohne={ohne} />
                      </span>
                      <span className="type-body-medium hidden text-on-surface sm:block">{t.spielerZahl ?? 0}</span>
                    </>
                  )}
                </TabellenZeile>
              );
            })}
          </Tabelle>
        )}
      </div>
    </VereinSeite>
  );
}

/** «Adrian Bader (du), Sandra Meier, Vereinsverwaltung»: ohne Anzeigenamen
 *  nur die Rolle, nie die Adresse (AK 9). */
function verwaltungsZeile(verwaltung: VerwaltungPerson[]): string {
  return verwaltung.map((v) => `${v.anzeigeName ?? "Vereinsverwaltung"}${v.ich ? " (du)" : ""}`).join(", ");
}

/** Trainer:innen mit Adresse untereinander, ohne sie die Plakette (AK 4, 7). */
function TrainerSpalte({ trainer, ohne }: { trainer: { userId: string; anzeigeName: string; email: string }[]; ohne: boolean }) {
  // In der Spalte (flex-col) so breit wie ihr Text, nicht wie die Spalte.
  if (ohne) return <Lozenge appearance="warning" className="self-start">ohne Trainer:in</Lozenge>;
  return (
    <>
      {trainer.map((p) => (
        <span key={p.userId} className="flex min-w-0 flex-col">
          <span className="type-body-medium truncate text-on-surface">{p.anzeigeName}</span>
          <span className="type-body-small break-all text-on-surface-mittel">{p.email}</span>
        </span>
      ))}
    </>
  );
}
