/* Der Service Worker der privaten Links (#483): EINE Datei für alle Links,
   registriert je Link mit dem Bereich `/abmelden/<link>` (wie das Manifest,
   #650) — jede Spieler:in hat so ihre eigene Anmeldung beim
   Mitteilungsdienst. Er kann nur zwei Dinge: eine Mitteilung zeigen und beim
   Antippen die Benachrichtigungen des Links öffnen. Kein `fetch`, kein
   Cache: Die Seite lädt wie bisher immer frisch.

   Die Adresse aus der Mitteilung öffnet er nur innerhalb seines Bereichs;
   sonst den Link selbst. Ein offenes Fenster des Links bekommt den Fokus. */
import { SERVICE_WORKER_QUELLE } from "@/lib/push-service-worker";

export const dynamic = "force-static";

export function GET() {
  return new Response(SERVICE_WORKER_QUELLE, {
    headers: { "Content-Type": "text/javascript; charset=utf-8" },
  });
}
