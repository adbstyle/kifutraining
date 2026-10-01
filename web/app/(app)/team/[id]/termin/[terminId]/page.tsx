import { redirect } from "next/navigation";
import { getTeam } from "@/lib/queries/teams";
import { istUuid } from "@/lib/kennung";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/* Der Verweis aus dem Kalenderprogramm (#330 PC 7, 8). Ohne Anmeldung führt
   die Middleware über den Login hierher zurück. Kein Mitglied → Teamübersicht;
   Termin weg → Trainingsplan mit Hinweis; sonst der Termin im Plan, auch im
   Rückblick. Weitergeleitet wird auf die Liste: Sie trägt den Termin immer,
   ein Monat müsste erst gewählt werden. */
export default async function TerminVerweis({ params }: { params: Promise<{ id: string; terminId: string }> }) {
  const { id, terminId } = await params;
  if (!(await getTeam(id))) redirect("/teams");
  const supabase = await createClient();
  let data: { id: string } | null = null;
  if (istUuid(terminId)) {
    const r = await supabase.from("training_termine").select("id").eq("id", terminId).eq("team_id", id).maybeSingle();
    // Ein Datenbankfehler ist kein «Termin weg»: Er führt auf die Fehlerseite.
    if (r.error) throw r.error;
    data = r.data;
  }
  redirect(data ? `/team/${id}?termin=${terminId}` : `/team/${id}?hinweis=termin_weg`);
}
