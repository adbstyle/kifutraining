import { cn } from "@/lib/cn";

export type FahrplanData = {
  offen_starten: string;
  ueben?: string[];
  wetteifern?: string | null;
};

/* Signatur-Komponente: der methodische Fahrplan (Offen starten → Üben →
   Wett-eifern) als nummerierte Sequenz. Leere Stufen (Altbestand) werden
   weggelassen, die Nummerierung bleibt an der Phase, nicht am Index. */
const STEPS = [
  { key: "offen_starten", num: "①", title: "Offen starten" },
  { key: "ueben", num: "②", title: "Üben" },
  { key: "wetteifern", num: "③", title: "Wett-eifern" },
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
    <div className={cn("flex flex-col", className)}>
      {present.map((s, i) => (
        <div key={s.key} className={i > 0 ? "mt-5 border-t border-outline-variant pt-5" : ""}>
          <p className="type-title-large flex items-center gap-2 text-primary">
            <span aria-hidden>{s.num}</span>
            {s.title}
          </p>
          {s.key === "ueben" ? (
            <ul className="type-body-medium mt-2 list-disc space-y-1 pl-5 text-on-surface-variant">
              {fahrplan.ueben!.map((u, j) => (
                <li key={j}>{u}</li>
              ))}
            </ul>
          ) : (
            <p className="type-body-medium mt-1 text-on-surface-variant">
              {s.key === "offen_starten" ? fahrplan.offen_starten : fahrplan.wetteifern}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
