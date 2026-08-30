"use client";

import { Badge, SegmentedControl } from "@/components/ui";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { ALTERSSTUFEN, type Altersstufe } from "@/lib/altersstufe";

const optionen = ALTERSSTUFEN.map((s) => ({ value: s, label: altersstufeLabels[s] }));

/** Nach welchem Lehrmittel eine Übung geführt wird (Story 3 AK 1/2).
 *
 *  Beim Erfassen eine offene Wahl, kein aufklappendes Menü — Vorgabe des
 *  Product Owners: die Altersstufe entscheidet über jedes weitere Feld des
 *  Formulars, und diese Tragweite soll man sehen, ohne erst zu klicken. Zwei
 *  Werte passen in eine Segmentleiste, darum dieselbe wie bei der
 *  Kinderfussball-Einordnung.
 *
 *  Beim Bearbeiten steht die Stufe fest und wird nur noch benannt (AK 2). Sie
 *  zu ändern ist ein eigener, ausdrücklicher Weg (Story 4) — kein Nebeneffekt
 *  des Bearbeitens. Der Badge ist bewusst neutral: die Altersstufe ist keine
 *  Alterskategorie und darf deren gelernte Farbcodierung nicht borgen. */
export function AltersstufeField({
  wert,
  onChange,
  festHinweis,
}: {
  wert: Altersstufe;
  /** Fehlt beim Bearbeiten: dort ist die Altersstufe gesetzt und unveränderlich. */
  onChange?: (wert: Altersstufe) => void;
  /** Zusatz beim festen Zustand, etwa «folgt dem Training». */
  festHinweis?: string;
}) {
  if (!onChange)
    return (
      <div>
        <p className="type-label-small mb-2 text-on-surface-variant">Altersstufe</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{altersstufeLabels[wert]}</Badge>
          <p className="type-body-small text-on-surface-variant">
            {festHinweis ??
              "Steht fest — Felder und Werte folgen dem Manual dieser Stufe."}
          </p>
        </div>
      </div>
    );

  return (
    <div>
      <p className="type-label-small mb-2 text-on-surface-variant">Altersstufe</p>
      <SegmentedControl
        ariaLabel="Altersstufe"
        options={optionen}
        value={wert}
        onChange={onChange}
      />
      <p className="type-body-small mt-1.5 text-on-surface-variant">
        Nach welchem Manual du erfasst. Bestimmt Einordnung, Alterskategorien und
        alle weiteren Felder.
      </p>
    </div>
  );
}
