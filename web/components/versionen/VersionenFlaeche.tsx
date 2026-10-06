"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Ziehgriff } from "@/components/ui/Ziehgriff";
import { cn } from "@/lib/cn";
import {
  VERZEICHNIS_MAX,
  VERZEICHNIS_MIN,
  VERZEICHNIS_VORGABE,
  begrenzeVerzeichnis,
  verzeichnisCookie,
} from "@/lib/verzeichnis";

/* «Versionen» ab `lg`: links das Verzeichnis, rechts die Texte, dazwischen
   der Ziehgriff. Die gezogene Breite merkt sich der Browser (Cookie, siehe
   lib/verzeichnis.ts). Schmal stehen nur die Texte. */
export function VersionenFlaeche({
  anfangsBreite,
  verzeichnis,
  children,
}: {
  anfangsBreite: number | null;
  verzeichnis: ReactNode;
  children: ReactNode;
}) {
  const [gespeichert, setzeGespeichert] = useState(anfangsBreite);
  const [ziehend, setZiehend] = useState<number | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const breite = ziehend ?? gespeichert ?? VERZEICHNIS_VORGABE;

  const setzen = (px: number | null) => {
    setzeGespeichert(px);
    document.cookie = verzeichnisCookie(px);
  };

  return (
    <div
      ref={flaeche}
      style={{ "--verzeichnis-breite": `${breite}px` } as CSSProperties}
      className={cn(
        "lg:grid lg:grid-cols-[var(--verzeichnis-breite)_0.75rem_minmax(0,1fr)] lg:gap-x-4",
        ziehend !== null && "cursor-col-resize select-none",
      )}
    >
      <div className="hidden min-w-0 lg:block">
        {verzeichnis}
      </div>
      <Ziehgriff
        name="Breite des Verzeichnisses"
        seite="links"
        min={VERZEICHNIS_MIN}
        max={VERZEICHNIS_MAX}
        aktuell={() => breite}
        begrenzen={(px) => begrenzeVerzeichnis(px, flaeche.current?.getBoundingClientRect().width ?? 0)}
        onZiehen={setZiehend}
        onSetzen={setzen}
        className="hidden lg:block"
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
