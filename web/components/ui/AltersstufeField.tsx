"use client";

import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { Select } from "./Select";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { ALTERSSTUFEN, istAltersstufe, type Altersstufe } from "@/lib/altersstufe";

const optionen = ALTERSSTUFEN.map((s) => ({ value: s as string, label: altersstufeLabels[s] }));

/** Nach welchem Lehrmittel eine Übung oder ein Training geführt wird
 *  (Story 3 AK 1/2, Story 5 AK 1/3).
 *
 *  Die Wahl ist eine Einfachauswahl mit Panel (Styleguide 16) — dasselbe
 *  Auswahlfeld, das auch Feldtyp, Hauptteilkategorie und Übungstyp tragen. Sie
 *  lag eine Zeit lang offen in einer Segmentleiste, weil die Tragweite der
 *  Altersstufe sichtbar sein sollte, ohne erst zu klicken; die Maske führt
 *  ihre Auswahlfelder inzwischen durchgängig in dieser einen Form
 *  (PO-Vorgabe 2026-09-13), und ein einzelnes offen liegendes Feld darin wäre
 *  eine Ausnahme ohne eigenen Grund.
 *
 *  `wert = null` heisst «noch nicht gewählt». Am Training ist das der
 *  Ausgangszustand: dort bindet die Wahl lebenslang und darf nicht durch eine
 *  Voreinstellung durchrutschen — deshalb steht dann der Leerfall als erste
 *  Option in der Liste. An der Übung ist sie vorbelegt, weil eine Übung
 *  umwandelbar bleibt (Story 4); dort gibt es den Leerfall gar nicht.
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
   *  (Story 4). Es steht bewusst hier und nicht im Auswahlfeld: ein
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
    <Select
      label="Altersstufe"
      className="max-w-xs"
      value={wert ?? ""}
      // Der Leerfall steht nur, solange nichts gewählt ist. Einmal gesetzt,
      // lässt sich die Altersstufe nicht mehr auf «keine» zurückstellen — sie
      // ist an Übung wie Training eine geführte Pflichtangabe.
      options={wert === null ? [{ value: "", label: "— Altersstufe wählen —" }, ...optionen] : optionen}
      onChange={(v) => istAltersstufe(v) && onChange(v)}
      error={!!fehler}
      supportingText={
        fehler ??
        hinweis ??
        "Nach welchem Manual du erfasst. Bestimmt Einordnung, Alterskategorien und alle weiteren Felder."
      }
    />
  );
}
