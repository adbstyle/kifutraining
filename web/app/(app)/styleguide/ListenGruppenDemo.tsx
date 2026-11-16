"use client";

import { useState } from "react";
import { ListenGruppen, LozengeAuswahl } from "@/components/ui";
import { MELDE_STATUS } from "@/lib/termin-status";
import { useFokusFolgt } from "@/lib/use-fokus-folgt";

type Status = "angemeldet" | "ohne" | "abgemeldet";

/* ListenGruppen wie im Reiter «Spieler:innen»: drei Spieler:innen in den
   Gruppen ihres Status. Ein Wechsel schiebt die Zeile sofort in die andere
   Gruppe; der Fokus folgt ihr. Leere Gruppen erscheinen nicht. */
export function ListenGruppenDemo() {
  const [status, setStatus] = useState<Record<string, Status>>({ Lea: "angemeldet", Mia: "ohne", Noah: "abgemeldet" });
  const fokusFolgt = useFokusFolgt(true);
  const zeile = (name: string) => {
    const s = MELDE_STATUS[status[name]];
    const ziele = (["angemeldet", "abgemeldet"] as const).filter((z) => z !== status[name]);
    return (
      <li key={name} data-fokus-ziel={name} className="flex min-h-12 items-center gap-3 px-4 py-1.5">
        <span className="min-w-0 flex-1 type-body-medium text-on-surface">{name} Keller</span>
        <LozengeAuswahl
          wort={s.wort}
          appearance={s.appearance}
          ariaLabel={`Status ${name} Keller: ${s.wort}`}
          wechsel={ziele.map((z) => ({
            handlung: z === "angemeldet" ? "Anmelden" : "Abmelden",
            ziel: MELDE_STATUS[z],
            onSelect: () => {
              fokusFolgt(name);
              setStatus((alt) => ({ ...alt, [name]: z }));
            },
          }))}
        />
      </li>
    );
  };
  return (
    <div className="max-w-md">
      <ListenGruppen
        gruppen={(["angemeldet", "ohne", "abgemeldet"] as const).map((g) => ({
          schluessel: g,
          titel: MELDE_STATUS[g].wort,
          zeilen: Object.keys(status)
            .filter((n) => status[n] === g)
            .map(zeile),
        }))}
      />
    </div>
  );
}
