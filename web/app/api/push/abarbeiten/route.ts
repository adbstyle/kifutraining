import { createAnonClient } from "@/lib/supabase/anon";
import { env } from "@/lib/env";
import { arbeitePushAb, pushZugang } from "@/lib/kern/push";
import { pushSchluessel } from "@/lib/push/schluessel";
import { webPushSender } from "@/lib/push/senden";

/* Mitteilungen zustellen (#483): Die Datenbank stösst diese Route an, sobald
   neue Aufträge liegen (Trigger + pg_net), und jede Minute, solange welche
   liegen bleiben (pg_cron). Der Bearer ist das Geheimnis aus Supabase Vault
   dieser Umgebung; geprüft wird es in der Datenebene (`push_auftraege_holen`
   antwortet sonst `null`). Kein Service-Role-Schlüssel, keine Sitzung
   (Middleware schliesst /api/push aus).

   Antworten: 401 ohne gültiges Geheimnis, 503 ohne VAPID (die Aufträge
   bleiben liegen), sonst 200 mit den Zahlen — nie Adressen oder Links. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const kopf = request.headers.get("authorization") ?? "";
  const geheimnis = /^Bearer (\S{32,512})$/.exec(kopf)?.[1];
  if (!geheimnis) return new Response(null, { status: 401 });
  const vapid = env.vapid();
  if (!vapid) return new Response(null, { status: 503 });
  const bilanz = await arbeitePushAb({
    zugang: pushZugang(createAnonClient(), geheimnis, pushSchluessel(vapid.publicKey)),
    senden: webPushSender(vapid),
  });
  if (!bilanz.berechtigt) return new Response(null, { status: 401 });
  return Response.json(bilanz, { headers: { "Cache-Control": "no-store" } });
}
