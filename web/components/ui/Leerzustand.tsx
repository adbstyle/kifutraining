import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/* ── Leerzustand ──────────────────────────────────────────────
   Das Feld, das an der Stelle einer leeren Liste steht: gestrichelte Kontur,
   Zeichen, Titel, ein Satz zum Weiterkommen.

   WARUM GESTRICHELT: Eine durchgezogene Kontur umreisst etwas, das da ist. Die
   gestrichelte sagt, dass hier etwas hingehört und noch fehlt — dieselbe
   Lesart wie auf Papier. Die Fläche bleibt der Grund; ein eigener Ton machte
   aus dem Fehlenden eine Karte.

   ABGRENZUNG zur Leerzeile INNERHALB eines Blocks (Trainings-Editor: «Noch
   keine Übung zugeordnet»): Die ist blosser Text ohne Rahmen und ohne Zeichen.
   Ein Rahmen im Rahmen zöge einen zweiten Strich um etwas, das der Block schon
   abgrenzt. Dieser Baustein gilt für das, was eine ganze SEITE oder einen
   ganzen Abschnitt füllt.

   `dicht` nimmt die Polsterung zurück, wo das Leerfeld unter einer Überschrift
   im Abschnitt steht statt allein auf der Seite. */
export function Leerzustand({
  icon: Icon,
  titel,
  children,
  aktion,
  dicht = false,
}: {
  /** 40 px, Strichstärke 1.5 — gross genug, um die Fläche zu tragen, leise
   *  genug, um nicht wie ein Knopf auszusehen. */
  icon?: LucideIcon;
  titel: string;
  /** Der Satz darunter: was fehlt und wie man dahin kommt. */
  children: ReactNode;
  /** Optionales Bedienelement unter dem Text — der eine Weg heraus. */
  aktion?: ReactNode;
  dicht?: boolean;
}) {
  return (
    <div
      className={cn(
        "kontur flex flex-col items-center gap-3 rounded-flaeche border-dashed border-kante bg-transparent text-center text-on-surface-mittel",
        dicht ? "px-5 py-8" : "px-6 py-16",
      )}
    >
      {Icon && <Icon size={40} strokeWidth={1.5} aria-hidden />}
      <p className="type-title-medium text-on-surface">{titel}</p>
      <p className="type-body-medium max-w-sm">{children}</p>
      {aktion}
    </div>
  );
}
