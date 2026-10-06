import { Sparkles } from "lucide-react";
import { ButtonLink, SectionMessage } from "@/components/ui";

/* Hinweis für Besucher ohne Konto am Fuss der öffentlichen Trainings-Seiten
   (Übersicht und Ansicht): was ein Konto bringt, und der Weg dorthin. Eine
   Section Message mit Aktion, weil sie eine Antwort anbietet — dieselbe
   Anatomie wie jede andere Meldung im Fluss der Seite (Styleguide 22). */
export function AnmeldeHinweis({ className }: { className?: string }) {
  return (
    <SectionMessage
      icon={Sparkles}
      className={className}
      actions={
        <ButtonLink href="/login" variant="text">
          Anmelden
        </ButtonLink>
      }
    >
      Mit einem Konto kannst du eigene Trainings erstellen und verwalten.
    </SectionMessage>
  );
}
