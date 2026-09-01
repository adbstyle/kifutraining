"use client";

import { ChoiceChip, ChoiceChipGroup, SegmentedControl } from "@/components/ui";
import { einordnungenFuer, type Altersstufe } from "@/lib/altersstufe";

/** Wo eine Übung in ihrem Trainingsschema liegt (Story 2 AK 1, Story 3 AK 3/4).
 *
 *  Kinderfussball: die vier Trainingsteile in einer Segmentleiste — kurze
 *  Wörter, eine Ebene, fertig.
 *
 *  Juniorenfussball: zwei Ebenen. Oben der Trainingsteil als Segmentleiste,
 *  darunter seine Blöcke als Choice-Chips. Gewählt wird der Block; der
 *  Trainingsteil bleibt daneben stehen, damit die Zugehörigkeit sichtbar ist
 *  (AK 3) — das Manual selbst führt die Blöcke nie ohne ihren Teil. Chips statt
 *  Segmente, weil «Spielformen und unterstützende Übungen» in keiner
 *  Segmentleiste lesbar bleibt; sie umbrechen.
 *
 *  Ein Teil mit genau EINEM Block ist dabei keine zweite Ebene: Seine Chip-
 *  Reihe wäre eine Wahl ohne Alternative, und der Chip trüge denselben Namen
 *  wie das Segment darüber. Ihn zu wählen wählt darum unmittelbar seinen Block,
 *  Chips erscheinen bei ihm keine (Story #127).
 *
 *  Der Trainingsteil ist reine Anzeige-Navigation und wird nirgends
 *  gespeichert: gespeichert ist immer nur die Einordnung selbst. Beim
 *  Bearbeiten leitet der Aufrufer den Teil aus dem gespeicherten Block ab. */
export function EinordnungField({
  altersstufe,
  wert,
  teil,
  onTeilChange,
  onChange,
  error,
  supportingText,
}: {
  altersstufe: Altersstufe;
  /** Die gewählte Einordnung (Kinderfussball-Trainingsteil oder Junioren-Block). */
  wert: string;
  /** Nur im Juniorenfussball: der aufgeschlagene Trainingsteil. */
  teil: string;
  onTeilChange: (teil: string) => void;
  onChange: (einordnung: string) => void;
  error?: string;
  supportingText?: string;
}) {
  const gruppen = einordnungenFuer(altersstufe);
  const zweistufig = gruppen.some((g) => g.bloecke.length > 0);
  const offeneGruppe = gruppen.find((g) => g.teil === teil) ?? gruppen[0];
  // Die Chip-Reihe lohnt erst ab zwei Blöcken; darunter ist die Wahl bereits
  // mit dem Segment getroffen.
  const chipsSichtbar = zweistufig && offeneGruppe.bloecke.length > 1;

  return (
    <div>
      <p
        className={`type-label-small mb-2 ${error ? "text-error" : "text-on-surface-variant"}`}
      >
        {zweistufig ? "Trainingsteil und Block" : "Trainingsteil"}
      </p>
      <SegmentedControl
        ariaLabel="Trainingsteil"
        options={gruppen.map((g) => ({ value: g.teil, label: g.label }))}
        // Einstufig ist der Trainingsteil selbst die Einordnung.
        value={zweistufig ? offeneGruppe.teil : wert || null}
        onChange={(v) => {
          if (!zweistufig) return onChange(v);
          onTeilChange(v);
          // Einblockiger Teil: die Wahl ist mit dem Segment schon getroffen.
          const gruppe = gruppen.find((g) => g.teil === v);
          if (gruppe?.bloecke.length === 1) onChange(gruppe.bloecke[0].slug);
        }}
      />
      {chipsSichtbar && (
        <ChoiceChipGroup
          ariaLabel={`Block im Trainingsteil ${offeneGruppe.label}`}
          className="mt-3"
        >
          {offeneGruppe.bloecke.map((b, i) => (
            <ChoiceChip
              key={b.slug}
              selected={wert === b.slug}
              tabStop={i === 0 && !offeneGruppe.bloecke.some((x) => x.slug === wert)}
              onSelect={() => onChange(b.slug)}
            >
              {b.label}
            </ChoiceChip>
          ))}
        </ChoiceChipGroup>
      )}
      <p
        className={`type-body-small mt-1.5 ${error ? "text-error" : "text-on-surface-variant"}`}
      >
        {error ?? supportingText}
      </p>
    </div>
  );
}
