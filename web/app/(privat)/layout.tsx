import { RechtlicheLinks } from "@/components/layout/RechtlicheLinks";

/* Seiten hinter einem privaten Link (Epic #433): ohne Konto, ohne Sitzung und
   ohne das App-Chrome — kein Menü, kein Team-Kontext, keine Snackbar. Fürs
   Handy gebaut, eine schmale Spalte. Die Middleware lässt diese Pfade aus
   (keine Sitzung, kein Anmelde-Cookie), die Besucherstatistik zählt sie nicht.
   Das einzige Cookie dort merkt sich je Gerät, welche Benachrichtigungen
   schon angezeigt wurden (#642).

   Die Spalte ist ein Flex-Stapel über die ganze Höhe: Was am Seitenende
   stehen soll («Fragen und Feedback», #544), schiebt sich mit `mt-auto` an
   den unteren Rand, auch wenn die Seite kurz ist.

   Darunter, ausserhalb dieses Stapels, Impressum und Datenschutz (#672
   AK 1): Die klebende Leiste bleibt so beim Scrollen am Bildschirmrand und
   gibt die Links erst am Ende der Seite frei. */
export default function PrivatLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <RechtlicheLinks className="px-4 py-4 print:hidden" />
    </main>
  );
}
