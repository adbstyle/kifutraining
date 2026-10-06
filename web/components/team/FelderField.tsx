"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, IconButton, Select, TextField, feldNameKlasse } from "@/components/ui";
import { SPIELFELD_MAX, SPIELFELD_MIN } from "@/lib/feldmass";
import { zahlOderNull } from "@/lib/termin";
import {
  TORARTEN,
  TORART_LABEL,
  UNTERGRUENDE,
  UNTERGRUND_LABEL,
  istUntergrund,
  type FeldTeil,
  type Felder,
  type FelderProblem,
  type Torart,
  type Untergrund,
} from "@/lib/termin-felder";

/** Ein Feld im Formular. Die Zahlen bleiben Text, solange getippt wird — leer
 *  heisst unbekannt, ein halber Wert ist ein Zwischenstand, kein Fehler. */
export type FeldZeile = {
  key: string;
  laenge: string;
  breite: string;
  tore: Record<Torart, string>;
  untergrund: Untergrund | "";
};

const text = (n: number | null) => (n === null ? "" : String(n));

/* Feste Hinweise je Angabe — sie stehen hinter dem ⓘ des jeweiligen Felds
   (Styleguide, Formularfelder › Hinweise), nicht als Sammelhinweis über der
   Gruppe. Der Untergrund braucht keinen: «Unbekannt» ist dort eine Wahl. */
const MASS_HINWEIS = (seite: "Länge" | "Breite") =>
  `${seite} der Fläche, die euch zur Verfügung steht, in ganzen Metern. Leer heisst unbekannt.`;
const TORE_HINWEIS = (torart: string) =>
  `Wie viele ${torart} auf diesem Feld stehen. Leer heisst unbekannt, 0 heisst keine.`;

export function zeilenAusFeldern(felder: Felder | null | undefined): FeldZeile[] {
  return (felder ?? []).map((f) => ({
    key: crypto.randomUUID(),
    laenge: text(f.laenge_m),
    breite: text(f.breite_m),
    tore: { minitor: text(f.tore.minitor), tor_5m: text(f.tore.tor_5m), tor_7m: text(f.tore.tor_7m) },
    untergrund: f.untergrund ?? "",
  }));
}

/** Die Zeilen in der gespeicherten Form; keine Zeile heisst «ohne Felder»
 *  (`null`). Leer heisst unbekannt, eine ungültige Zahl bleibt stehen
 *  (`zahlOderNull`) — geprüft wird mit `felderProblem` (lib/termin-felder.ts),
 *  derselben Regel wie im Fachkern, die sie an der richtigen Stelle meldet. */
export function felderAusZeilen(zeilen: readonly FeldZeile[]): Felder | null {
  if (zeilen.length === 0) return null;
  return zeilen.map((z) => ({
    laenge_m: zahlOderNull(z.laenge),
    breite_m: zahlOderNull(z.breite),
    tore: {
      minitor: zahlOderNull(z.tore.minitor),
      tor_5m: zahlOderNull(z.tore.tor_5m),
      tor_7m: zahlOderNull(z.tore.tor_7m),
    },
    untergrund: z.untergrund === "" ? null : z.untergrund,
  }));
}

const neueZeile = (): FeldZeile => ({
  key: crypto.randomUUID(),
  laenge: "",
  breite: "",
  tore: { minitor: "", tor_5m: "", tor_7m: "" },
  untergrund: "",
});

/** «Unbekannt» als Wahl, nicht als leeres Feld: Unbekannt ist hier eine
 *  Aussage, die der Assistent liest (#388 PO 5), und nur so lässt sich ein
 *  gewählter Untergrund wieder zurücknehmen. */
const UNTERGRUND_OPTIONEN = [
  { value: "", label: "Unbekannt" },
  ...UNTERGRUENDE.map((u) => ({ value: u, label: UNTERGRUND_LABEL[u] })),
];

/* Die Felder des Platzes eines Termins (Story #389): je Feld Länge und Breite
   der verfügbaren Fläche, die Tore je Torart und der Untergrund; «Feld
   hinzufügen» für ein weiteres, getrenntes Feld. Gebaut wie das MaterialField
   (kein Repeat-Baustein im Kit): je Feld ein umrandeter Block aus TextField,
   Select und IconButton.

   Alle Felder stehen untereinander, jedes mit eigenem Namen (PO
   2026-10-04, wie die Spielfeldgrösse einer Übung): Länge über Breite, die
   drei Torarten untereinander. Jedes Feld ist eine Gruppe, benannt nach
   seinem Titel «Feld N».

   Kontrolliert — die Zeilen hält der Dialog (`usePlatzAngaben`). `problem`
   ist das Ergebnis von `felderProblem` auf `felderAusZeilen(zeilen)`: Rot
   wird genau die Angabe, die nicht stimmt; bei Länge und Breite beide, denn
   sie gelten als Paar. */
export function FelderField({
  zeilen,
  onZeilenChange,
  problem,
  disabled,
}: {
  zeilen: FeldZeile[];
  onZeilenChange: (zeilen: FeldZeile[]) => void;
  problem?: FelderProblem | null;
  disabled?: boolean;
}) {
  const legendeId = useId();
  const titelId = (key: string) => `${legendeId}-${key}`;

  function aendere(key: string, teil: Partial<FeldZeile>) {
    onZeilenChange(zeilen.map((z) => (z.key === key ? { ...z, ...teil } : z)));
  }

  /** Der Fehler an einer Angabe dieser Zeile — der Satz steht unter ihr. */
  const fehlerAn = (index: number, ...teile: FeldTeil[]) =>
    problem && problem.index === index && problem.teil !== null && teile.includes(problem.teil) ? problem.text : undefined;
  const masseFehler = (index: number) => fehlerAn(index, "laenge_m", "breite_m");

  return (
    <div role="group" aria-labelledby={legendeId} className="flex flex-col gap-3">
      <p id={legendeId} className={feldNameKlasse(problem?.index === null)}>
        Felder (optional)
      </p>

      {zeilen.length > 0 && (
        <ul className="flex flex-col gap-3">
          {zeilen.map((z, i) => {
            const ganzesFeld = problem?.index === i && problem.teil === null ? problem.text : undefined;
            return (
              <li key={z.key} role="group" aria-labelledby={titelId(z.key)} className="rounded-flaeche border border-linie p-3">
                <div className="flex items-center justify-between gap-2">
                  <p id={titelId(z.key)} className="type-title-small text-on-surface">Feld {i + 1}</p>
                  <IconButton
                    type="button"
                    icon={Trash2}
                    label={`Feld ${i + 1} entfernen`}
                    disabled={disabled}
                    onClick={() => onZeilenChange(zeilen.filter((x) => x.key !== z.key))}
                  />
                </div>
                <div className="mt-2 flex flex-col gap-3">
                  <TextField
                    label="Länge (m)"
                    info={MASS_HINWEIS("Länge")}
                    type="number"
                    inputMode="numeric"
                    min={SPIELFELD_MIN}
                    max={SPIELFELD_MAX}
                    value={z.laenge}
                    disabled={disabled}
                    error={!!masseFehler(i)}
                    onChange={(e) => aendere(z.key, { laenge: e.target.value })}
                  />
                  <TextField
                    label="Breite (m)"
                    info={MASS_HINWEIS("Breite")}
                    type="number"
                    inputMode="numeric"
                    min={SPIELFELD_MIN}
                    max={SPIELFELD_MAX}
                    value={z.breite}
                    disabled={disabled}
                    error={!!masseFehler(i)}
                    supportingText={masseFehler(i)}
                    onChange={(e) => aendere(z.key, { breite: e.target.value })}
                  />
                  {TORARTEN.map((art) => (
                    <TextField
                      key={art}
                      label={TORART_LABEL[art]}
                      info={TORE_HINWEIS(TORART_LABEL[art])}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={z.tore[art]}
                      disabled={disabled}
                      error={!!fehlerAn(i, `tore.${art}`)}
                      supportingText={fehlerAn(i, `tore.${art}`)}
                      onChange={(e) => aendere(z.key, { tore: { ...z.tore, [art]: e.target.value } })}
                    />
                  ))}
                  <Select
                    label="Untergrund"
                    value={z.untergrund}
                    options={UNTERGRUND_OPTIONEN}
                    disabled={disabled}
                    error={!!fehlerAn(i, "untergrund")}
                    supportingText={fehlerAn(i, "untergrund")}
                    onChange={(v) => aendere(z.key, { untergrund: istUntergrund(v) ? v : "" })}
                  />
                  {ganzesFeld && <p className="type-body-small px-3.5 text-error">{ganzesFeld}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {problem?.index === null && <p className="type-body-small px-3.5 text-error">{problem.text}</p>}

      <div>
        <Button type="button" variant="quiet" disabled={disabled} onClick={() => onZeilenChange([...zeilen, neueZeile()])}>
          <Plus size={18} strokeWidth={2} aria-hidden />
          Feld hinzufügen
        </Button>
      </div>
    </div>
  );
}
