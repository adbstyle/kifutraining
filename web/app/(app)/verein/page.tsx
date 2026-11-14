import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { Flash } from "@/components/Flash";
import { TeamAnlegen } from "@/components/verein/TeamAnlegen";
import { Leerzustand, Lozenge, SectionMessage, Tabelle, TabellenZeile } from "@/components/ui";
import { ladeVereinAnsicht, type VerwaltungPerson } from "@/lib/kern/verein";
import { getMeinVereinOderWurf } from "@/lib/queries/verein";
import { createClient } from "@/lib/supabase/server";
import { VEREIN_TEAMS_MAX } from "@/lib/verein";

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

   Konto ohne Verein: zu den Teams. Ein Datenbankfehler wirft (Fehlerseite). */
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

  const ansicht = await ladeVereinAnsicht(supabase, user.id, { vereinId: verein.id });
  if (!ansicht.ok) throw new Error(ansicht.meldung);
  const { name, verwaltung, teams } = ansicht.wert;
  const istVerwaltung = verein.istVerwaltung;

  const spalten = istVerwaltung
    ? // Kopf und Zeilen sind getrennte Raster: die letzte Spalte fest, breit
      // genug für ihren Kopf «Spieler:innen».
      "sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_7rem]"
    : "sm:grid-cols-[minmax(0,1fr)]";

  return (
    <Seitenrahmen breite="voll" krumen={[{ label: name }, { label: "Teams" }]}>
      {/* Nach dem Auflösen eines Teams (`/verein/team/[teamId]`). */}
      {sp.aufgeloest && <Flash message={`Das Team ${sp.aufgeloest.slice(0, 120)} ist aufgelöst.`} param="aufgeloest" />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="type-headline-small text-on-surface">Teams im {name}</h1>
          <p className="type-body-medium text-on-surface-mittel">
            {teams.length === 1 ? "1 Team" : `${teams.length} Teams`} · höchstens {VEREIN_TEAMS_MAX} Teams
          </p>
          <p className="type-body-medium text-on-surface">Vereinsverwaltung: {verwaltungsZeile(verwaltung)}</p>
        </div>
        {istVerwaltung && <TeamAnlegen vereinId={verein.id} anzahlTeams={teams.length} />}
      </div>

      {istVerwaltung && (
        <SectionMessage appearance="information" className="mt-4">
          Die Inhalte eines Teams siehst du nur als Trainer:in im Team. Im Team nimmst du dich mit «Mich aufnehmen»
          selbst auf.
        </SectionMessage>
      )}

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
    </Seitenrahmen>
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
