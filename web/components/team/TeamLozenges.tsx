import { Lozenge } from "@/components/ui";

/** Teams als Plaketten nebeneinander, umbrechend (Story #579): «Auch in» in
 *  der Spielerliste eines Teams, «Teams» in der Liste des Vereins. Neutral
 *  und nur mit dem Namen — wie die Kader (`KaderLozenges`), nur ohne deren
 *  «ehemalig»-Fall; kein neuer Baustein, die Plakette ist die des Kits. */
export function TeamLozenges({
  namen,
  ids,
  className,
}: {
  namen: readonly string[];
  /** Die Team-IDs in derselben Reihenfolge, wo die Liste sie kennt. */
  ids?: readonly string[];
  className?: string;
}) {
  if (namen.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className ?? ""}`}>
      {/* Teamnamen sind nicht eindeutig: die ID, sonst die Stelle. */}
      {namen.map((n, i) => (
        <Lozenge key={ids?.[i] ?? i} appearance="neutral" title={n}>
          {n}
        </Lozenge>
      ))}
    </span>
  );
}
