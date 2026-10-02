import { cookies } from "next/headers";
import { AppNav } from "@/components/layout/AppNav";
import { AppInhalt, AppRahmen } from "@/components/layout/AppRahmen";
import { SnackbarProvider } from "@/components/layout/SnackbarKontext";
import { TeamKontextProvider } from "@/components/layout/TeamKontext";
import { LEISTE_COOKIE, leseLeiste } from "@/lib/seitenleiste";
import { SPALTE_COOKIE, leseSpalte } from "@/lib/spalte";

/* App-Chrome für alle Seiten ausser den Anmelde-Seiten unter `(auth)`:
   Seitenleiste links, Inhalt rechts. Route-Gruppen wirken nicht auf die URL. */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const slim = leseLeiste(jar.get(LEISTE_COOKIE)?.value);
  const spalte = leseSpalte(jar.get(SPALTE_COOKIE)?.value);
  return (
    // Der Team-Kontext des geöffneten Trainings überdauert die einzelne
    // Seite und wohnt darum hier — siehe TeamKontext (#156).
    <TeamKontextProvider>
      <AppRahmen anfangsSlim={slim} anfangsSpalte={spalte}>
        <AppNav />
        {/* Der eine Platz für Snackbars am unteren Rand überdauert ebenfalls
            die einzelne Seite — siehe SnackbarKontext (#234). Er liegt im
            Rahmen, damit er dessen Leistenbreite erbt. Seiten bringen ihren
            Seitenrahmen (Breite + Kopfzeile) selbst mit. */}
        <SnackbarProvider>
          <AppInhalt>{children}</AppInhalt>
        </SnackbarProvider>
      </AppRahmen>
    </TeamKontextProvider>
  );
}
