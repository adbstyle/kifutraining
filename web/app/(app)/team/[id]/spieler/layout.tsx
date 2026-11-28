import { SpielerBereicheNav } from "@/components/team/SpielerBereicheNav";

/* Der Rahmen der Spieler:innen eines Teams (#704): die Überschrift und die
 * Reiter über den Sichten. Die Anzahl nennt die Liste selbst; der Rahmen kennt
 * sie nicht. Den Zugriff prüft der Team-Rahmen darüber (team/[id]/layout.tsx);
 * jede Sicht lädt nur, was sie zeigt. */
export default async function TeamSpielerLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="type-title-large text-on-surface">Spieler:innen</h2>
      <SpielerBereicheNav teamId={id} />
      {children}
    </div>
  );
}
