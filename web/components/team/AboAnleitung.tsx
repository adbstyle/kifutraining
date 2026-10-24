import { ExternalLink } from "lucide-react";
import { ButtonLink } from "@/components/ui";

/* Wie man eine Abo-Adresse in Apple Kalender, Google Kalender, Outlook und
   Proton Calendar übernimmt (#330 AK 2, #507 AK 4) — geteilt vom Abo der
   Mitglieder und dem der Spielervertretung. Apple öffnet das Abonnement über
   `webcal:` direkt. `begriff` heisst, was eingefügt wird — am privaten Link
   die «Abo-Adresse», damit niemand den privaten Link selbst einfügt. */
export function AboAnleitung({ webcal, begriff = "Link" }: { webcal: string; begriff?: string }) {
  return (
    <ul className="type-body-small list-disc space-y-1 pl-5">
      <li>
        <strong className="text-on-surface">Apple Kalender:</strong> auf iPhone, iPad und Mac direkt
        öffnen, oder am Mac Ablage → Neues Kalenderabonnement → {begriff} einfügen.
        {/* Secondary Button (PO 2026-10-24): der kürzeste Weg auf dem iPhone. */}
        <div className="mt-2">
          <ButtonLink variant="outlined" href={webcal}>
            <ExternalLink size={16} aria-hidden /> In Apple Kalender öffnen
          </ButtonLink>
        </div>
      </li>
      <li>
        {/* Die App kann keine Abo-Adresse hinzufügen, auch nicht auf Android:
            nur calendar.google.com im Browser (PO 2026-10-24). */}
        <strong className="text-on-surface">Google Kalender:</strong> im Browser auf calendar.google.com →
        Weitere Kalender → Per URL → {begriff} einfügen; danach erscheint er auch in der App.
      </li>
      <li>
        <strong className="text-on-surface">Outlook:</strong> Kalender hinzufügen → Aus dem Internet
        abonnieren → {begriff} einfügen.
      </li>
      <li>
        <strong className="text-on-surface">Proton Calendar:</strong> Kalender hinzufügen → Über Link
        hinzufügen → {begriff} einfügen.
      </li>
    </ul>
  );
}
