import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { VereinSpielerListe } from "@/components/verein/VereinSpielerListe";
import { ladeVereinSpielerliste } from "@/lib/kern/verein";
import { getMeinVereinOderWurf } from "@/lib/queries/verein";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Spieler:innen des Vereins - KiFu", robots: { index: false } };

/* Die Spieler:innen des Vereins (Story #579 AK 1, #582): nur für die
   Vereinsverwaltung. Mitglieder gehen zur Teamübersicht des Bereichs «Verein»
   zurück, Konten ohne Verein zu ihren Teams; die Lesesicht für Mitglieder
   folgt mit Story #580. Die Rolle prüft die Datenebene (`verein_spielerliste`),
   die Weiterleitung hier ist nur der Weg, nicht die Sperre. */
export default async function VereinSpielerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const verein = await getMeinVereinOderWurf();
  if (!verein) redirect("/teams");
  if (!verein.istVerwaltung) redirect("/verein");

  const liste = await ladeVereinSpielerliste(supabase, user.id, { vereinId: verein.id });
  if (!liste.ok) throw new Error(liste.meldung);

  return (
    <Seitenrahmen breite="voll" krumen={[{ label: verein.name }, { label: "Spieler:innen" }]}>
      <h1 className="sr-only">Spieler:innen des {verein.name}</h1>
      <VereinSpielerListe vereinId={verein.id} vereinName={verein.name} spieler={liste.wert.spieler} teams={liste.wert.teams} />
    </Seitenrahmen>
  );
}
