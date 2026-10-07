import type { ReactNode } from "react";
import {
  CircleAlert,
  CircleCheck,
  Info,
  MessageCircleQuestion,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/* ── Section Message ──────────────────────────────────────────
   Atlassians «Section Message», wie Jira sie zeigt — der EINE Baustein für
   jede Nachricht an den Nutzer, die im Fluss der Seite steht: das Speichern
   ist gescheitert, die Mail ist unterwegs, das Feld-Diagramm zeigt anderes
   Material. Mit Knöpfen verlangt sie eine Antwort und bleibt stehen, bis eine
   gewählt ist; ohne Knöpfe meldet sie bloss.

   Nicht Atlassians «Banner»: Der ist ein kräftig gefüllter, einzeiliger
   Streifen über die ganze Breite oben auf der Seite, für seitenweite
   Ankündigungen. Eine solche gibt es in KiFu nicht — was hier steht, gehört
   immer zu einem Abschnitt, einem Formular, einem Dialog.

   Anatomie wie `@atlaskit/section-message`: eine getönte Fläche ohne Kontur
   (`section-*` = ADS `background.<x>`), 16 px Polsterung, `rounded-dialog`
   (6 px; Atlassian rundet 8 px, das Kit kennt keine grössere Rundung), das
   Zeichen (16 px in einem 24-px-Feld wie ADS `medium`/`spacious`, `icon-*` =
   ADS `icon.<x>`) links, 16 px Abstand zum Text. Der Text steht in
   `on-surface` — den Ton tragen Fläche und Zeichen, das zugleich
   ohne Farbwahrnehmung erkennbar ist. Die Knöpfe stehen wie Atlassians
   Aktionen UNTER dem Text, linksbündig mit ihm (der Textknopf bringt seine
   Polsterung mit, darum rückt die Leiste um sie nach links), abweisend
   zuerst.

   Die Darstellungen tragen Atlassians Namen: `information` (Vorgabe),
   `warning`, `error`, `success`, `discovery`. In KiFu angewandt sind
   `error` — etwas ging nicht — und `information` für alles andere; die
   übrigen stehen im Kit bereit (Styleguide › Leerzustand, Hinweiszeile & Section Message). Das Zeichen lässt sich
   überschreiben, die Farbe bleibt die der Darstellung.

   Die Vorlesehilfe erfährt den Ton über `role`: ein Fehler unterbricht
   (`alert`), alles andere reiht sich ein (`status`). Eine Meldung mit
   BEDIENELEMENT trägt immer `status` — `alert` ist atomar, jede Änderung darin
   liesse die ganze Meldung unterbrechend neu vorlesen, und ARIA verlangt für
   `alert` Inhalt ohne Fokus. */
type Appearance = "information" | "warning" | "error" | "success" | "discovery";

const darstellungen: Record<Appearance, { icon: LucideIcon; flaeche: string; zeichen: string }> = {
  information: { icon: Info, flaeche: "bg-section-information", zeichen: "text-icon-information" },
  warning: { icon: TriangleAlert, flaeche: "bg-section-warning", zeichen: "text-icon-warning" },
  // Atlassian nennt die Darstellung «error», die Farbrolle dahinter «danger».
  error: { icon: CircleAlert, flaeche: "bg-section-danger", zeichen: "text-icon-danger" },
  success: { icon: CircleCheck, flaeche: "bg-section-success", zeichen: "text-icon-success" },
  discovery: { icon: MessageCircleQuestion, flaeche: "bg-section-discovery", zeichen: "text-icon-discovery" },
};

export function SectionMessage({
  appearance = "information",
  icon,
  children,
  actions,
  role,
  className,
}: {
  /** `error`: etwas ging nicht. `information` (Vorgabe): alles andere. */
  appearance?: Appearance;
  /** Überschreibt das Zeichen der Darstellung; die Farbe bleibt. */
  icon?: LucideIcon;
  /** Der Text — ein oder zwei Sätze. */
  children: ReactNode;
  /** Ein oder zwei Knöpfe `variant="text"`, abweisend zuerst. */
  actions?: ReactNode;
  /** Vorgabe: `alert` beim Fehler ohne Knöpfe, sonst `status`. */
  role?: "alert" | "status";
  className?: string;
}) {
  const d = darstellungen[appearance];
  const Icon = icon ?? d.icon;
  return (
    <div
      role={role ?? (appearance === "error" && !actions ? "alert" : "status")}
      className={cn("flex gap-4 rounded-dialog p-4", d.flaeche, className)}
    >
      <span className={cn("flex size-6 shrink-0 items-center justify-center", d.zeichen)}>
        <Icon size={16} strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 grow">
        {/* Die erste Zeile mittig zum 24-px-Zeichenfeld, weitere laufen darunter. */}
        <div className="type-body-medium pt-px text-on-surface">{children}</div>
        {actions && <div className="-ml-4 mt-2 flex flex-wrap gap-x-2">{actions}</div>}
      </div>
    </div>
  );
}
