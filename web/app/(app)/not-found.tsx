import { FileQuestion } from "lucide-react";
import { ButtonLink, Leerzustand } from "@/components/ui";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";

/* Eine Seite, die es nicht gibt — innerhalb der App, also mit Seitenleiste
   und Brotkrumen, damit der Weg zurück auf der Seite selbst steht. Greift bei
   `notFound()` und über `[...nichtGefunden]` auch bei unbekannten Adressen. */
export default function NichtGefunden() {
  return (
    <Seitenrahmen breite="2xl" krumen={[{ label: "Seite nicht gefunden" }]}>
      <Leerzustand
        icon={FileQuestion}
        titel="Diese Seite gibt es nicht"
        aktion={
          <ButtonLink href="/" variant="tonal">
            Zu den Übungen
          </ButtonLink>
        }
      >
        Die Adresse ist falsch oder der Inhalt wurde entfernt.
      </Leerzustand>
    </Seitenrahmen>
  );
}
