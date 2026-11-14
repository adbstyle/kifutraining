import { redirect } from "next/navigation";
import { getMeinVerein } from "@/lib/queries/verein";

export const dynamic = "force-dynamic";

/* Der Bereich «Verein» hat keine eigene Startseite (Story #579, Plan Phase 3):
   Die Vereinsverwaltung landet auf dem Spielerbestand, alle anderen bei ihren
   Teams. Bis Story #581 der Bereich vollständig ist, führt nur `/teams` einen
   Verweis hierher — und nur für die Verwaltung. */
export default async function VereinPage() {
  const verein = await getMeinVerein();
  redirect(verein?.istVerwaltung ? "/verein/spieler" : "/teams");
}
