"use client";

import { useState } from "react";
import { Button, Dialog, FilterChip, Select } from "@/components/ui";
import { EinordnungField } from "@/components/exercise/EinordnungField";
import {
  altersstufe as altersstufeLabels,
  hauptteilkategorie as hkatLabels,
} from "@/lib/vocab";
import { kategorieStufe } from "@/lib/labels";
import {
  andereAltersstufe,
  einordnungenFuer,
  kategorienFuer,
  teilDerEinordnung,
  traegtHauptteilkategorie,
  ueberfuehrungsVorschlag,
  type Altersstufe,
} from "@/lib/altersstufe";

/** Was der Trainer im Dialog entschieden hat. */
export type Umwandlung = {
  altersstufe: Altersstufe;
  einordnung: string;
  hauptteilkategorie: string | null;
  kategorien: string[];
};

/**
 * Eine eigene Übung in die andere Altersstufe überführen (Story 4, Epic
 * Übungswelten).
 *
 * Der Dialog holt genau das, was die Zielstufe nicht aus der bisherigen
 * ableiten kann (AK 4): die Einordnung — vorbelegt aus der Abbildungsregel,
 * soweit sie eine Entsprechung kennt (PC 3) — und die Alterskategorien, die
 * beide Stufen überschneidungsfrei führen. Im Kinderfussball-Hauptteil kommt
 * die dort zwingende Hauptteilkategorie dazu.
 *
 * Bewusst OHNE Aufstellung, welche Angaben bleiben, überführt werden oder
 * wegfallen: ein Satz zur Tragweite, mehr nicht (PO-Entscheid 2026-08-30,
 * Out of Scope 7). Bestätigen schreibt nichts — die Umwandlung wird im
 * Formular vorgemerkt und erst mit dem Speichern wirksam; abbrechen lässt die
 * Übung unverändert (AK 3, PC 5).
 */
export function UmwandelnDialog({
  von,
  einordnung,
  hauptteilkategorie,
  onClose,
  onConfirm,
}: {
  /** Die Altersstufe, in der die Übung heute liegt. */
  von: Altersstufe;
  /** Ihre heutige Einordnung — Ausgangspunkt der Abbildungsregel. */
  einordnung: string;
  hauptteilkategorie: string | null;
  onClose: () => void;
  onConfirm: (u: Umwandlung) => void;
}) {
  const ziel = andereAltersstufe(von);
  const [vorschlag] = useState(() =>
    ueberfuehrungsVorschlag(von, einordnung, hauptteilkategorie),
  );

  const [teil, setTeil] = useState(vorschlag?.einordnung ?? "");
  // Nur Anzeige-Navigation im Juniorenschema (siehe EinordnungField).
  const [offenerTeil, setOffenerTeil] = useState(() =>
    teilDerEinordnung(ziel, vorschlag?.einordnung ?? ""),
  );
  const [hkat, setHkat] = useState(vorschlag?.hauptteilkategorie ?? "");
  // Die Alterskategorien beginnen leer: G–E und D–A sind getrennte Mengen,
  // aus der bisherigen Wahl lässt sich keine übertragen.
  const [kat, setKat] = useState<string[]>([]);
  const [fehler, setFehler] = useState<{
    einordnung?: string;
    hauptteilkategorie?: string;
    kat?: string;
  }>({});

  const zeigtHkat = traegtHauptteilkategorie(ziel, teil);

  function wechsleTeil(neuerTeil: string) {
    const gruppe = einordnungenFuer(ziel).find((g) => g.teil === neuerTeil);
    if (!gruppe) return;
    if (gruppe.bloecke.length === 0) return setTeil(neuerTeil);
    if (gruppe.bloecke.some((b) => b.slug === teil)) return setOffenerTeil(neuerTeil);
    setOffenerTeil(neuerTeil);
    setTeil(gruppe.bloecke[0].slug);
  }

  function bestaetigen() {
    const neu: typeof fehler = {};
    if (!teil) neu.einordnung = "Bitte eine Einordnung wählen.";
    if (zeigtHkat && !hkat) neu.hauptteilkategorie = "Bitte eine Hauptteilkategorie wählen.";
    if (kat.length === 0) neu.kat = "Bitte mindestens eine Alterskategorie wählen.";
    setFehler(neu);
    if (Object.keys(neu).length > 0) return;
    onConfirm({
      altersstufe: ziel,
      einordnung: teil,
      hauptteilkategorie: zeigtHkat ? hkat : null,
      kategorien: kat,
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Übung in den ${altersstufeLabels[ziel]} überführen?`}
      actions={
        // `type="button"` ist hier zwingend: Der Dialog liegt im Übungs-
        // Formular, und ein Button ohne Typ ist ein Submit — er würde die Übung
        // speichern, statt den Dialog zu bedienen.
        <>
          <Button type="button" variant="text" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="button" variant="filled" onClick={bestaetigen}>
            Überführen
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p>
          Die Übung verlässt den {altersstufeLabels[von]}; Angaben, die es im{" "}
          {altersstufeLabels[ziel]} nicht gibt, fallen weg.
        </p>

        <EinordnungField
          altersstufe={ziel}
          wert={teil}
          teil={offenerTeil}
          onTeilChange={wechsleTeil}
          onChange={setTeil}
          error={fehler.einordnung}
          supportingText={
            vorschlag
              ? "Vorgeschlagen aus der bisherigen Einordnung — du kannst anders wählen."
              : "Für die bisherige Einordnung gibt es hier keine Entsprechung."
          }
        />

        {zeigtHkat && (
          <Select
            label="Hauptteilkategorie"
            value={hkat}
            onChange={setHkat}
            options={[
              { value: "", label: "— Kategorie wählen —" },
              ...(Object.keys(hkatLabels) as (keyof typeof hkatLabels)[]).map((k) => ({
                value: k,
                label: hkatLabels[k],
              })),
            ]}
            supportingText={fehler.hauptteilkategorie ?? "Der Trainingsinhalt des Hauptteils."}
            error={!!fehler.hauptteilkategorie}
          />
        )}

        <div>
          <p
            className={`type-label-small mb-2 ${fehler.kat ? "text-error" : "text-on-surface-variant"}`}
          >
            Alterskategorie
          </p>
          <div className="flex flex-wrap gap-2">
            {kategorienFuer(ziel).map((k) => (
              <FilterChip
                key={k}
                selected={kat.includes(k)}
                onClick={() =>
                  setKat(kat.includes(k) ? kat.filter((x) => x !== k) : [...kat, k])
                }
              >
                <span title={kategorieStufe[k as keyof typeof kategorieStufe]}>{k}</span>
              </FilterChip>
            ))}
          </div>
          <p
            className={`type-body-small mt-1.5 ${fehler.kat ? "text-error" : "text-on-surface-variant"}`}
          >
            {fehler.kat ?? "Mindestens eine Kategorie dieser Altersstufe."}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
