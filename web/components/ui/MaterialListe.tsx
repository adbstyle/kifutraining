import { postenText, type MaterialPosten } from "@/lib/material";

/* Das Material einer Übung zum Lesen (Story #267 AK 7) — gegliedert: oben die
   gezählte Liste aus dem Diagramm-Vorrat, einer pro Zeile, darunter die freie
   Ergänzung, als «Weiteres» abgesetzt. Die Gliederung sagt, was gezählt und
   in einer Gesamtliste verrechnet wird und was nicht.

   Ein Baustein für Übungsseite, Training (Durchführen, Druck) und
   Gesamtliste — präsentational, ohne Hooks, darum auf dem Server wie im
   Client nutzbar. Rendert nichts, wenn es nichts zu zeigen gibt; ob die
   Eckdaten-Zeile überhaupt erscheint, entscheidet der Aufrufer
   (`hatMaterial`). */
export function MaterialListe({
  liste,
  ergaenzung,
}: {
  liste: readonly MaterialPosten[];
  ergaenzung: readonly string[];
}) {
  if (liste.length === 0 && ergaenzung.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {liste.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {liste.map((p) => (
            <li key={`${p.art}:${p.farbe ?? ""}`}>{postenText(p)}</li>
          ))}
        </ul>
      )}
      {ergaenzung.length > 0 && (
        <p>
          {liste.length > 0 && (
            <span className="type-label-small mr-2 text-on-surface-mittel">Weiteres</span>
          )}
          {ergaenzung.join(", ")}
        </p>
      )}
    </div>
  );
}
