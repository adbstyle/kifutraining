import { Monatsraster } from "@/components/ui";
import { TerminEintrag, type EintragZustand } from "@/components/team/TerminEintrag";

/* Das Monatsraster mit festen Beispieltagen (Oktober 2026, «heute» der 7.):
   alle Zustände eines Termineintrags, zwei Termine an einem Tag, ein Eintrag
   in der Randwoche (1. November, auf dem Grund) und eine leere Woche. In der
   Anwendung sind die Einträge die Termine des Teams (`MonatsUeberblick`). */
type Beispiel = { beginn: string | null; zustand: EintragZustand; name?: string };
const EINTRAEGE: Record<string, Beispiel[]> = {
  "2026-10-07": [{ beginn: "18:00", zustand: "training", name: "Passspiel" }],
  "2026-10-08": [
    { beginn: "18:00", zustand: "training", name: "Torschuss" },
    { beginn: "19:30", zustand: "noch-nicht" },
  ],
  "2026-10-14": [{ beginn: "18:00", zustand: "ohne" }],
  "2026-10-15": [{ beginn: "18:00", zustand: "ausgefallen" }],
  "2026-10-28": [{ beginn: null, zustand: "noch-nicht" }],
  "2026-11-01": [{ beginn: "10:00", zustand: "noch-nicht" }],
};

export function MonatsrasterDemo() {
  return (
    <Monatsraster
      monat="2026-10"
      heute="2026-10-07"
      label="Beispiel: Oktober 2026"
      leereWoche={(tage) => tage.every((d) => !EINTRAEGE[d])}
      renderTag={(tag) =>
        (EINTRAEGE[tag] ?? []).map((e, i) => (
          <TerminEintrag key={i} beginn={e.beginn} zustand={e.zustand} name={e.name} label={`${tag}, ${e.zustand}`} />
        ))
      }
    />
  );
}
