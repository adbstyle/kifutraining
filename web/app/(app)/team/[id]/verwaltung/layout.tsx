import { TeamBereicheNav } from "@/components/team/TeamBereicheNav";

/* Der Rahmen der Team-Verwaltung (#656): die Reiter über den vier Bereichen.
 * Den Zugriff prüft der Team-Rahmen darüber (team/[id]/layout.tsx); jeder
 * Bereich lädt nur, was er zeigt. */
export default async function TeamVerwaltungLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-4">
      <TeamBereicheNav teamId={id} />
      {children}
    </div>
  );
}
