import type { Metadata } from "next";
import { appName } from "@/lib/app-ablegen";
import { ladeLinkAnsicht } from "@/lib/privater-link";

/* Der private Link als App (#650): Termine und Infos verweisen auf das
   Manifest dieses Links, das die abgelegte App zu den Terminen dieser
   Spieler:in führt (AK 1, 3, 5). Das iPhone nimmt den Namen unter dem Symbol
   aus `apple-mobile-web-app-title` (AK 4) — der Titel der Seite bleibt fest
   und ohne Namen, er erscheint in der Vorschau eines Chats.

   `ladeLinkAnsicht` ist je Anfrage zwischengespeichert: Die Seite liest
   dieselbe Antwort, keine zweite Abfrage. Ein ungültiger Link bekommt kein
   Manifest. */
export async function generateMetadata({ params }: { params: Promise<{ privaterLink: string }> }): Promise<Metadata> {
  const { privaterLink } = await params;
  const ansicht = await ladeLinkAnsicht(privaterLink);
  if (!ansicht.gueltig) return {};
  return {
    manifest: `/abmelden/${privaterLink}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: appName(ansicht.spieler.vorname, ansicht.verein), statusBarStyle: "default" },
  };
}

export default function LinkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
