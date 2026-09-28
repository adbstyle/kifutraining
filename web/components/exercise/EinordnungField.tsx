"use client";

import { Info } from "lucide-react";
import { Select } from "@/components/ui";
import {
  einordnungenFuer,
  traegtHauptteilkategorie,
  type Altersstufe,
} from "@/lib/altersstufe";
import { hauptteilkategorie as hkatLabels } from "@/lib/vocab";

/** Trennzeichen im Optionswert «hauptteil:<kategorie>» — Slugs enthalten
 *  keinen Doppelpunkt. Der zusammengesetzte Wert lebt nur in diesem Feld;
 *  nach aussen gehen Einordnung und Hauptteilkategorie getrennt, so wie sie
 *  gespeichert und geprüft werden. */
const TRENNER = ":";

/** Wo eine Übung in ihrem Trainingsschema liegt (Story 2 AK 1, Story 3 AK 3/4).
 *
 *  Eine Einfachauswahl mit Panel (Styleguide 16) — dieselbe Form, in der die
 *  Maske inzwischen jede Einfachauswahl führt (PO-Vorgabe 2026-09-13). Sie lag
 *  eine Zeit lang offen (Segmentleiste, im Juniorenschema mit einer zweiten
 *  Reihe Chips), weil die Einordnung über die halbe Maske darunter entscheidet
 *  und das sichtbar sein sollte.
 *
 *  Kinderfussball: die vier Trainingsteile als Kopfzeilen, der Hauptteil über
 *  seinen drei Kategorien — wie ein Junioren-Teil über seinen Blöcken.
 *  Eine Wahl setzt so Trainingsteil und Hauptteilkategorie zugleich; ein
 *  zweites Auswahlfeld entfällt. Gespeichert bleiben beide getrennt.
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
  hauptteilkategorie = "",
  onChange,
  error,
  supportingText,
  hinweis,
}: {
  altersstufe: Altersstufe;
  /** Die gewählte Einordnung (Kinderfussball-Trainingsteil oder Junioren-Block). */
  wert: string;
  /** Die Hauptteilkategorie, wenn die Einordnung der Kinderfussball-Hauptteil ist. */
  hauptteilkategorie?: string;
  /** Die neue Einordnung samt Hauptteilkategorie — leer, wo es keine gibt. */
  onChange: (einordnung: string, hauptteilkategorie: string) => void;
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
    // Kinderfussball-Hauptteil: seine Kategorien unter ihm als Kopfzeile.
    if (traegtHauptteilkategorie(altersstufe, g.teil))
      return (Object.keys(hkatLabels) as (keyof typeof hkatLabels)[]).map((k) => ({
        value: `${g.teil}${TRENNER}${k}`,
        label: hkatLabels[k],
        group: g.label,
      }));
    // JEDER Teil steht unter seiner Kopfzeile, auch einer mit nur einer Wahl
    // («Auffangen / Auffangen»): Eine Option ohne Kopfzeile liest sich sonst
    // als Teil der Gruppe darüber — «Ausklang» sah aus, als gehöre er zum
    // Hauptteil, «Abschluss» ebenso (PO 2026-09-28; hebt die Ausnahme für
    // gleichnamige Einzelblöcke aus Story #127 auf).
    if (g.bloecke.length === 0) return [{ value: g.teil, label: g.label, group: g.label }];
    return g.bloecke.map((b) => ({ value: b.slug, label: b.label, group: g.label }));
  });

  const auswahl =
    traegtHauptteilkategorie(altersstufe, wert) && hauptteilkategorie
      ? `${wert}${TRENNER}${hauptteilkategorie}`
      : wert;

  function waehle(v: string) {
    const [einordnung, hkat = ""] = v.split(TRENNER);
    onChange(einordnung, hkat);
  }

  return (
    <div>
      <Select
        label={zweistufig ? "Trainingsteil und Block" : "Trainingsteil und Hauptteilkategorie"}
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
        value={auswahl}
        onChange={waehle}
        error={!!error}
        supportingText={
          error ??
          // Steht der Hauptteil ohne Kategorie da (Vorbelegung, Vorschlag beim
          // Überführen), passt er zu keiner Option, und das Feld sähe leer aus.
          (traegtHauptteilkategorie(altersstufe, wert) && !hauptteilkategorie
            ? "Hauptteil — bitte noch die Kategorie wählen."
            : supportingText)
        }
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
