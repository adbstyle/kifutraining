import { useId, type ReactElement } from "react";

/** Eine Gruppe: ihr Titel und ihre Zeilen (`<li>` mit eigenem `key`). */
export type ListenGruppe = {
  schluessel: string;
  titel: string;
  zeilen: readonly ReactElement[];
};

/* Eine Liste in Gruppen (#599): je Gruppe eine kleine Überschrift mit der
   Anzahl, etwa «Angemeldet · 5», darunter ihre Zeilen auf einer Fläche wie
   eine ungegliederte Liste. Neu, weil die Spieler:innen eines Termins nach
   ihrem Status getrennt stehen sollen; die Überschrift folgt den Gruppen im
   Reiter «Trainer:innen».

   - Die Reihenfolge der Gruppen ist die übergebene; eine leere Gruppe
     erscheint nicht.
   - Barrierefrei: Jede Gruppe ist ein Abschnitt, benannt nach ihrer
     Überschrift samt Anzahl. */
export function ListenGruppen({ gruppen }: { gruppen: readonly ListenGruppe[] }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      {gruppen
        .filter((g) => g.zeilen.length > 0)
        .map((g) => (
          <section key={g.schluessel} aria-labelledby={`${id}-${g.schluessel}`} className="flex flex-col gap-1.5">
            <h4 id={`${id}-${g.schluessel}`} className="type-label-small text-on-surface-mittel">
              {g.titel} · {g.zeilen.length}
            </h4>
            <ul className="divide-y divide-linie rounded-flaeche bg-elev-01">{g.zeilen}</ul>
          </section>
        ))}
    </div>
  );
}
