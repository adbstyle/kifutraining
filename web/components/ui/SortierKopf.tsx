import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

/* Spaltenkopf einer echten Tabelle (`<th scope="col">`), wahlweise
   sortierbar (Trainingsübersicht, #629). Neu im Kit, weil es keine
   sortierbare Tabelle gab: Die `Tabelle` ist eine Liste mit Kopf nur fürs
   Auge (aria-hidden) und kann weder Sortierung noch Spaltenbezug vorlesen.

   Sortierbar ist ein Kopf mit `href`: Er wird ein Link, der die Sortierung in
   die Adresse schreibt — die Seite sortiert auf dem Server, die Wahl
   übersteht so Neuladen und geteilte Links. Welche Adresse ein Klick wählt
   (Richtung umkehren oder neue Spalte), entscheidet der Aufrufer; der Kopf
   bleibt domänenfrei. `scroll={false}`: Die Liste ordnet sich um, die Seite
   springt nicht nach oben.

   Erkennbar ist die Sortierung zweifach (#629 AK 6, NFR 2): fürs Auge der
   Pfeil in Primary an der aktiven Spalte (aufwärts = aufsteigend), die
   übrigen sortierbaren Köpfe tragen den Doppelpfeil gedämpft; für
   Vorlesehilfen `aria-sort` am Kopf. Per Tastatur ist jeder Kopf ein
   gewöhnlicher Link (Tab, Enter).

   Ohne `href` ein schlichter Kopf in derselben Gestalt — so stehen
   sortierbare und feste Spalten in einer Zeile gleich. */
export function SortierKopf({
  children,
  href,
  richtung = null,
  ausrichtung = "start",
  className,
}: {
  /** Der Spaltenname. */
  children: React.ReactNode;
  /** Die Adresse, die ein Klick wählt; ohne Angabe ist die Spalte nicht
   *  sortierbar. */
  href?: string;
  /** Die Richtung, wenn nach dieser Spalte sortiert ist; sonst `null`. */
  richtung?: "auf" | "ab" | null;
  /** Zahlenspalten stehen rechtsbündig, ihr Kopf mit. */
  ausrichtung?: "start" | "end";
  className?: string;
}) {
  const ariaSort = !href ? undefined : richtung === "auf" ? "ascending" : richtung === "ab" ? "descending" : "none";
  const Pfeil = richtung === "auf" ? ArrowUp : richtung === "ab" ? ArrowDown : ArrowUpDown;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        "px-2 py-1 type-label-small font-normal text-on-surface-mittel first:pl-4 last:pr-4",
        ausrichtung === "end" ? "text-right" : "text-left",
        className,
      )}
    >
      {href ? (
        <Link
          href={href}
          scroll={false}
          className={cn(
            "state focus-ring -mx-1 inline-flex min-h-8 items-center gap-1 rounded-klein px-1",
            ausrichtung === "end" && "flex-row-reverse",
            richtung ? "text-on-surface" : "text-on-surface-mittel",
          )}
        >
          <span>{children}</span>
          <Pfeil
            size={14}
            strokeWidth={2}
            aria-hidden
            className={cn("shrink-0", richtung && "text-primary")}
          />
        </Link>
      ) : (
        <span className="inline-flex min-h-8 items-center">{children}</span>
      )}
    </th>
  );
}
