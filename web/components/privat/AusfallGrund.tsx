/** Der Grund eines Ausfalls am privaten Link (#530) — an Training und Spiel
 *  gleich: im Kopf unter dem Ort, mit «Grund:» davor und vollständig, ohne
 *  Kürzung (AK 4). Ohne Grund nichts; die Lozenge sagt schon «Fällt aus». */
export function AusfallGrund({ grund }: { grund: string | null }) {
  if (!grund) return null;
  return <p className="max-w-full whitespace-pre-line break-words type-body-small text-on-surface">Grund: {grund}</p>;
}
