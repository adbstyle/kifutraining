"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button, ButtonLink, Leerzustand } from "@/components/ui";

/* ── Fehler-Grenze innerhalb des Layouts ──────────────────────
   Fängt jeden Fehler unterhalb des Root-Layouts ab. Navigation und Team-
   Kontext bleiben stehen; ersetzt wird nur die Inhaltsspalte. Ohne diese
   Datei zeigte Next seine nackte Vorgabeseite — «Application error: a
   server-side exception has occurred» auf weissem Grund, ohne Weg zurück.

   WARUM `router.refresh()` VOR `reset()`: `reset()` tut in Next 15.5 nur
   `setState({ error: null })` — es holt KEINE Serverdaten neu. Jede Seite
   dieser Anwendung ist eine `async function` mit Datenbankzugriff, der Fehler
   sitzt also fast immer in der Server-Komponente. Ein blosses `reset()`
   liesse React denselben, bereits gescheiterten Payload erneut rendern: Der
   Knopf täte sichtbar nichts. `refresh()` erzwingt den echten Neuaufbau,
   `reset()` schaltet danach von der Fehleransicht zurück. Beides in EINER
   Transition, damit der Knopf so lange als arbeitend erkennbar bleibt.

   WARUM DER FEHLERCODE DASTEHT: Der Digest ist Nexts Kennzeichen für den
   zugehörigen Server-Log-Eintrag und das Einzige, womit sich ein gemeldeter
   Fehler später wiederfinden lässt. Er steht darum leise dabei — als Fussnote
   für den Support, nicht als zweite Fehlermeldung. */
export default function Fehlerseite({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [laeuft, startTransition] = useTransition();

  function nochmalVersuchen() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Leerzustand
        icon={TriangleAlert}
        titel="Etwas ist schiefgelaufen"
        aktion={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={nochmalVersuchen} disabled={laeuft}>
              {laeuft ? "Wird geladen …" : "Nochmals versuchen"}
            </Button>
            <ButtonLink href="/" variant="text">
              Zu den Übungen
            </ButtonLink>
          </div>
        }
      >
        Die Seite konnte nicht geladen werden. Oft hilft ein zweiter Versuch —
        bleibt es dabei, probier es später noch einmal.
        {error.digest && (
          <span className="type-label-small mt-3 block text-on-surface-tief">
            Fehler-ID {error.digest}
          </span>
        )}
      </Leerzustand>
    </main>
  );
}
