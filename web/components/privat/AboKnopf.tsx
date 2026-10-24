"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { Button, Dialog, IconButton, KopierFeld, SectionMessage } from "@/components/ui";
import { AboAnleitung } from "@/components/team/AboAnleitung";
import { holeAboUeberLinkAktion, widerrufeAboUeberLinkAktion } from "@/lib/actions/spieler-link";
import { ABO_TEXT } from "@/lib/spieler-abo";

/** Was der Dialog gerade zeigt: die Abo-Adresse, die Rückfrage vor dem
 *  Widerrufen oder dass es widerrufen ist. */
type Schritt = "adresse" | "rueckfrage" | "widerrufen";

/* Das Kalender-Abo am privaten Link (#507): Der Icon-Knopf rechts oben öffnet
   den Dialog und holt dabei die Abo-Adresse — dieselbe, solange sie gilt
   (AK 1, 5). Dazu, dass das Abo nur anzeigt und das Kalenderprogramm erst
   nach einer Weile nachzieht (AK 2, 3), und wie man sie übernimmt (AK 4).
   Kein Hinweis zum Datenschutz (PO-Entscheid 9).

   Widerrufen (#509) fragt im selben Dialog nach und sagt vorher, dass die
   Adresse danach für alle nichts mehr liefert (AK 2, 3); danach lässt sich
   gleich eine neue holen (AK 4). */
export function AboKnopf({ token }: { token: string }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [schritt, setSchritt] = useState<Schritt>("adresse");
  const [links, setLinks] = useState<{ url: string; webcal: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Ein Ergebnis der Datenebene: ein inzwischen erneuerter Link lädt die
   *  Seite neu, die es sagt; sonst steht der Fehler im Dialog. */
  function scheitern(r: { ungueltig: true } | { ungueltig?: false; error: string }) {
    if (r.ungueltig) router.refresh();
    else setFehler(r.error);
  }

  function holen() {
    setFehler(null);
    startTransition(async () => {
      const r = await holeAboUeberLinkAktion(token);
      if (!r.ok) return scheitern(r);
      setLinks({ url: r.url, webcal: r.webcal });
      setSchritt("adresse");
    });
  }

  function widerrufen() {
    setFehler(null);
    startTransition(async () => {
      const r = await widerrufeAboUeberLinkAktion(token);
      if (!r.ok) return scheitern(r);
      setLinks(null);
      setSchritt("widerrufen");
    });
  }

  function oeffnen() {
    setOffen(true);
    // Nach dem Widerrufen erst auf Wunsch eine neue — sonst entstünde sie
    // schon beim Wiederöffnen.
    if (!links && schritt === "adresse") holen();
  }

  function schliessen() {
    setOffen(false);
    setFehler(null);
    if (schritt === "rueckfrage") setSchritt("adresse");
  }

  const fehlerMeldung = fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>;

  return (
    <>
      <IconButton icon={CalendarPlus} label="Im Kalender abonnieren" onClick={oeffnen} />
      <Dialog
        open={offen}
        onClose={schliessen}
        title={schritt === "rueckfrage" ? "Abo widerrufen?" : "Im Kalender abonnieren"}
        actions={
          schritt === "rueckfrage" ? (
            <>
              <Button variant="outlined" onClick={() => setSchritt("adresse")} disabled={pending}>
                Abbrechen
              </Button>
              <Button variant="danger" onClick={widerrufen} disabled={pending}>
                Widerrufen
              </Button>
            </>
          ) : (
            <>
              {schritt === "adresse" && links && (
                <Button variant="text" onClick={() => setSchritt("rueckfrage")} disabled={pending}>
                  Abo widerrufen
                </Button>
              )}
              <Button variant="text" onClick={schliessen}>
                Schliessen
              </Button>
            </>
          )
        }
      >
        {schritt === "rueckfrage" ? (
          <div className="flex flex-col gap-4">
            <p>{ABO_TEXT.widerrufen}</p>
            {fehlerMeldung}
          </div>
        ) : schritt === "widerrufen" ? (
          <div className="flex flex-col gap-4">
            <SectionMessage appearance="success">{ABO_TEXT.widerrufenOk}</SectionMessage>
            {fehlerMeldung}
            <Button variant="outlined" className="self-start" onClick={holen} disabled={pending}>
              Neue Abo-Adresse holen
            </Button>
          </div>
        ) : (
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
        )}
      </Dialog>
    </>
  );
}
