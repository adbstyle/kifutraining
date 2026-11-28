import type { ReactNode } from "react";

/* Die Aktionen einer Seite in ihrer Kopfzeile (#706, Variante B «wie
   Übungen»): rechts neben den Brotkrumen, die Hauptaktion als gefüllter Knopf
   mit Text, Zweitaktionen weniger hervorgehoben daneben — Knöpfe in Kontur
   (`zweit`) links von ihr, ein Menü ⋮ (`menue`) rechts aussen. Hier steht die
   Anordnung; welche Knöpfe, gibt die Seite. Die Hauptaktion steht nur hier,
   auch wenn die Seite leer ist — kein zweiter Knopf im Leerzustand.

   Gesperrt (etwa an einer Grenze) bleibt die Hauptaktion sichtbar; der Satz
   mit dem Grund steht sichtbar unter der Kopfzeile, und der Knopf verweist mit
   `aria-describedby` darauf — nie ein Tooltip am gesperrten Knopf (der
   reagiert nicht auf Zeiger). Muster wie «Team anlegen» und «Kader anlegen». */
export function KopfAktionen({ haupt, zweit, menue }: { haupt?: ReactNode; zweit?: ReactNode; menue?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {zweit}
      {haupt}
      {menue}
    </div>
  );
}

/** Die Beschriftung eines Knopfs in der Kopfzeile (#706 AK 8): schmal (unter
 *  `sm`) die Kurzform, etwa «Hinzufügen», breiter der volle Name. Vorlesehilfen
 *  hören immer den vollen Namen; die Kurzform ist ein Teil von ihm, so passt
 *  auch die Sprachsteuerung («Hinzufügen» klicken). Ohne Hooks — auch in
 *  Client-Knöpfen nutzbar. */
export function KopfKnopfText({ label, kurz }: { label: string; kurz: string }) {
  return (
    <>
      <span aria-hidden className="sm:hidden">
        {kurz}
      </span>
      <span className="max-sm:sr-only">{label}</span>
    </>
  );
}
