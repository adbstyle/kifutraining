import Link from "next/link";
import { Layers } from "lucide-react";
import { chipTextBase, chipTextOutlined, chipTextSelected } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Variante } from "@/lib/varianten";

/**
 * Zwischen den Varianten des Hauptteils wechseln — auf den Seiten, die der
 * Server rendert (#203 AK 2/4/7).
 *
 * Das Gegenstück zu `VariantenWahl`: dieselbe Optik, dieselbe Schranke bei
 * einer Variante, aber Links statt Chips mit Zustand.
 *
 * Die Optik kommt aus denselben Klassenbündeln wie dort — `chipText*`, also
 * die Pille für NUTZERTEXT: normal gesetzt statt mono/versal, weil auf den
 * Chips die Bezeichnung steht, die die Trainerin selbst vergeben hat. So
 * tragen Ansehen, Druck und Durchführen dieselbe Schreibweise wie der Editor,
 * und gefüllt heisst überall dasselbe: das ist die angezeigte Variante. Was
 * hier fehlt, ist allein das Verwalten — kein Menü, kein Chevron; wer
 * umbenennt oder umsortiert, tut das beim Zusammenstellen.
 *
 * Der Unterschied zu `VariantenWahl` ist nicht kosmetisch:
 *
 * - Ansehen und Drucken haben keinen Client-Zustand. Die angezeigte Variante
 *   steht im Suchparameter (`VARIANTE_PARAM`), und damit hat jede Variante
 *   eine eigene ADRESSE — weitergebbar, als Lesezeichen brauchbar, und der
 *   Zurück-Schritt des Browsers tut das Erwartete. Genau die Begründung, aus
 *   der auch `TabNav` Links trägt.
 * - Wer ein Training nur ansehen darf, wechselt damit ebenfalls (AK 7): Ein
 *   Link braucht keine Rechte, die Zeile liest sich wie das Training selbst.
 *
 * `aria-current="page"` statt `aria-checked`: Es ist Navigation, keine
 * Einfachauswahl. Aus demselben Grund KEIN wandernder Tabstopp — durch Links
 * tabbt man, Pfeiltasten gehören der Radiogroup.
 *
 * Bei genau einer Variante rendert der Baustein nichts (Epic EK 7) — wie
 * `VariantenWahl`, damit die Schranke nicht bei jedem Aufrufer steht.
 */
export function VariantenLinks({
  varianten,
  aktiv,
  hrefFuer,
  className,
}: {
  varianten: readonly Variante[];
  /** Die angezeigte Variante. `undefined` nur im Grenzfall eines Trainings
   *  ohne Varianten — dann ist ohnehin nichts zu wählen. */
  aktiv: string | undefined;
  /** Die Adresse derselben Seite mit dieser Variante. */
  hrefFuer: (varianteId: string) => string;
  /** Vom Aufrufer, etwa `print:hidden` im Druck. */
  className?: string;
}) {
  if (varianten.length < 2) return null;

  return (
    <nav
      aria-label="Variante des Hauptteils"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {/* Dasselbe Zeichen wie an der Variantenleiste des Editors. Hier trägt es
          mehr als dort: Die Zeile steht frei auf der Seite, ohne Kartenkopf,
          der sie einordnen würde. */}
      <Layers size={18} strokeWidth={2} aria-hidden className="shrink-0 text-on-surface-variant" />
      {varianten.map((v) => (
        <Link
          key={v.id}
          href={hrefFuer(v.id)}
          aria-current={v.id === aktiv ? "page" : undefined}
          className={cn(
            chipTextBase,
            v.id === aktiv ? chipTextSelected : chipTextOutlined,
          )}
        >
          {v.name}
        </Link>
      ))}
    </nav>
  );
}
