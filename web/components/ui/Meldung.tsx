import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Ton = "fehler" | "erfolg";

/* ── Meldung ──────────────────────────────────────────────────
   Eine abgesetzte Zeile, die dem Nutzer etwas über seinen eigenen Vorgang
   sagt: Das Speichern ist gescheitert, die Mail ist unterwegs, die Umwandlung
   ist vorgemerkt.

   FARBE TRÄGT, FÜLLT NICHT. Kontur und Schrift stehen in Error beziehungsweise
   Primary, die Fläche bleibt der Grund darunter. Eine gefüllte rote Box wäre
   lauter als das, was sie meldet, und sie zwänge zugleich eine zweite
   Schriftfarbe auf — genau das, was die Palette an genau einer Stelle erlaubt:
   dem gefüllten Knopf, der etwas auslöst.

   EIN Baustein statt neun abgeschriebener Boxen: Vor dem Umbau standen in der
   Anwendung vier verschiedene Polsterungen und drei Typo-Stufen für dieselbe
   Sache. Die Anatomie steht darum hier und nur hier.

   Zwei Töne, nicht mehr: `fehler` meldet, dass etwas nicht ging, `erfolg`
   bestätigt — gelungen oder vorgemerkt. Für einen dritten, gelben Ton gibt es
   in dieser Palette keine Rolle (siehe Styleguide 01, «Warning ist entfallen»).

   Die Vorlesehilfe erfährt es über `role`: eine Fehlermeldung unterbricht
   (`alert`), eine Bestätigung reiht sich ein (`status`). Wer es anders braucht,
   überschreibt es. */
const toene: Record<Ton, string> = {
  fehler: "border-error text-error",
  erfolg: "border-primary text-primary",
};

export function Meldung({
  tone,
  icon: Icon,
  children,
  role,
  className,
}: {
  tone: Ton;
  /** Optionales führendes Zeichen — es steht links, nicht über dem Text:
   *  Eine Meldung ist eine Zeile, kein Bild. */
  icon?: LucideIcon;
  children: ReactNode;
  /** Vorgabe: `alert` beim Fehler, `status` bei der Bestätigung. */
  role?: "alert" | "status";
  className?: string;
}) {
  return (
    <div
      role={role ?? (tone === "fehler" ? "alert" : "status")}
      className={cn(
        "type-body-small kontur flex items-start gap-2 rounded-flaeche bg-transparent px-4 py-3",
        toene[tone],
        className,
      )}
    >
      {Icon && <Icon size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />}
      {/* Eigene Spalte, damit mehrteilige Meldungen (Text plus Knopf, Text plus
          Codezeile) untereinander stehen statt neben dem Zeichen umzubrechen. */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
