/* Seiten hinter einem privaten Link (Epic #433): ohne Konto, ohne Sitzung und
   ohne das App-Chrome — kein Menü, kein Team-Kontext, keine Snackbar. Fürs
   Handy gebaut, eine schmale Spalte. Die Middleware lässt diese Pfade aus
   (keine Sitzung, kein Cookie), die Besucherstatistik zählt sie nicht. */
export default function PrivatLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col">
      <div className="flex-1">{children}</div>
      <p className="type-body-small px-4 py-6 text-on-surface-tief">KiFu · Trainings für Kinder- und Juniorenfussball</p>
    </main>
  );
}
