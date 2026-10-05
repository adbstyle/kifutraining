"use client";

import { useState } from "react";
import { FelderField, felderAusZeilen, zeilenAusFeldern } from "@/components/team/FelderField";
import { felderKurz, felderProblem, feldText } from "@/lib/termin-felder";

/* Eigene Datei, weil die Styleguide-Seite eine Server-Komponente ist — das
   Feld hält seine Zeilen im Zustand des Aufrufers.

   Gezeigt wird der Anlassfall: ein Kunstrasenfeld mit Grösse und Toren,
   daneben ein zweites Feld, von dem nur die Halle bekannt ist. Darunter, was
   Trainingsplan (knapp) und Durchführen-Ansicht (ausführlich) daraus machen;
   die Prüfung läuft live, damit der Fehlerzustand zu sehen ist. */
export function FelderDemo() {
  const [zeilen, setZeilen] = useState(() =>
    zeilenAusFeldern([
      { laenge_m: 30, breite_m: 25, tore: { minitor: 2, tor_5m: 0, tor_7m: null }, untergrund: "kunstrasen" },
      { laenge_m: null, breite_m: null, tore: { minitor: null, tor_5m: null, tor_7m: null }, untergrund: "halle" },
    ]),
  );
  const felder = felderAusZeilen(zeilen);
  const problem = felderProblem(felder);
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <FelderField zeilen={zeilen} onZeilenChange={setZeilen} problem={problem} />
      {!problem && (
        <div className="type-body-small text-on-surface-mittel">
          <p className="type-label-small mb-1">Trainingsplan</p>
          <p>{felderKurz(felder) ?? "(nichts - ohne Felder)"}</p>
          <p className="type-label-small mb-1 mt-3">Durchführen</p>
          <ul>
            {(felder ?? []).map((f, i) => (
              <li key={i}>{feldText(f)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
