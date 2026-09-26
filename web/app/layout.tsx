import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/layout/AppNav";
import { SnackbarProvider } from "@/components/layout/SnackbarKontext";
import { TeamKontextProvider } from "@/components/layout/TeamKontext";

// Eine Familie für die ganze Anwendung: Display, Titel, Fliesstext und
// Label stammen aus demselben Entwurf, unterschieden werden sie nur über
// Gewicht, Versalien und Sperrung. Variabel geladen (kein weight-Array),
// weil die Skala von 400 bis 700 reicht.
const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Übungen & Trainings für Kinder- und Juniorenfussball",
  description:
    "Übungen durchsuchen und filtern sowie strukturierte Trainings zusammenstellen — nach den SFV-Trainingsschemata für Kinderfussball und Juniorenfussball.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Die Font-Variable gehört an <html> und nicht an <body>: `--font-sans`
  // wird in `globals.css` auf `:root` definiert und dort auch BERECHNET.
  // Stünde `--font-geist` erst am <body>, wäre die Substitution auf `:root`
  // ungültig — und eine Custom Property mit ungültiger Substitution hat den
  // leeren Wert, den <body> dann erbt. Die ganze App fiele damit auf
  // Tailwinds Vorgabe zurück.
  return (
    <html lang="de-CH" className={sans.variable}>
      <body className="min-h-screen antialiased">
        {/* Der Team-Kontext des geöffneten Trainings überdauert die einzelne
            Seite und wohnt darum hier — siehe TeamKontext (#156). */}
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
      </body>
    </html>
  );
}
