"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, IconButton, Meldung, Select, TextArea, TextField } from "@/components/ui";
import { farbSlugs, type FarbSlug } from "@/lib/diagramm";
import {
  FARBE_LABEL,
  MATERIAL_ARTEN,
  MATERIAL_KATALOG,
  MATERIAL_MENGE_MAX,
  istMaterialArt,
  normalisiere,
  postenText,
  type MaterialArt,
  type MaterialPosten,
} from "@/lib/material";

/** Eine Zeile im Formular. Die Menge bleibt Text, solange getippt wird — eine
 *  leere oder halbe Eingabe ist ein Zwischenstand, kein Fehler. */
export type MaterialZeile = {
  key: string;
  art: MaterialArt | "";
  farbe: FarbSlug | null;
  menge: string;
};

export function zeilenAus(liste: readonly MaterialPosten[]): MaterialZeile[] {
  return liste.map((p) => ({
    key: crypto.randomUUID(),
    art: p.art,
    farbe: p.farbe,
    menge: String(p.menge),
  }));
}

/** Das Problem einer Zeile — `null`, wenn sie sich speichern lässt. */
function zeilenProblem(z: MaterialZeile): string | null {
  if (!z.art) return "Bitte eine Art wählen.";
  const n = Number(z.menge);
  if (!z.menge || !Number.isInteger(n) || n < 1 || n > MATERIAL_MENGE_MAX)
    return `Menge 1 bis ${MATERIAL_MENGE_MAX}.`;
  return null;
}

/** Die Zeilen als Liste in Normalform — oder die Meldung, warum nicht. */
export function listeAusZeilen(
  zeilen: readonly MaterialZeile[],
): { ok: true; liste: MaterialPosten[] } | { ok: false; error: string } {
  if (zeilen.some((z) => zeilenProblem(z)))
    return { ok: false, error: "Bitte bei jedem Material Art und Menge (1 bis 999) angeben." };
  return {
    ok: true,
    liste: normalisiere(
      zeilen.map((z) => ({ art: z.art as MaterialArt, farbe: z.farbe, menge: Number(z.menge) })),
    ),
  };
}

/* Das Material einer Übung (Story #267): die Liste aus dem Diagramm-Vorrat
   nach Art, Farbe und Menge, darunter die freie Ergänzung.

   Kontrolliert — den Zustand hält das Übungsformular, das die Werte beim
   Absenden selbst in die FormData schreibt (state-gebundene Hidden-Inputs
   serialisiert die Server Action nicht zuverlässig).

   Den Vorschlag rechnet die Seite auf dem Server aus dem gespeicherten
   Diagramm; das Feld zeigt ihn nur an. `hinweis` ist der Rahmen um das
   Angebot — Text und Knöpfe bestimmt der Aufrufer. */
export function MaterialField({
  zeilen,
  onZeilenChange,
  ergaenzung,
  error,
  hinweis,
}: {
  zeilen: MaterialZeile[];
  onZeilenChange: (zeilen: MaterialZeile[]) => void;
  /** Die freie Ergänzung als Anfangswert — sie ist ein gewöhnliches,
   *  unkontrolliertes Textfeld mit dem Namen `material`. */
  ergaenzung: string[];
  error?: string;
  hinweis?: React.ReactNode;
}) {
  const legendeId = useId();

  function aendere(key: string, teil: Partial<MaterialZeile>) {
    onZeilenChange(zeilen.map((z) => (z.key === key ? { ...z, ...teil } : z)));
  }

  function waehleArt(key: string, art: string) {
    if (!istMaterialArt(art)) return;
    // Färbbares Material beginnt in der Farbe, die das Diagramm zeichnet;
    // anderes trägt keine Farbe.
    aendere(key, { art, farbe: MATERIAL_KATALOG[art].standardFarbe });
  }

  return (
    <div role="group" aria-labelledby={legendeId} className="flex flex-col gap-4">
      <p id={legendeId} className={`type-label-small ${error ? "text-error" : "text-on-surface-mittel"}`}>
        Material (optional)
      </p>

      {hinweis}

      {zeilen.length > 0 && (
        <ul className="flex flex-col gap-3">
          {zeilen.map((z) => {
            const farbig = z.art !== "" && MATERIAL_KATALOG[z.art].farbig;
            const problem = error ? zeilenProblem(z) : null;
            return (
              <li key={z.key} className="flex flex-wrap items-start gap-3">
                <Select
                  label="Art"
                  className="min-w-44 flex-1"
                  value={z.art}
                  onChange={(v) => waehleArt(z.key, v)}
                  placeholder="Art wählen …"
                  options={MATERIAL_ARTEN.map((a) => ({
                    value: a,
                    label: MATERIAL_KATALOG[a].einzahl,
                  }))}
                  error={!!problem && !z.art}
                />
                {farbig && (
                  <Select
                    label="Farbe"
                    className="w-32"
                    value={z.farbe ?? ""}
                    onChange={(v) => aendere(z.key, { farbe: v as FarbSlug })}
                    options={farbSlugs.map((f) => ({ value: f, label: FARBE_LABEL[f] }))}
                  />
                )}
                <TextField
                  label="Menge"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MATERIAL_MENGE_MAX}
                  className="w-24"
                  value={z.menge}
                  error={!!problem && !!z.art}
                  onChange={(e) => aendere(z.key, { menge: e.target.value })}
                />
                <IconButton
                  type="button"
                  icon={Trash2}
                  label={
                    z.art
                      ? `${MATERIAL_KATALOG[z.art].einzahl} entfernen`
                      : "Material entfernen"
                  }
                  className="mt-2"
                  onClick={() => onZeilenChange(zeilen.filter((x) => x.key !== z.key))}
                />
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="type-body-small text-error">{error}</p>}

      <div>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          onClick={() =>
            onZeilenChange([
              ...zeilen,
              { key: crypto.randomUUID(), art: "", farbe: null, menge: "1" },
            ])
          }
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
          Material hinzufügen
        </Button>
      </div>

      <TextArea
        label="Weiteres Material (optional, eines pro Zeile)"
        name="material"
        defaultValue={ergaenzung.join("\n")}
        supportingText="Was das Feld-Diagramm nicht kennt, etwa Pfeife oder Stoppuhr."
      />
    </div>
  );
}

/** Ein Material-Vorschlag als eine Zeile Text — «4 Pylonen, orange · 2 Minitore». */
export function vorschlagText(liste: readonly MaterialPosten[]): string {
  return liste.map(postenText).join(" · ");
}

/** Das Angebot, den Vorschlag des Diagramms zu übernehmen (Story #267 AK 1/2). */
export function VorschlagMeldung({
  vorschlag,
  onUebernehmen,
}: {
  vorschlag: readonly MaterialPosten[];
  onUebernehmen: () => void;
}) {
  return (
    <Meldung tone="erfolg" role="status">
      <p>Das Feld-Diagramm zeigt: {vorschlagText(vorschlag)}.</p>
      <div className="mt-2">
        <Button type="button" variant="text" size="sm" onClick={onUebernehmen}>
          Vorschlag übernehmen
        </Button>
      </div>
    </Meldung>
  );
}
