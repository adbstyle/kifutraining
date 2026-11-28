import { SectionMessage } from "@/components/ui";
import { KopfAktionen } from "@/components/layout/KopfAktionen";
import { SpielerBereicheNav } from "@/components/team/SpielerBereicheNav";
import { SpielerHinzufuegen } from "@/components/team/SpielerHinzufuegen";
import { TeamSeite } from "@/components/team/TeamSeite";
import { SPIELER_GESPERRT_ID, SPIELER_SPERRE } from "@/lib/spieler";
import { TEAM_SEITEN } from "@/lib/team-bereiche";
import { ladeHinzufuegen } from "@/lib/team-spieler-seite";

/* Der Rahmen der Spieler:innen eines Teams (#704, #706): die Kopfzeile mit
 * «Spieler:innen» als letzter Brotkrume — in jedem Reiter, den zeigt die
 * Reiterleiste — und «Spieler:in hinzufügen» als Hauptaktion, darunter
 * direkt die Reiter über den Sichten. Er bleibt beim Reiterwechsel stehen;
 * nach dem Hinzufügen lädt `router.refresh()` ihn samt Sperre neu.
 *
 * Ist die Spielerliste des Teams oder der Spielerbestand des Vereins voll,
 * bleibt der Knopf gesperrt sichtbar, und der Satz mit dem Grund steht unter
 * den Reitern (AK 7). Die Anzahl nennt jede Sicht selbst über ihrer Liste.
 * Den Zugriff prüft das Team-Layout darüber; jede Sicht lädt nur, was sie
 * zeigt. */
export default async function TeamSpielerLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const { kader, sperre } = await ladeHinzufuegen(id);
  return (
    <TeamSeite
      teamId={id}
      seite={TEAM_SEITEN.spieler}
      aktionen={<KopfAktionen haupt={<SpielerHinzufuegen teamId={id} kader={kader} sperre={sperre} />} />}
    >
      <div className="flex flex-col gap-4">
        {/* Keine sichtbare Überschrift: «Spieler:innen» steht in der Brotkrume. */}
        <h2 className="sr-only">{TEAM_SEITEN.spieler}</h2>
        <SpielerBereicheNav teamId={id} />
        {sperre && (
          <div id={SPIELER_GESPERRT_ID}>
            <SectionMessage>{SPIELER_SPERRE[sperre]}</SectionMessage>
          </div>
        )}
        {children}
      </div>
    </TeamSeite>
  );
}
