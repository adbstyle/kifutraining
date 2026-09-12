"use client";

import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { SegmentedControl } from "./SegmentedControl";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { ALTERSSTUFEN, type Altersstufe } from "@/lib/altersstufe";

const optionen = ALTERSSTUFEN.map((s) => ({ value: s, label: altersstufeLabels[s] }));

/** Nach welchem Lehrmittel eine Übung oder ein Training geführt wird
 *  (Story 3 AK 1/2, Story 5 AK 1/3).
 *
 *  Beim Erfassen eine offene Wahl, kein aufklappendes Menü — Vorgabe des
 *  Product Owners: die Altersstufe entscheidet über jedes weitere Feld des
 *  Formulars, und diese Tragweite soll man sehen, ohne erst zu klicken. Zwei
 *  Werte passen in eine Segmentleiste, darum dieselbe wie bei der
 *  Kinderfussball-Einordnung.
 *
 *  `wert = null` heisst «noch nicht gewählt». Am Training ist das der
 *  Ausgangszustand: dort bindet die Wahl lebenslang und darf nicht durch eine
 *  Voreinstellung durchrutschen. An der Übung ist sie vorbelegt, weil eine
 *  Übung umwandelbar bleibt (Story 4).
 *
 *  Steht die Stufe fest, wird sie nur noch benannt (AK 2/3). Sie zu ändern ist
 *  bei der Übung ein eigener, ausdrücklicher Weg (Story 4) und beim Training
 *  gar nicht vorgesehen. Der Badge ist bewusst neutral: die Altersstufe ist
 *  keine Alterskategorie und darf deren gelernte Farbcodierung nicht borgen. */
export function AltersstufeField({
  wert,
  onChange,
  festHinweis,
  aktion,
  hinweis,
  fehler,
}: {
  wert: Altersstufe | null;
  /** Fehlt, wo die Altersstufe feststeht und nur noch benannt wird. */
  onChange?: (wert: Altersstufe) => void;
  /** Zusatz beim festen Zustand, etwa «folgt dem Training». */
  festHinweis?: string;
  /** Bedienelement neben dem Badge — der einzige Weg, eine feststehende
   *  Altersstufe doch noch zu verlassen: das Überführen einer eigenen Übung
   *  (Story 4). Es steht bewusst hier und nicht in der Segmentleiste: ein
   *  Stufenwechsel ist an einer gespeicherten Übung kein Feld, sondern ein
   *  eigener, zu bestätigender Vorgang. */
  aktion?: ReactNode;
  /** Erklärung unter der Wahl; ersetzt den Übungs-Standardtext. */
  hinweis?: string;
  /** Fehlermeldung, wenn die Wahl fehlt. */
  fehler?: string;
}) {
  if (!onChange)
    return (
      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">Altersstufe</p>
        <div className="flex flex-wrap items-center gap-2">
          {wert && <Badge tone="neutral">{altersstufeLabels[wert]}</Badge>}
          {aktion}
          <p className="type-body-small text-on-surface-mittel">
            {festHinweis ??
              "Steht fest — Felder und Werte folgen dem Manual dieser Stufe."}
          </p>
        </div>
      </div>
    );

  return (
    <div>
      <p className="type-label-small mb-2 text-on-surface-mittel">Altersstufe</p>
      <SegmentedControl
        ariaLabel="Altersstufe"
        options={optionen}
        value={wert}
        onChange={onChange}
      />
      <p
        className={`type-body-small mt-1.5 ${fehler ? "text-error" : "text-on-surface-mittel"}`}
      >
        {fehler ??
          hinweis ??
          "Nach welchem Manual du erfasst. Bestimmt Einordnung, Alterskategorien und alle weiteren Felder."}
      </p>
    </div>
  );
}
