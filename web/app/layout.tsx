import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/layout/AppNav";
import { TeamKontextProvider } from "@/components/layout/TeamKontext";

// Eine Familie für alles, was gelesen wird: Display, Titel und Fliesstext
// stammen aus demselben Entwurf, unterschieden werden sie nur über Gewicht,
// Versalien und Sperrung. Variabel geladen (kein weight-Array), weil die
// Skala von 400 bis 700 reicht.
const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});
// Die Schwesterschrift für alles, was gezählt wird — Dauern, Wechsel, Masse,
// Hex-Werte. Gleiche Proportionen, aber jede Ziffer gleich breit, damit
// Kolonnen von selbst fluchten.
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
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
  // Die Font-Variablen gehören an <html> und nicht an <body>: `--font-sans`
  // und `--font-mono` werden in `globals.css` auf `:root` definiert und
  // dort auch BERECHNET. Stünde `--font-geist` erst am <body>, wäre die
  // Substitution auf `:root` ungültig — und eine Custom Property mit
  // ungültiger Substitution hat den leeren Wert, den <body> dann erbt. Die
  // ganze App fiele damit auf Tailwinds Vorgabe zurück.
  return (
    <html lang="de-CH" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        {/* Der Team-Kontext des geöffneten Trainings überdauert die einzelne
            Seite und wohnt darum hier — siehe TeamKontext (#156). */}
        <TeamKontextProvider>
          <div className="flex min-h-dvh flex-col">
            {/* App-Navigation im Druck ausblenden (Story #18). */}
            <div className="print:hidden">
              <AppNav />
            </div>
            {/* Inhaltsspalte unter dem (klebenden) Header. Seiten bringen ihren
                eigenen <main>-Container mit eigener max-width mit. */}
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </TeamKontextProvider>
      </body>
    </html>
  );
}
