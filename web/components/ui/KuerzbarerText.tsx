"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { textMitLinks } from "@/lib/text-links";
import { Button } from "./Button";
import { ExternerLink } from "./ExternerLink";

/* ── KuerzbarerText ───────────────────────────────────────────
   Ein längerer Freitext, gekürzt auf wenige Zeilen, mit «Ganz lesen» darunter
   (#556: das Info-Schreiben in der Karte «Probetraining» und am privaten
   Link). Neu, weil `Freitext` immer ganz steht und die Karte der Übung
   (`line-clamp-2`) nur kürzt, ohne aufzuklappen.

   Zeilenumbrüche stehen wie geschrieben (whitespace-pre-line). Webadressen
   werden zu externen Links (`ExternerLink`, öffnen ausserhalb von KiFu).
   «Ganz lesen» steht nur, wenn der Text wirklich länger ist — gemessen, nicht
   geschätzt; aufgeklappt heisst der Link «Weniger anzeigen». Der Link ist
   `variant="link"`: eine Handlung im Inhalt, kein Knopf (PO 2026-10-25).
   Alles läuft als React-Text — eingegebenes HTML wird nie ausgeführt. */
export function KuerzbarerText({
  text,
  zeilen = 3,
  className,
}: {
  text: string;
  /** Wie viele Zeilen gekürzt stehen (Vorgabe 3). */
  zeilen?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const [offen, setOffen] = useState(false);
  const [laenger, setLaenger] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
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
  }, [text, offen]);

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <p
        id={id}
        ref={ref}
        className={cn("max-w-full whitespace-pre-line break-words", !offen && KUERZUNG[zeilen])}
      >
        {textMitLinks(text).map((t, i) =>
          t.art === "link" ? (
            <ExternerLink key={i} href={t.href}>
              {t.text}
            </ExternerLink>
          ) : (
            t.text
          ),
        )}
      </p>
      {(laenger || offen) && (
        <Button variant="link" aria-expanded={offen} aria-controls={id} onClick={() => setOffen((o) => !o)}>
          {offen ? "Weniger anzeigen" : "Ganz lesen"}
        </Button>
      )}
    </div>
  );
}

const KUERZUNG = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4", 5: "line-clamp-5" } as const;
