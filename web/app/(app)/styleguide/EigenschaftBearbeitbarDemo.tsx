"use client";

import { useState } from "react";
import {
  Eigenschaft,
  EigenschaftAuswahl,
  EigenschaftText,
  Eigenschaften,
  KategorieChip,
} from "@/components/ui";
import type { KategorieSlug } from "@/lib/vocab";

/** Bearbeitbare Eigenschaften (Abschnitt 28) — gespeichert wird hier nur im
 *  Zustand der Demo. */
export function EigenschaftBearbeitbarDemo() {
  const [ziel, setZiel] = useState("");
  const [stufen, setStufen] = useState<string[]>(["F", "E"]);
  return (
    <div className="max-w-[26rem]">
      <Eigenschaften titel="Eigenschaften">
        <Eigenschaft label="Altersstufe">Kinderfussball</Eigenschaft>
        <EigenschaftAuswahl
          label="Alterskategorien"
          options={[
            { value: "G", label: "G-Junior:innen" },
            { value: "F", label: "F-Junior:innen" },
            { value: "E", label: "E-Junior:innen" },
          ]}
          wert={stufen}
          anzeige={
            <span className="flex flex-wrap gap-1.5">
              {stufen.map((k) => (
                <KategorieChip key={k} k={k as KategorieSlug} />
              ))}
            </span>
          }
          leerText="Alterskategorie wählen"
          onChange={setStufen}
        />
        <EigenschaftText
          label="Ziel"
          wert={ziel}
          leerText="Ziel hinzufügen"
          maxLength={200}
          onSpeichern={setZiel}
        />
      </Eigenschaften>
    </div>
  );
}
