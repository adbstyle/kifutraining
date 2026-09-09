"use client";

import { useRef, useState, type ReactNode } from "react";
import { TextArea } from "@/components/ui";
import { NOTIZ_MAX } from "@/lib/training";

/**
 * Das zweite Geschoss einer Übungszeile im Editor: der Durchlauf (Story #150,
 * nur im Hauptteil eines Trainings mit Gruppen) und die Notiz (Story #152, an
 * JEDER Übung jedes Trainings).
 *
 * Die Etage steht darum an jeder Zeile — ohne Gruppen ist sie einzeilig und
 * trägt allein die Notiz. Getrennt vom Kopf ist sie durch Abstand und nicht
 * durch eine Haarlinie: Es ist eine Zeile, kein Kasten mit zwei Fächern.
 *
 * Die Notiz ist ein OFFENES Feld und kein Knopf, der einen Dialog aufmacht:
 * Sie soll beim Zusammenstellen zu sehen sein (AK 3), und was hinter einem
 * Klick liegt, liest niemand im Vorbeigehen. Ihr Platz unter dem Durchlauf
 * folgt derselben Ordnung wie in der Durchführen-Ansicht.
 */
export function UebungsEtage({
  uebungName,
  durchlauf,
  notiz,
  onNotiz,
}: {
  /** Für den a11y-Namen des Notizfelds: dasselbe Feld steht an jeder Übung. */
  uebungName: string;
  /** Die Durchlauf-Zeile, wo es eine gibt; sonst `null`. */
  durchlauf?: ReactNode;
  /** Die erfasste Notiz, `null` ohne. */
  notiz: string | null;
  /** Der neue Text; der leere Text heisst «keine Notiz». Persistiert der
   *  Aufrufer. */
  onNotiz: (next: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      {durchlauf}
      <NotizFeld uebungName={uebungName} notiz={notiz} onNotiz={onNotiz} />
    </div>
  );
}

/**
 * Das Notizfeld selbst.
 *
 * Gespeichert wird beim Verlassen des Felds, nicht bei jedem Tastendruck: Ein
 * Satz wäre sonst so viele Speichervorgänge, wie er Zeichen hat. Und nicht mit
 * Enter — im mehrzeiligen Feld ist Enter der Zeilenumbruch.
 *
 * `maxLength` schneidet bei `NOTIZ_MAX` ab; die Server Action und der CHECK an
 * der Spalte weisen längeren Text ohnehin ab. Ein Zähler steht bewusst nicht
 * dabei: 500 Zeichen sind für eine Randbemerkung so viel, dass die Schranke im
 * Alltag nie in Sicht kommt.
 */
function NotizFeld({
  uebungName,
  notiz,
  onNotiz,
}: {
  uebungName: string;
  notiz: string | null;
  onNotiz: (next: string) => void;
}) {
  const [entwurf, setEntwurf] = useState(notiz ?? "");
  // Der Text, der zuletzt zum Speichern hinausging. Ohne diese Schranke
  // schriebe jedes Verlassen des Felds erneut — auch das direkt nach einer
  // Rücknahme. Ref statt State: sie muss beim nächsten Aufruf schon gelten,
  // nicht erst beim nächsten Rendern.
  const gesendet = useRef<string | undefined>(undefined);
  // Der zuletzt von aussen gesehene Wert. Ändert er sich — nach einer Rücknahme
  // durch den Server oder durch frische Serverdaten —, gilt er und nicht mehr,
  // was im Feld steht.
  const [gesehen, setGesehen] = useState(notiz);
  if (notiz !== gesehen) {
    setGesehen(notiz);
    setEntwurf(notiz ?? "");
    gesendet.current = undefined;
  }

  function speichere() {
    const getrimmt = entwurf.trim();
    // Ein unveränderter Text ist kein Speichervorgang — sonst schriebe jedes
    // Vorbeitabben in die Datenbank —, und derselbe Text kein zweiter Auftrag.
    if (getrimmt === (notiz ?? "") || getrimmt === gesendet.current) return;
    gesendet.current = getrimmt;
    onNotiz(getrimmt);
  }

  return (
    <TextArea
      label="Notiz"
      // Der sichtbare Name zuerst — Sprachsteuerung trifft ihn weiter —, dann
      // die Übung: Dasselbe Feld steht an jeder Zeile, und «Notiz» allein
      // sagte in der Vorleseliste nicht, zu welcher Übung.
      aria-label={`Notiz zu ${uebungName}`}
      maxLength={NOTIZ_MAX}
      value={entwurf}
      onChange={(e) => {
        setEntwurf(e.target.value);
        // Wer weiterschreibt, hebt die Schranke auf: Derselbe Text darf danach
        // erneut hinaus — etwa, wenn der Server ihn zwischenzeitlich zurücknahm.
        gesendet.current = undefined;
      }}
      onBlur={speichere}
    />
  );
}
