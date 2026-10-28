import { cookies } from "next/headers";
import { FigurenSprite } from "@/components/diagramm/figur";
import { FeedbackProvider } from "@/components/feedback/FeedbackKontext";
import { AppNav } from "@/components/layout/AppNav";
import { AppInhalt, AppRahmen } from "@/components/layout/AppRahmen";
import { SnackbarProvider } from "@/components/layout/SnackbarKontext";
import { TeamKontextProvider } from "@/components/layout/TeamKontext";
import { VersionenProvider } from "@/components/layout/VersionenKontext";
import { getNeuesteVeroeffentlichung } from "@/lib/releases";
import { GESEHEN_COOKIE, leseGesehen } from "@/lib/versionen-gesehen";
import { LEISTE_COOKIE, leseLeiste } from "@/lib/seitenleiste";
import { SPALTE_COOKIE, leseSpalte } from "@/lib/spalte";

/* App-Chrome für alle Seiten ausser den Anmelde-Seiten unter `(auth)`:
   Seitenleiste links, Inhalt rechts. Route-Gruppen wirken nicht auf die URL. */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [jar, neueste] = await Promise.all([cookies(), getNeuesteVeroeffentlichung()]);
  const slim = leseLeiste(jar.get(LEISTE_COOKIE)?.value);
  const spalte = leseSpalte(jar.get(SPALTE_COOKIE)?.value);
  return (
    <>
      {/* Die Figurteile aller Feld-Diagramme, einmal pro Seite (siehe figur.tsx). */}
      <FigurenSprite />
      {/* Der Team-Kontext des geöffneten Trainings überdauert die einzelne
          Seite und wohnt darum hier — siehe TeamKontext (#156). Ebenso, ob es
          einen neuen Release gibt (#410): ohne Releases keine Markierung. */}
      <VersionenProvider
        anfangsNeueste={neueste}
        anfangsGesehen={leseGesehen(jar.get(GESEHEN_COOKIE)?.value)}
      >
        <TeamKontextProvider>
          <AppRahmen anfangsSlim={slim} anfangsSpalte={spalte}>
            {/* «Fragen und Feedback» (#542) überdauert die Seite ebenfalls: Der
                Dialog bleibt beim Seitenwechsel offen, am Desktop als Spalte
                rechts im Rahmen. */}
            <FeedbackProvider>
              <AppNav />
              {/* Der eine Platz für Snackbars am unteren Rand überdauert ebenfalls
                  die einzelne Seite — siehe SnackbarKontext (#234). Er liegt im
                  Rahmen, damit er dessen Leistenbreite erbt. Seiten bringen ihren
                  Seitenrahmen (Breite + Kopfzeile) selbst mit. */}
              <SnackbarProvider>
                <AppInhalt>{children}</AppInhalt>
              </SnackbarProvider>
            </FeedbackProvider>
          </AppRahmen>
        </TeamKontextProvider>
      </VersionenProvider>
    </>
  );
}
