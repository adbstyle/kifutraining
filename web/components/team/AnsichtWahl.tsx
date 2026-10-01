import Link from "next/link";
import { CalendarDays, List } from "lucide-react";
import { buttonClasses } from "@/components/ui";
import type { Ansicht } from "@/lib/team-ansicht";

/** Liste oder Monat — als Links, damit die Eingrenzung auf die eigenen
 *  Termine in der Adresse mitreist (#329 PC 4, AK 12). */
export function AnsichtWahl({ ansicht, hrefListe, hrefMonat }: { ansicht: Ansicht; hrefListe: string; hrefMonat: string }) {
  return (
    <nav aria-label="Ansicht des Trainingsplans" className="flex gap-1">
      <Link href={hrefListe} scroll={false} aria-current={ansicht === "liste" ? "page" : undefined} className={buttonClasses(ansicht === "liste" ? "tonal" : "text", "sm")}>
        <List size={16} aria-hidden /> Liste
      </Link>
      <Link href={hrefMonat} scroll={false} aria-current={ansicht === "monat" ? "page" : undefined} className={buttonClasses(ansicht === "monat" ? "tonal" : "text", "sm")}>
        <CalendarDays size={16} aria-hidden /> Monat
      </Link>
    </nav>
  );
}
