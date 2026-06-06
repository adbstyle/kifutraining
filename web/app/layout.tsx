import type { Metadata } from "next";
import { Anton, Source_Serif_4, Space_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/layout/AppNav";

// Display: kondensierte Plakat-Grotesk (Taktiktafel-Headlines)
const display = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});
// Body: humanistische Serif — ruhig und gut lesbar
const body = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source",
  display: "swap",
});
// Mono: taktische Labels, Zahlen, Dauern
const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kinderfussball Übungen & Trainingspläne",
  description:
    "Kinderfussball-Übungen durchsuchen und filtern sowie strukturierte Trainingspläne zusammenstellen.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de-CH">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen antialiased`}
      >
        <div className="flex min-h-dvh">
          <AppNav />
          {/* Inhaltsspalte: füllt den Rest neben der Rail; unten Platz für die
              Bottom-Nav auf Mobil (md:pb-0). Seiten bringen ihren eigenen
              <main>-Container mit eigener max-width mit. */}
          <div className="min-w-0 flex-1 pb-24 md:pb-0">{children}</div>
        </div>
      </body>
    </html>
  );
}
