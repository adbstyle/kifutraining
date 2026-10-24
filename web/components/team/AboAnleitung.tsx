/* Wie man eine Abo-Adresse in Apple Kalender, Google Kalender, Outlook und
   Proton Calendar übernimmt (#330 AK 2, #507 AK 4) — geteilt vom Abo der
   Mitglieder und dem der Spielervertretung. `begriff` heisst, was eingefügt
   wird — am privaten Link die «Abo-Adresse», damit niemand den privaten Link
   selbst einfügt. Kein Direkt-Öffnen per `webcal:` (PO 2026-10-24): Es wirkt
   nur auf Apple-Geräten. */
export function AboAnleitung({ begriff = "Link" }: { begriff?: string }) {
  return (
    <ul className="type-body-small list-disc space-y-1 pl-5">
      <li>
        <strong className="text-on-surface">Apple Kalender:</strong> am iPhone Kalender → Kalender hinzufügen →
        Kalenderabonnement hinzufügen, am Mac Ablage → Neues Kalenderabonnement → {begriff} einfügen.
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
