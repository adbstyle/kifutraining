"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { TextMitLinks } from "./TextMitLinks";
import { GegliederterText } from "./GegliederterText";

/* ── KuerzbarerText ───────────────────────────────────────────
   Ein längerer Freitext, gekürzt auf wenige Zeilen, mit «Ganz lesen» darunter
   (#556: das Info-Schreiben in der Karte «Schnuppertraining» und am privaten
   Link). Neu, weil `Freitext` immer ganz steht und die Karte der Übung
   (`line-clamp-2`) nur kürzt, ohne aufzuklappen.

   Zeilenumbrüche stehen wie geschrieben (whitespace-pre-line). Webadressen
   werden zu externen Links (`ExternerLink`, öffnen ausserhalb von KiFu).
   «Ganz lesen» steht nur, wenn der Text wirklich länger ist — gemessen, nicht
   geschätzt; aufgeklappt heisst der Link «Weniger anzeigen». Der Link ist
   `variant="link"`: eine Handlung im Inhalt, kein Knopf (PO 2026-10-25).
   Alles läuft als React-Text — eingegebenes HTML wird nie ausgeführt.

   `gegliedert` (#598, Infos zum Team): Der Text steht als `GegliederterText`;
   gekürzt wird dann auf die Höhe der Zeilen, nicht per line-clamp (der greift
   nur in einem einzelnen Absatz). */
export function KuerzbarerText({
  text,
  zeilen = 3,
  gegliedert = false,
  className,
}: {
  text: string;
  /** Mit Zwischentiteln, Listen und Hervorhebung (`GegliederterText`). */
  gegliedert?: boolean;
  /** Wie viele Zeilen gekürzt stehen (Vorgabe 3). */
  zeilen?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const [offen, setOffen] = useState(false);
  const [laenger, setLaenger] = useState(false);
  const ref = useRef<HTMLDivElement & HTMLParagraphElement>(null);
  const id = useId();

  // Gekürzt messen: Ist der Inhalt höher als die Fläche, braucht es den Link.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || offen) return;
    const messen = () => setLaenger(el.scrollHeight > el.clientHeight + 1);
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, offen, gegliedert]);

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      {gegliedert ? (
        <div
          id={id}
          ref={ref}
          className="max-w-full overflow-hidden"
          // 21 px: die Zeilenhöhe von type-body-medium, darin steht der Text.
          style={offen ? undefined : { maxHeight: `${zeilen * 21}px` }}
        >
          <GegliederterText text={text} />
        </div>
      ) : (
        <p
          id={id}
          ref={ref}
          className={cn("max-w-full whitespace-pre-line break-words", !offen && KUERZUNG[zeilen])}
        >
          <TextMitLinks text={text} />
        </p>
      )}
      {(laenger || offen) && (
        <Button variant="link" aria-expanded={offen} aria-controls={id} onClick={() => setOffen((o) => !o)}>
          {offen ? "Weniger anzeigen" : "Ganz lesen"}
        </Button>
      )}
    </div>
  );
}

const KUERZUNG = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4", 5: "line-clamp-5" } as const;
