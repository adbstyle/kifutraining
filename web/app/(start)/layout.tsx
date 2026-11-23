import type { Viewport } from "next";
import { FigurenSprite } from "@/components/diagramm/figur";
import { StartRahmen } from "@/components/start/StartRahmen";
import { GRUND_HELL } from "@/lib/farben";
import { getUserImRequest } from "@/lib/supabase/server";

/* Die Startseite (#670) und ihre Nachbarn: ohne Seitenleiste, mit eigener
   Kopf- und Fusszeile (Entscheid 1). Immer hell (AK 13, Entscheid 3), auch
   für Angemeldete über «/startseite»: die Marke für globals.css und die
   Systemleiste im hellen Grund. Kein Manifest «KiFu» (#651): Die Seite ist
   nicht die App; die abgelegte App startet auf «/» und geht von dort in den
   Arbeitsbereich (#671). */
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: GRUND_HELL,
};

export default async function StartLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserImRequest();
  return (
    <StartRahmen angemeldet={user !== null}>
      {/* Die Figurteile der Feld-Diagramme auf den Übungskarten, einmal pro Seite. */}
      <FigurenSprite />
      {children}
    </StartRahmen>
  );
}
