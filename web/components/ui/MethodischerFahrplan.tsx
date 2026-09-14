import { cn } from "@/lib/cn";

export type FahrplanData = {
  offen_starten: string;
  ueben?: string[];
  wetteifern?: string | null;
};

/* Signatur-Komponente: der methodische Fahrplan (Offen starten → Üben →
   Wetteifern) als Folge dreier Stufen. Leere Stufen (Altbestand) werden
   weggelassen.

   Die Stufe beschriftet, der Ablauftext trägt: darum steht der Stufenname
   klein (type-title-small) und der Text darunter in type-body-large — er
   ist das, was auf dem Platz gelesen wird, und damit das Grösste im Block.
   Getrennt wird durch Abstand, nicht durch Linien.

   Die Reihenfolge stand früher als ①②③ vor dem Stufennamen. Sichtbar
   trägt sie jetzt allein die Position, darum die <ol>: im Druck und am
   Screenreader bleibt die Folge ausgesprochen, ohne dass eine Ziffer
   mitspricht. Das `role="list"` ist dabei kein Pleonasmus — WebKit
   nimmt einer Liste mit `list-style: none` die Listen-Semantik, und
   VoiceOver sagte die Stufenfolge sonst gar nicht mehr an. */
const STEPS = [
  { key: "offen_starten", title: "Offen starten" },
  { key: "ueben", title: "Üben" },
  { key: "wetteifern", title: "Wetteifern" },
] as const;

export function MethodischerFahrplan({
  fahrplan,
  className,
}: {
  fahrplan: FahrplanData;
  className?: string;
}) {
  const present = STEPS.filter((s) => {
    if (s.key === "offen_starten") return Boolean(fahrplan.offen_starten);
    if (s.key === "ueben") return (fahrplan.ueben?.length ?? 0) > 0;
    return Boolean(fahrplan.wetteifern);
  });

  return (
    <ol role="list" className={cn("flex list-none flex-col gap-6", className)}>
      {present.map((s) => (
        <li key={s.key}>
          <p className="type-title-small text-on-surface">{s.title}</p>
          {s.key === "ueben" ? (
            <ul className="type-body-large mt-1.5 list-disc space-y-1 pl-5 text-on-surface">
              {fahrplan.ueben!.map((u, j) => (
                <li key={j}>{u}</li>
              ))}
            </ul>
          ) : (
            <p className="type-body-large mt-1.5 text-on-surface">
              {s.key === "offen_starten" ? fahrplan.offen_starten : fahrplan.wetteifern}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
