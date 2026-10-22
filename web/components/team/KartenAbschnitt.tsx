/* Ein Abschnitt einer grossen Terminkarte (Epic #490): Trenner, kleine
   Überschrift in Versalien, daneben ein Zusatz (etwa die Kader), darunter der
   Inhalt — TEAM, PLATZ, TREFFPUNKTE, BEMERKUNG. Geteilt von der Karte «Als
   Nächstes» im Trainingsplan und der Spielkarte am privaten Link. `ebene`:
   die Überschrift passend zur Seite. */
export function KartenAbschnitt({
  titel,
  zusatz,
  ebene = "h5",
  children,
}: {
  titel: string;
  zusatz?: React.ReactNode;
  ebene?: "h4" | "h5";
  children: React.ReactNode;
}) {
  const Ueberschrift = ebene;
  return (
    <section className="flex flex-col gap-2 border-t border-linie pt-3.5">
      {/* So hoch wie eine Lozenge, damit Abschnitte nebeneinander mit und
          ohne Zusatz auf gleicher Höhe beginnen. */}
      <div className="flex min-h-5 flex-wrap items-center gap-2">
        <Ueberschrift className="type-label-medium uppercase tracking-wider text-on-surface-mittel">{titel}</Ueberschrift>
        {zusatz}
      </div>
      {children}
    </section>
  );
}
