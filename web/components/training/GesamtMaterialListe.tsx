import { MaterialListe } from "@/components/ui";
import { gesamtMaterial, type MaterialFassung } from "@/lib/material-gesamt";
import { cn } from "@/lib/cn";

/* Die Gesamt-Materialliste eines Trainings (Story #271): was das Training zu
   einem Zeitpunkt höchstens gleichzeitig braucht, darunter die freien
   Ergänzungen je Übung. Eine Quelle für Zusammenstellen, Durchführen und
   Druck — präsentational, ohne Hooks, darum auf dem Server wie im Client.

   Führt das Training mehrere Varianten des Hauptteils, reicht die Liste für
   jede von ihnen; das sagt der Untertitel, denn die Ansicht zeigt sonst nur
   eine Variante. Rendert nichts, wenn keine Übung Material trägt. */
export function GesamtMaterialListe({
  exercises,
  varianten,
  className,
}: {
  exercises: readonly MaterialFassung[];
  varianten: readonly { id: string }[];
  className?: string;
}) {
  const { liste, ergaenzungen } = gesamtMaterial(exercises, varianten);
  if (liste.length === 0 && ergaenzungen.length === 0) return null;
  return (
    <section aria-labelledby="gesamt-material" className={cn("break-inside-avoid", className)}>
      <h2 id="gesamt-material" className="type-title-small text-on-surface">
        Material fürs Training
      </h2>
      <p className="type-body-small mt-0.5 text-on-surface-mittel">
        Höchster gleichzeitiger Bedarf
        {varianten.length > 1 ? " — reicht für jede Variante des Hauptteils" : ""}.
      </p>
      {liste.length > 0 && (
        <div className="type-body-medium mt-2 text-on-surface">
          <MaterialListe liste={liste} ergaenzung={[]} />
        </div>
      )}
      {ergaenzungen.length > 0 && (
        <div className="mt-2">
          <p className="type-label-small text-on-surface-mittel">Weiteres</p>
          <ul className="type-body-medium mt-0.5 flex flex-col gap-0.5 text-on-surface">
            {ergaenzungen.map((e) => (
              <li key={e.fassungId}>
                {e.texte.join(", ")}{" "}
                <span className="text-on-surface-mittel">({e.uebung})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
