import type { Metadata } from "next";
import { FileQuestion } from "lucide-react";
import { ButtonLink, Leerzustand } from "@/components/ui";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { UEBUNGEN_PFAD } from "@/lib/navigation";
import { getUserImRequest } from "@/lib/supabase/server";

/* Eine Seite, die es nicht gibt — innerhalb der App, also mit Seitenleiste
   und Brotkrumen, damit der Weg zurück auf der Seite selbst steht. Greift bei
   `notFound()` und über `[...nichtGefunden]` auch bei unbekannten Adressen.
   Angemeldet führt der Weg zu den Übungen, ohne Anmeldung auf die
   Startseite (#670 AK 11). */
export const metadata: Metadata = { title: "Seite nicht gefunden - KiFu" };

export default async function NichtGefunden() {
  const user = await getUserImRequest();
  return (
    <Seitenrahmen breite="2xl" krumen={[{ label: "Seite nicht gefunden" }]}>
      <Leerzustand
        icon={FileQuestion}
        titel="Diese Seite gibt es nicht"
        ueberschrift="h1"
        aktion={
          user ? (
            <ButtonLink href={UEBUNGEN_PFAD} variant="link">
              Zu den Übungen
            </ButtonLink>
          ) : (
            <ButtonLink href="/" variant="link">
              Zur Startseite
            </ButtonLink>
          )
        }
      >
        Die Adresse ist falsch oder der Inhalt wurde entfernt.
      </Leerzustand>
    </Seitenrahmen>
  );
}
