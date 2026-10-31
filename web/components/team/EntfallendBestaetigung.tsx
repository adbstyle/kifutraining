"use client";

import { TriangleAlert } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { verfallDialogText } from "@/lib/spieler";
import { kaderVerfallText } from "@/lib/kader";
import { TERMIN_TEXT, trainingOhneTermin } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
import type { SerienFolge } from "@/lib/kern/serien";

/* Fallen Termine weg, muss das bestätigt werden (#326 AK 8). Genannt werden
   nur die wegfallenden Termine MIT Training (OoS 2), je mit dem, was ihrem
   Training geschieht: Ein Termin-Training wird mitgelöscht, ein Training aus
   dem Bestand bleibt dort (PO 2026-10-06). Eine Anzahl nennt der Dialog
   nicht (OoS 4).

   Verfallen durch die Änderung Abmeldungen (#437 AK 1), sagt es derselbe
   Dialog — auch, wenn keine Termine wegfallen. Ebenso Abmeldungen, deren
   Termin wegen der Kader nicht mehr für die Spieler:in gilt (#453 AK 10),
   und Nachträge zur Anwesenheit begonnener Termine, die wieder offen
   werden (#475 AK 12). Nimmt die Zeitänderung Treffpunkte, weil sie am
   Vortag lägen, nennt er jeden dieser Termine (#561 PC 5).

   `SerienFolge` ist ein reiner Typ: `import type` zieht nichts aus dem
   server-only Fachkern in das Client-Bundle. */
export function EntfallendBestaetigung({
  folge,
  aktion,
  pending,
  onClose,
  onBestaetigen,
}: {
  folge: SerienFolge | null;
  aktion: "aendern" | "entfernen";
  pending?: boolean;
  onClose: () => void;
  onBestaetigen: () => void;
}) {
  const wegfall = aktion === "entfernen" || (folge?.entfallendAnzahl ?? 0) > 0;
  const nachtraege = folge?.nachtraegeVerfallend ?? 0;
  const absagen = folge?.absagenVerfallend ?? 0;
  const abmeldungen = folge?.abmeldungenVerfallend ?? 0;
  const anmeldungen = folge?.anmeldungenVerfallend ?? 0;
  const verfall = abmeldungen + nachtraege + absagen + anmeldungen;
  const kaderVerfall = folge?.abmeldungenKader ?? 0;
  const treffpunkte = folge?.treffpunktEntfallend ?? [];
  const davor = wegfall || verfall > 0 || kaderVerfall > 0;
  return (
    <Dialog
      open={folge !== null}
      onClose={onClose}
      title={
        aktion === "entfernen"
          ? "Termine entfernen?"
          : wegfall
            ? "Termine fallen weg"
            : abmeldungen + nachtraege + (folge?.abmeldungenKader ?? 0) > 0
              ? "Abmeldungen verfallen"
              : anmeldungen > 0
                ? "Anmeldungen verfallen"
                : absagen > 0
                  ? "Absagen verfallen"
                  : "Treffpunkt entfällt"
      }
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>Abbrechen</Button>
          <Button variant="danger" disabled={pending} onClick={onBestaetigen}>
            {aktion === "entfernen" ? "Entfernen" : "Ändern"}
          </Button>
        </>
      }
    >
      {wegfall && (
        <p className="flex items-start gap-2">
          <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-error" />
          Termine der Serie fallen damit weg.
        </p>
      )}
      {folge && folge.entfallend.length > 0 && (
        <>
          <p className="mt-3">Diese tragen ein Training:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {folge.entfallend.map((e) => (
              <li key={e.terminId}>
                {datumKurz(e.datum)} - <strong className="text-on-surface">{e.training.name}</strong>
                {" "}{trainingOhneTermin(e.training.terminTraining)}
              </li>
            ))}
          </ul>
        </>
      )}
      {verfall > 0 && (
        <p className={wegfall ? "mt-3" : "flex items-start gap-2"}>
          {!wegfall && <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-icon-warning" />}
          <span>{verfallDialogText(abmeldungen, nachtraege, absagen, anmeldungen)}</span>
        </p>
      )}
      {kaderVerfall > 0 && (
        <p className={wegfall || verfall > 0 ? "mt-3" : "flex items-start gap-2"}>
          {!wegfall && verfall === 0 && <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-icon-warning" />}
          <span>{kaderVerfallText(kaderVerfall)}</span>
        </p>
      )}
      {treffpunkte.length > 0 && (
        <>
          <p className={davor ? "mt-3" : "flex items-start gap-2"}>
            {!davor && <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-icon-warning" />}
            <span>{TERMIN_TEXT.treffpunktEntfaelltSerie}</span>
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {treffpunkte.map((t) => (
              <li key={t.terminId}>{datumKurz(t.datum)}</li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
