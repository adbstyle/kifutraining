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
        <strong className="text-on-surface">Apple Kalender:</strong>{" "}
        <ButtonLink variant="text" href={webcal}>
          <ExternalLink size={14} aria-hidden /> Direkt öffnen
        </ButtonLink>{" "}
        oder Ablage → Neues Kalenderabonnement → {begriff} einfügen.
      </li>
      <li>
        <strong className="text-on-surface">Google Kalender:</strong> Weitere Kalender → Per URL →{" "}
        {begriff} einfügen.
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
