import type { ReactNode } from "react";
import { CircleAlert, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/* ── Banner ───────────────────────────────────────────────────
   Material 2 «Banner» — der EINE Baustein für jede Nachricht an den Nutzer,
   die im Fluss der Seite steht: das Speichern ist gescheitert, die Mail ist
   unterwegs, das Feld-Diagramm zeigt anderes Material. Mit Knöpfen verlangt er
   eine Antwort und bleibt stehen, bis eine gewählt ist; ohne Knöpfe meldet er
   bloss. (Er ersetzt die frühere, umrandete «Meldung»: zwei Bausteine für
   dieselbe Sache hätten zwei Sprachen gesprochen.)

   KEINE BOX. Materials Banner ist eine Fläche mit Trennlinie darunter, kein
   umrandeter Kasten. Die Fläche ist ein 5-%-Overlay (`on-surface/5`) und keine
   feste Höhenstufe: So steht der Banner immer EINE Stufe über dem, worauf er
   liegt — auf dem Grund genau `elev-01`, im Dialog über dessen 24dp statt als
   dunkles Loch darin. Die Haarlinie (`linie`) schliesst ihn nach unten.

   Der Text steht in On-Surface, nicht im Akzent: Primary gehört den
   Handlungen, und ein Fehler bleibt als Schrift auf jeder Fläche lesbar. Den
   Ton trägt das ZEICHEN — Error beim Fehler, sonst Primary —, das zugleich
   ohne Farbwahrnehmung erkennbar ist. Darum hat jeder Banner eins (Vorgabe je
   Ton, überschreibbar).

   Das Zeichen steht OHNE gefüllten Kreis: Materials 40-dp-Kreis in Primary
   wäre eine Akzentfläche, und füllen darf in dieser Palette nur der Knopf, der
   etwas auslöst (siehe Styleguide 01). Die 40 px Breite bleibt, damit der Text
   an derselben Flucht beginnt wie in Materials Anatomie.

   Die Knöpfe stehen rechtsbündig, die abweisende Handlung links, die
   bestätigende rechts (Material). Passen Text und Knöpfe in eine Zeile, stehen
   sie nebeneinander; sonst bricht die Knopfleiste per `flex-wrap` unter den
   Text — ohne Messung, ohne Breakpoint.

   Die Vorlesehilfe erfährt den Ton über `role`: ein Fehler unterbricht
   (`alert`), alles andere reiht sich ein (`status`). Ein Banner mit
   BEDIENELEMENT trägt immer `status` — `alert` ist atomar, jede Änderung darin
   liesse den ganzen Banner unterbrechend neu vorlesen, und ARIA verlangt für
   `alert` Inhalt ohne Fokus. */
type Ton = "fehler" | "hinweis";

const zeichen: Record<Ton, { icon: LucideIcon; farbe: string }> = {
  fehler: { icon: CircleAlert, farbe: "text-error" },
  hinweis: { icon: Info, farbe: "text-primary" },
};

export function Banner({
  tone = "hinweis",
  icon,
  children,
  actions,
  role,
  className,
}: {
  /** `fehler`: etwas ging nicht. `hinweis` (Vorgabe): alles andere. */
  tone?: Ton;
  /** Überschreibt das Zeichen des Tons; die Farbe bleibt die des Tons. */
  icon?: LucideIcon;
  /** Der Text — ein oder zwei Sätze. */
  children: ReactNode;
  /** Ein oder zwei Knöpfe `variant="text"`, abweisend zuerst. */
  actions?: ReactNode;
  /** Vorgabe: `alert` beim Fehler ohne Knöpfe, sonst `status`. */
  role?: "alert" | "status";
  className?: string;
}) {
  const Icon = icon ?? zeichen[tone].icon;
  return (
    <div
      role={role ?? (tone === "fehler" && !actions ? "alert" : "status")}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-linie bg-on-surface/5 py-2 pl-4",
        // Knöpfe bringen ihre eigene Polsterung mit; Text allein braucht den
        // vollen Rand.
        actions ? "pr-2" : "pr-4",
        className,
      )}
    >
      <div className="flex min-w-0 basis-80 grow items-start gap-4 py-2">
        <span className={cn("flex size-10 shrink-0 items-center justify-center", zeichen[tone].farbe)}>
          <Icon size={24} strokeWidth={2} aria-hidden />
        </span>
        {/* Die erste Zeile mittig zum 40-px-Zeichen, weitere laufen darunter. */}
        <div className="type-body-medium min-w-0 pt-2.5 text-on-surface">{children}</div>
      </div>
      {actions && <div className="ml-auto flex flex-wrap justify-end gap-2">{actions}</div>}
    </div>
  );
}
