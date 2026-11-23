import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Besucherstatistik } from "@/components/layout/Besucherstatistik";
import { THEME_FARBEN } from "@/lib/app-ablegen";
import { VORSCHAU_CLAIM, VORSCHAU_NAME, basisOrigin } from "@/lib/auffindbar";
import "./globals.css";

// Eine Familie für die ganze Anwendung: Display, Titel, Fliesstext und
// Label stammen aus demselben Entwurf, unterschieden werden sie nur über
// Gewicht, Versalien und Sperrung. Variabel geladen (kein weight-Array),
// weil die Skala von 400 bis 700 reicht.
const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

/* Die Vorschau beim Teilen (#673 AK 3, Entscheid 2) steht NUR hier: Name und
   Claim für jede Adresse, das Bild aus `opengraph-image.tsx`/`twitter-image.tsx`.
   Keine Seite setzt eigene `openGraph`-/`twitter`-Angaben (sie ersetzten
   diese ganz) — so zeigt auch ein privater Link keinen Namen im Chat.
   `metadataBase` macht Bild und canonical absolut (lib/auffindbar.ts). */
export const metadata: Metadata = {
  metadataBase: new URL(basisOrigin(process.env.APP_ORIGIN)),
  // Rückfall für Seiten ohne eigene Angaben, etwa /versionen (#673 AK 1):
  // KiFu als Werkzeug für Verein, Team und Training (Epic #668 EK 1).
  title: "KiFu – Verein, Team und Training im Kinder- und Juniorenfussball",
  description:
    "Vereinsverwaltung, Team und Abmeldungen, Trainings und ein KI-Assistent für den Kinder- und Juniorenfussball.",
  openGraph: {
    type: "website",
    siteName: VORSCHAU_NAME,
    title: VORSCHAU_NAME,
    description: VORSCHAU_CLAIM,
    locale: "de_CH",
  },
  twitter: { card: "summary_large_image", title: VORSCHAU_NAME, description: VORSCHAU_CLAIM },
};

/* Die Anwendung folgt dem Gerät, ohne dessen Angabe hell (Epic #563):
   `<meta name="color-scheme" content="light dark">` lässt den Browser seine
   Leinwand schon passend zeichnen, bevor das CSS geladen ist (kein Blitz im
   anderen Erscheinungsbild). Zwilling ist `color-scheme` auf `:root` in
   globals.css, das der Druck auf hell umstellt.
   `themeColor` färbt die Systemleiste der abgelegten App (#651) und des
   Browsers im Grund des Erscheinungsbilds; sie folgt dem Gerät. */
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [...THEME_FARBEN],
};

/* Wurzel: nur Dokument, Schrift, globale Styles und die Besucherstatistik —
   Letztere hier, damit auch die Anmelde-Seiten zählen. Das App-Chrome
   (Navigation, Team-Kontext, Snackbar-Platz) wohnt im Layout der
   Route-Gruppe `(app)`; die Anmelde-Seiten unter `(auth)` kommen ohne aus.

   Gezählt wird nur auf Production: Staging und Feature-Previews tragen vor
   allem Test- und Agenten-Verkehr, der das Monatskontingent des Hobby-Plans
   aufbrauchen und die Zahlen verfälschen würde. `VERCEL_ENV` ist lokal leer. */
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
        {children}
        {process.env.VERCEL_ENV === "production" && <Besucherstatistik />}
      </body>
    </html>
  );
}
