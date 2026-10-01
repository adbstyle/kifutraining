import { AppNav } from "@/components/layout/AppNav";
import { SnackbarProvider } from "@/components/layout/SnackbarKontext";
import { TeamKontextProvider } from "@/components/layout/TeamKontext";

/* App-Chrome für alle Seiten ausser den Anmelde-Seiten unter `(auth)`.
   Route-Gruppen wirken nicht auf die URL. */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Der Team-Kontext des geöffneten Trainings überdauert die einzelne
    // Seite und wohnt darum hier — siehe TeamKontext (#156).
    <TeamKontextProvider>
      {/* Der eine Platz für Snackbars am unteren Rand überdauert ebenfalls
          die einzelne Seite — siehe SnackbarKontext (#234). */}
      <SnackbarProvider>
        <div className="flex min-h-dvh flex-col">
          {/* App-Navigation im Druck ausblenden (Story #18). */}
          <div className="print:hidden">
            <AppNav />
          </div>
          {/* Inhaltsspalte unter dem (klebenden) Header. Seiten bringen ihren
              eigenen <main>-Container mit eigener max-width mit. */}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </SnackbarProvider>
    </TeamKontextProvider>
  );
}
