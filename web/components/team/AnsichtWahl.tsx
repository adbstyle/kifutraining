import Link from "next/link";
import { CalendarDays, List } from "lucide-react";
import { ButtonGroup, segmentClasses } from "@/components/ui";
import type { Ansicht } from "@/lib/team-ansicht";

/** Liste oder Monat — eine verbundene Knopfgruppe nur mit Zeichen, ohne
 *  Tooltip; der Name steht im zugänglichen Namen. Links, damit die Eingrenzung
 *  auf die eigenen Termine in der Adresse mitreist (#329 PC 4, AK 12). */
export function AnsichtWahl({ ansicht, hrefListe, hrefMonat }: { ansicht: Ansicht; hrefListe: string; hrefMonat: string }) {
  const glieder = [
    { wert: "liste", name: "Liste", href: hrefListe, icon: List },
    { wert: "monat", name: "Monat", href: hrefMonat, icon: CalendarDays },
  ] as const;
  return (
    <nav aria-label="Ansicht des Trainingsplans">
      <ButtonGroup ariaLabel="Ansicht">
        {glieder.map(({ wert, name, href, icon: Icon }) => (
          <Link
            key={wert}
            href={href}
            scroll={false}
            aria-label={name}
            aria-current={ansicht === wert ? "page" : undefined}
            className={segmentClasses(ansicht === wert)}
          >
            <Icon size={18} aria-hidden />
          </Link>
        ))}
      </ButtonGroup>
    </nav>
  );
}
