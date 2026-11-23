import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { VereinVerwaltung, type VerwaltungEintrag } from "@/components/verein/VereinVerwaltung";
import { VereinbarungKarte } from "@/components/verein/VereinbarungKarte";
import { ladeVereinAnsicht, ladeVereinbarung } from "@/lib/kern/verein";
import { getMeinVereinOderWurf } from "@/lib/queries/verein";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verwaltung des Vereins - KiFu", robots: { index: false } };

/* Die Verwaltung des Vereins (Epic Vereine #575, Story #581): Vereinsname,
   Vereinsverwaltung, die Vereinbarung zur Auftragsbearbeitung (#675 AK 3, 4),
   Austritt und Löschen des Vereins (#587). Nur für die Vereinsverwaltung; alle anderen
   gehen zur Übersicht (AK 1, 3, 9) — die Anzeigenamen der Verwaltung stehen
   dort im Kopf. Die Sperre ist die Datenebene (`verein_ansicht` liefert
   Kennung und Adresse nur der Verwaltung), die Weiterleitung nur der Weg. */
export default async function VereinVerwaltungPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const verein = await getMeinVereinOderWurf();
  if (!verein) redirect("/teams");
  if (!verein.istVerwaltung) redirect("/verein");

  const [ansicht, vereinbarung] = await Promise.all([
    ladeVereinAnsicht(supabase, user.id, { vereinId: verein.id }),
    ladeVereinbarung(supabase, user.id, { vereinId: verein.id }),
  ]);
  if (!ansicht.ok) throw new Error(ansicht.meldung);
  if (!vereinbarung.ok) throw new Error(vereinbarung.meldung);
  const { name, teams, spielerZahl, spielerOhneTeam, personen } = ansicht.wert;

  // Die Zahl der Spieler:innen liefert die Datenebene der Verwaltung mit; fehlt sie, ist etwas falsch.
  if (spielerZahl === undefined || spielerOhneTeam === undefined || personen === undefined)
    throw new Error("verein_ansicht: Verwaltung ohne Zahlen von Spieler:innen oder Personen");

  // Die Verwaltung sieht Kennung und Adresse aller Personen; fehlt eine, ist
  // etwas an der Datenebene falsch — dann lieber keine Seite als eine ohne Adresse.
  const verwaltung: VerwaltungEintrag[] = ansicht.wert.verwaltung.map((v) => {
    if (v.userId === undefined || v.email === undefined) throw new Error("verein_ansicht: Verwaltung ohne Kennung oder Adresse");
    const userId = v.userId;
    return {
      ...v,
      userId,
      email: v.email,
      // In welchen Teams die Person auch Trainer:in ist (Board).
      auchTrainerIn: teams.filter((t) => t.trainer?.some((p) => p.userId === userId)).map((t) => ({ id: t.id, name: t.name })),
    };
  });

  return (
    <Seitenrahmen breite="5xl" krumen={[{ label: name }, { label: "Verwaltung" }]}>
      <h1 className="sr-only">Vereinsverwaltung von «{name}»</h1>
      <p className="type-body-medium mb-4 text-on-surface-mittel">Was den ganzen Verein betrifft</p>
      <VereinVerwaltung
        vereinId={verein.id}
        vereinName={name}
        anzahlTeams={teams.length}
        anzahlSpieler={spielerZahl}
        spielerOhneTeam={spielerOhneTeam}
        anzahlPersonen={personen}
        verwaltung={verwaltung}
        vereinbarung={<VereinbarungKarte vereinbarung={vereinbarung.wert} />}
      />
    </Seitenrahmen>
  );
}
