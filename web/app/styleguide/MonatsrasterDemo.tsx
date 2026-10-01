import { Monatsraster } from "@/components/ui";

/* Das Monatsraster mit festen Beispieltagen (Oktober 2026, «heute» der 7.):
   zwei Einträge an einem Tag, einer mit anderer Farbe, eine leere Woche. Die
   Einträge sind hier blosse Beschriftungen — in der Anwendung sind es die
   Termine des Teams (`MonatsUeberblick`). */
const EINTRAEGE: Record<string, string[]> = {
  "2026-10-07": ["18:00 Passspiel"],
  "2026-10-08": ["18:00 Passspiel", "19:30 Noch kein Training"],
  "2026-10-14": ["18:00 Torschuss"],
  "2026-10-15": ["18:00 Ausgefallen"],
  "2026-10-28": ["18:00 Zeit fehlt"],
};

export function MonatsrasterDemo() {
  return (
    <Monatsraster
      monat="2026-10"
      heute="2026-10-07"
      label="Beispiel: Oktober 2026"
      leereWoche={(tage) => tage.every((d) => !EINTRAEGE[d])}
      renderTag={(tag) =>
        (EINTRAEGE[tag] ?? []).map((e) => (
          <p key={e} className="mt-1 rounded-plakette bg-elev-08 px-1 type-body-small text-on-surface">
            {e}
          </p>
        ))
      }
    />
  );
}
