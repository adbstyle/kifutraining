"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { Button, Dialog, IconButton, KopierFeld, SectionMessage } from "@/components/ui";
import { AboAnleitung } from "@/components/team/AboAnleitung";
import { holeAboUeberLinkAktion } from "@/lib/actions/spieler-link";
import { ABO_TEXT } from "@/lib/spieler-abo";

/* Das Kalender-Abo am privaten Link (#507): Der Icon-Knopf rechts oben öffnet
   den Dialog und holt dabei die Abo-Adresse — dieselbe, solange sie gilt
   (AK 1, 5). Dazu, dass das Abo nur anzeigt und das Kalenderprogramm erst
   nach einer Weile nachzieht (AK 2, 3), und wie man sie übernimmt (AK 4).
   Kein Hinweis zum Datenschutz (PO-Entscheid 9). */
export function AboKnopf({ token }: { token: string }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [links, setLinks] = useState<{ url: string; webcal: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function holen() {
    setFehler(null);
    startTransition(async () => {
      const r = await holeAboUeberLinkAktion(token);
      if (r.ok) return setLinks({ url: r.url, webcal: r.webcal });
      // Ein inzwischen erneuerter Link: Die Seite lädt neu und sagt es.
      if (r.ungueltig) return router.refresh();
      setFehler(r.error);
    });
  }

  function oeffnen() {
    setOffen(true);
    if (!links) holen();
  }

  return (
    <>
      <IconButton icon={CalendarPlus} label="Im Kalender abonnieren" onClick={oeffnen} />
      <Dialog
        open={offen}
        onClose={() => setOffen(false)}
        title="Im Kalender abonnieren"
        actions={
          <Button variant="text" onClick={() => setOffen(false)}>
            Schliessen
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="type-body-medium text-on-surface-mittel">{ABO_TEXT.zeichen}</p>
          <SectionMessage>
            {ABO_TEXT.nurAnzeigen} {ABO_TEXT.verzoegerung}
          </SectionMessage>
          {fehler && (
            <SectionMessage
              appearance="error"
              actions={
                <Button variant="text" onClick={holen} disabled={pending}>
                  Nochmals versuchen
                </Button>
              }
            >
              {fehler}
            </SectionMessage>
          )}
          <KopierFeld label="Abo-Adresse" value={links?.url ?? "Wird geholt …"} disabled={!links} />
          {links && <AboAnleitung webcal={links.webcal} />}
        </div>
      </Dialog>
    </>
  );
}
