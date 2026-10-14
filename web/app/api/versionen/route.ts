import { NextResponse } from "next/server";
import { getNeuesteVeroeffentlichungAbgeglichen } from "@/lib/releases";

export const dynamic = "force-dynamic";

/* Wann der neueste Release erschien (#410) — für die Seitenleiste, die das
   beim Seitenwechsel nachfragt: Das Layout selbst rendert bei einer
   Client-Navigation nicht neu. Öffentlich und ohne Sitzung; die Antwort
   kommt aus dem Zwischenspeicher. Kennt der die laufende Version nach einem
   Deploy noch nicht, gleicht die Route ihn mit GitHub ab — hier, weil nur
   ein Route Handler den Zwischenspeicher verwerfen darf. */
export async function GET() {
  return NextResponse.json(
    { neueste: await getNeuesteVeroeffentlichungAbgeglichen() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
