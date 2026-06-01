import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kinderfussball Übungen & Trainingspläne",
  description:
    "Kinderfussball-Übungen durchsuchen und filtern sowie strukturierte Trainingspläne zusammenstellen.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
