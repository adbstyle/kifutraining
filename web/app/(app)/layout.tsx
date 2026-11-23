import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { FigurenSprite } from "@/components/diagramm/figur";
import { FeedbackProvider } from "@/components/feedback/FeedbackKontext";
import { AppNav } from "@/components/layout/AppNav";
import { AppInhalt, AppRahmen } from "@/components/layout/AppRahmen";
import { StartRahmen } from "@/components/start/StartRahmen";
import { DarstellungProvider } from "@/components/layout/DarstellungKontext";
import { SnackbarProvider } from "@/components/layout/SnackbarKontext";
import { TeamKontextProvider } from "@/components/layout/TeamKontext";
import { VersionenProvider } from "@/components/layout/VersionenKontext";
import { KONTO_APP_METADATA } from "@/lib/app-ablegen";
import { GRUND_HELL } from "@/lib/farben";
import { getNeuesteVeroeffentlichung } from "@/lib/releases";
import { getUserImRequest } from "@/lib/supabase/server";
import { GESEHEN_COOKIE, leseGesehen } from "@/lib/versionen-gesehen";
import { DARSTELLUNG_COOKIE, leseDarstellung } from "@/lib/darstellung";
import { LEISTE_COOKIE, leseLeiste } from "@/lib/seitenleiste";
import { SPALTE_COOKIE, leseSpalte } from "@/lib/spalte";

/* KiFu als App (#651): Manifest «KiFu» und die Angaben fürs iPhone — nur hier
   und bei den Anmelde-Seiten, nicht im Wurzel-Layout, damit die Seiten eines
   privaten Links allein ihr eigenes Manifest tragen (#650). */
export const metadata: Metadata = KONTO_APP_METADATA;

/* Ohne Konto steht die Seite im immer hellen Rahmen der Startseite — dann
   auch die Systemleiste hell wie in der Gruppe (start). Angemeldet gilt die
   Wurzel (folgt dem Gerät). */
export async function generateViewport(): Promise<Viewport> {
  const user = await getUserImRequest();
  return user ? {} : { colorScheme: "light", themeColor: GRUND_HELL };
}

/* App-Chrome für alle Seiten ausser den Anmelde-Seiten unter `(auth)`:
   Seitenleiste links, Inhalt rechts. Route-Gruppen wirken nicht auf die URL.
   Ohne Konto keine Seitenleiste (PO 2026-11-23): Was hier ohne Anmeldung
   erreichbar ist (404, Cookies, Versionen), steht im Rahmen der Startseite —
   Übungen und Trainings gibt es ohne Konto nicht (#669). */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [jar, neueste, user] = await Promise.all([
    cookies(),
    getNeuesteVeroeffentlichung(),
    getUserImRequest(),
  ]);
  const slim = leseLeiste(jar.get(LEISTE_COOKIE)?.value);
  const spalte = leseSpalte(jar.get(SPALTE_COOKIE)?.value);
  const darstellung = leseDarstellung(jar.get(DARSTELLUNG_COOKIE)?.value);
  return (
    <DarstellungProvider wahl={darstellung} anonym={!user}>
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
          {user ? (
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
          ) : (
            <StartRahmen angemeldet={false} eigenesMain>
              <FeedbackProvider>
                {/* Die Seiten der App stehen linksbündig neben der Leiste; hier
                    folgen sie der Spalte von Kopf- und Fusszeile. Ihr Seitenkopf
                    klebt nicht: Oben klebt schon die Kopfzeile des Rahmens. */}
                <div className="mx-auto w-full max-w-[1200px] [&_[data-kopf-klebt]]:static [&_[data-kopf-klebt]]:bg-transparent">
                  <SnackbarProvider>{children}</SnackbarProvider>
                </div>
              </FeedbackProvider>
            </StartRahmen>
          )}
        </TeamKontextProvider>
      </VersionenProvider>
    </DarstellungProvider>
  );
}
