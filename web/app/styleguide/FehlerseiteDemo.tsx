"use client";

import { useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, ButtonLink, Leerzustand } from "@/components/ui";

/** Zeigt die Fehler-Grenze (`app/error.tsx`) ausserhalb eines echten
 *  Fehlerfalls — auslösen liesse sie sich nur, indem man die Seite wirklich
 *  zum Absturz bringt. Der Knopf steht hier für `router.refresh()` + `reset()`
 *  und wartet stellvertretend kurz; Aufbau, Typo und die leise Fehler-ID sind
 *  dieselben wie im Ernstfall. */
export function FehlerseiteDemo() {
  const [laeuft, startTransition] = useTransition();

  function nochmalVersuchen() {
    startTransition(() => new Promise<void>((fertig) => setTimeout(fertig, 700)));
  }

  return (
    <Leerzustand
      icon={TriangleAlert}
      titel="Etwas ist schiefgelaufen"
      aktion={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={nochmalVersuchen} disabled={laeuft}>
            {laeuft ? "Wird geladen …" : "Nochmals versuchen"}
          </Button>
          <ButtonLink href="/styleguide" variant="text">
            Zu den Übungen
          </ButtonLink>
        </div>
      }
    >
      Die Seite konnte nicht geladen werden. Oft hilft ein zweiter Versuch —
      bleibt es dabei, probier es später noch einmal.
      <span className="type-label-small mt-3 block text-on-surface-tief">
        Fehler-ID 520437951
      </span>
    </Leerzustand>
  );
}
