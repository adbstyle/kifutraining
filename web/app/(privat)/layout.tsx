/* Seiten hinter einem privaten Link (Epic #433): ohne Konto, ohne Sitzung und
   ohne das App-Chrome — kein Menü, kein Team-Kontext, keine Snackbar. Fürs
   Handy gebaut, eine schmale Spalte. Die Middleware lässt diese Pfade aus
   (keine Sitzung, kein Cookie), die Besucherstatistik zählt sie nicht.

   Die Spalte ist ein Flex-Stapel über die ganze Höhe: Was am Seitenende
   stehen soll («Fragen und Feedback», #544), schiebt sich mit `mt-auto` an
   den unteren Rand, auch wenn die Seite kurz ist. */
export default function PrivatLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col">{children}</main>;
}
