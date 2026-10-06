import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Übungen & Trainings für Kinder- und Juniorenfussball",
  description:
    "Übungen durchsuchen und filtern sowie strukturierte Trainings zusammenstellen - nach den SFV-Trainingsschemata für Kinderfussball und Juniorenfussball.",
};

/* Die Anwendung ist dunkel: `<meta name="color-scheme" content="dark">` lässt
   den Browser seine Leinwand und eigenen Bedienteile dunkel zeichnen, noch
   bevor das CSS geladen ist (kein heller Blitz). Zwilling ist `color-scheme`
   auf `:root` in globals.css, das der Druck auf hell umstellt. */
export const viewport: Viewport = {
  colorScheme: "dark",
};

/* Wurzel: nur Dokument, Schrift und globale Styles. Das App-Chrome
   (Navigation, Team-Kontext, Snackbar-Platz) wohnt im Layout der
   Route-Gruppe `(app)`; die Anmelde-Seiten unter `(auth)` kommen ohne aus. */
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
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
