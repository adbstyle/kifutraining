import { ChevronRight } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { LinkStandLozenge } from "@/components/team/LinkStandLozenge";
import { LINK_STAENDE, LINK_UEBERSICHT, zaehleLinkStaende, type LinkStand } from "@/lib/spieler";
import { teamSpielerHref } from "@/lib/team-spielerliste";

/* Die Übersicht der Link-Stände im Reiter «Privater Link» (#658, #704): wie viele
   Spieler:innen des Teams — Schnuppernde eingeschlossen — einen abgeholten,
   einen zugestellten und einen offenen Link haben (AK 1), und der Sprung in
   die Spielerliste, eingegrenzt auf die offenen (AK 2, Eingrenzung aus #601).

   Kein neuer Baustein: dieselbe Fläche wie die Selbstabholung daneben
   (`rounded-flaeche bg-elev-01`), je Stand die Lozenge, die auch der
   Link-Dialog und die Spielerliste des Vereins zeigen (LinkStandLozenge), und
   ein `outlined`-ButtonLink als Sprung. Server-Komponente: Die Zahlen sind,
   was die Seite beim Rendern sah. Bei null offenen Links fällt der Sprung
   weg — die eingegrenzte Liste wäre leer. */
export function LinkUebersicht({ teamId, spieler }: { teamId: string; spieler: readonly { linkStand: LinkStand }[] }) {
  const zahl = zaehleLinkStaende(spieler);
  return (
    <section aria-labelledby="link-uebersicht" className="flex flex-col gap-3 rounded-flaeche bg-elev-01 p-4">
      <h3 id="link-uebersicht" className="type-title-medium text-on-surface">
        {LINK_UEBERSICHT.titel}
      </h3>
      <p className="type-body-medium text-on-surface-mittel">{LINK_UEBERSICHT.einleitung}</p>
      <dl className="divide-y divide-linie border-y border-linie">
        {LINK_STAENDE.map((stand) => (
          <div key={stand} className="flex min-h-11 items-center gap-3 py-2">
            <dt className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              <LinkStandLozenge stand={stand} />
              <span className="type-body-medium text-on-surface-mittel">{LINK_UEBERSICHT.beschreibung[stand]}</span>
            </dt>
            <dd className="type-title-medium tabular-nums text-on-surface">{zahl[stand]}</dd>
          </div>
        ))}
      </dl>
      {zahl.offen > 0 && (
        <ButtonLink variant="outlined" href={teamSpielerHref(teamId, { linkStaende: ["offen"] })} className="self-start">
          {LINK_UEBERSICHT.offeneZeigen(zahl.offen)}
          <ChevronRight size={16} strokeWidth={2} aria-hidden />
        </ButtonLink>
      )}
      <p className="type-body-small text-on-surface-mittel">{LINK_UEBERSICHT.hinweis}</p>
    </section>
  );
}
