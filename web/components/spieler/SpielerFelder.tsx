"use client";

import type { Ref } from "react";
import { TextField } from "@/components/ui";
import { JAHRGANG_STELLEN, JS_MAX, nurZiffern, type SpielerFeld } from "@/lib/spieler";

/* Die vier Felder einer Spieler:in — Vorname, Nachname, Jahrgang, J+S-Nummer —
   samt Eingabe (der Jahrgang nimmt nur Ziffern) und Platz für den Fehler am
   Feld. Rein darstellend: Dialog, Knöpfe, Speichern und alles, was nur einen
   Ort betrifft (Kader und Probe am Team-Ort), bleiben beim Aufrufer. Zwei
   Orte nutzen sie: die Spielerliste eines Teams und der Spielerbestand des
   Vereins; so stehen Zwillinge der Checks und die Fehlerzuordnung nur einmal
   da. Importiert nichts aus lib/actions (Rollen nach Ort, check:kern). */

export type SpielerAngaben = { vorname: string; nachname: string; jahrgang: string; jsNummer: string };
export const LEERE_ANGABEN: SpielerAngaben = { vorname: "", nachname: "", jahrgang: "", jsNummer: "" };

/** Ein Fehler, wie die Actions ihn liefern: `feld` nennt, wo er hingehört. */
export type SpielerFehler = { feld?: string; text: string };

/** Gehört der Fehler an eines der vier Felder? Ohne Feld steht er am
 *  Vornamen. Andere (`spieler_id`: gelöscht) zeigt der Aufrufer selbst. */
export function istFeldFehler(fehler: SpielerFehler | null): boolean {
  return !!fehler && (["vorname", "nachname", "jahrgang", "js_nummer"] satisfies SpielerFeld[]).includes((fehler.feld ?? "vorname") as SpielerFeld);
}

export function SpielerFelder({
  wert,
  onAendern,
  fehler,
  erstesFeld,
}: {
  wert: SpielerAngaben;
  onAendern: (feld: keyof SpielerAngaben, text: string) => void;
  fehler: SpielerFehler | null;
  /** Ref auf das Vorname-Feld, etwa um nach dem Aufnehmen dorthin zurückzukehren. */
  erstesFeld?: Ref<HTMLInputElement>;
}) {
  const feld = (k: keyof SpielerAngaben) => ({
    value: wert[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onAendern(k, k === "jahrgang" ? nurZiffern(e.target.value) : e.target.value),
  });
  const fehlerAn = (f: SpielerFeld) => (fehler && (fehler.feld ?? "vorname") === f ? fehler.text : undefined);
  return (
    <>
      <TextField ref={erstesFeld} label="Vorname" autoComplete="off" autoFocus {...feld("vorname")} error={!!fehlerAn("vorname")} supportingText={fehlerAn("vorname")} />
      <TextField label="Nachname" autoComplete="off" {...feld("nachname")} error={!!fehlerAn("nachname")} supportingText={fehlerAn("nachname")} />
      <TextField label="Jahrgang" inputMode="numeric" maxLength={JAHRGANG_STELLEN} autoComplete="off" {...feld("jahrgang")} error={!!fehlerAn("jahrgang")} supportingText={fehlerAn("jahrgang")} />
      <TextField label="J+S-Nummer (optional)" autoComplete="off" maxLength={JS_MAX} {...feld("jsNummer")} error={!!fehlerAn("js_nummer")} supportingText={fehlerAn("js_nummer")} />
    </>
  );
}
