import { NextResponse } from "next/server";
import { getNeuesteVeroeffentlichung } from "@/lib/releases";

export const dynamic = "force-dynamic";

/* Wann der neueste Release erschien (#410) — für die Seitenleiste, die das
   beim Seitenwechsel nachfragt: Das Layout selbst rendert bei einer
   Client-Navigation nicht neu. Öffentlich und ohne Sitzung; die Antwort
   kommt aus dem Zwischenspeicher. */
export async function GET() {
  return NextResponse.json(
    { neueste: await getNeuesteVeroeffentlichung() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
