"use client";

import { Info } from "lucide-react";
import { Select } from "@/components/ui";
import { einordnungenFuer, type Altersstufe } from "@/lib/altersstufe";

/** Wo eine Übung in ihrem Trainingsschema liegt (Story 2 AK 1, Story 3 AK 3/4).
 *
 *  Eine Einfachauswahl mit Panel (Styleguide 16) — dieselbe Form, in der die
 *  Maske inzwischen jede Einfachauswahl führt (PO-Vorgabe 2026-09-13). Sie lag
 *  eine Zeit lang offen (Segmentleiste, im Juniorenschema mit einer zweiten
 *  Reihe Chips), weil die Einordnung über die halbe Maske darunter entscheidet
 *  und das sichtbar sein sollte.
 *
 *  Kinderfussball: die vier Trainingsteile als flache Liste — dort ist der
 *  Trainingsteil selbst die Einordnung.
 *
 *  Juniorenfussball: alle sieben Blöcke in EINER Liste, der Trainingsteil als
 *  nicht wählbare Kopfzeile darüber (`group`). Gewählt wird der Block; der
 *  Trainingsteil bleibt als Kopfzeile daneben stehen, damit die Zugehörigkeit
 *  sichtbar ist (AK 3) — das Manual selbst führt die Blöcke nie ohne ihren
 *  Teil. Weil `Select` die Kopfzeile positional setzt, müssen die Optionen
 *  gruppensortiert kommen; `einordnungenFuer()` liefert sie so.
 *
 *  Der Trainingsteil ist damit reine Beschriftung und wird nirgends
 *  gespeichert: gespeichert ist immer nur die Einordnung selbst. */
export function EinordnungField({
  altersstufe,
  wert,
  onChange,
  error,
  supportingText,
  hinweis,
}: {
  altersstufe: Altersstufe;
  /** Die gewählte Einordnung (Kinderfussball-Trainingsteil oder Junioren-Block). */
  wert: string;
  onChange: (einordnung: string) => void;
  error?: string;
  supportingText?: string;
  /** Was die gewählte Einordnung an bereits Erfasstem kosten wird. Steht unter
   *  dem Feld statt darin: Der Hilfstext erklärt das Feld, dieser Satz eine
   *  Folge der getroffenen Wahl — und ein Fehler darf ihn nicht verdrängen. */
  hinweis?: string;
}) {
  const gruppen = einordnungenFuer(altersstufe);
  const zweistufig = gruppen.some((g) => g.bloecke.length > 0);

  const optionen = gruppen.flatMap((g) => {
    if (g.bloecke.length === 0) return [{ value: g.teil, label: g.label }];
    // Ein Teil mit genau EINEM gleichnamigen Block bekommt keine Kopfzeile:
    // Sie stünde wortgleich über ihrer einzigen Option und gliederte nichts —
    // «Auffangen / Auffangen». Dieselbe Regel, die früher seine Chip-Reihe
    // unterdrückte (Story #127), nur an der Optionsliste.
    const eigenstaendig = g.bloecke.length === 1 && g.bloecke[0].label === g.label;
    return g.bloecke.map((b) => ({
      value: b.slug,
      label: b.label,
      ...(eigenstaendig ? {} : { group: g.label }),
    }));
  });

  return (
    <div>
      <Select
        label={zweistufig ? "Trainingsteil und Block" : "Trainingsteil"}
        // Breiter als die übrigen Auswahlfelder, aber nicht über die ganze
        // Spalte: «Spielformen und unterstützende Übungen» soll ungekürzt in
        // die Wertzeile passen.
        className="max-w-lg"
        options={optionen}
        // Kein Leerwert in der Liste, sondern ein Platzhalter: Die Einordnung
        // ist Pflicht — «noch nichts gewählt» ist ein Zustand des Formulars,
        // keine Angabe über die Übung, und darf darum nicht wie eine
        // getroffene Wahl im Feld stehen.
        placeholder="Einordnung wählen …"
        value={wert}
        onChange={onChange}
        error={!!error}
        supportingText={error ?? supportingText}
      />
      {/* Dezenter Hinweis nach dem Muster der Hinweiszeile des
          Trainings-Editors (Styleguide «Leerzustand & Hinweiszeile»):
          nur das Zeichen trägt Farbe (Primary), der Text bleibt im
          Fliesstext-Schnitt. Er meldet eine Folge, blockiert aber nichts. */}
      {hinweis && (
        <p className="mt-1.5 flex items-start gap-2 type-body-small text-on-surface-mittel">
          <Info size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          {hinweis}
        </p>
      )}
    </div>
  );
}
