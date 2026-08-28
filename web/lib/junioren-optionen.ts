import { schemaAusStufen, JUNIOREN_TEILE, NACHARBEIT } from "@/lib/junioren";
import { TRAININGSTEILE } from "@/lib/training";

/** Die Einordnungen, unter denen eine Fassung in ihrem Training wählen kann.
 *
 *  Das sind die Blöcke ihres Trainingsschemas — im Juniorenschema nach
 *  Trainingsteilen gruppiert, weil «Hauptteil» und «Ausklang» in beiden Welten
 *  vorkommen. Liegt die Fassung in der Nacharbeit, steht diese zusätzlich zur
 *  Wahl: sonst könnte das Formular ihren Ist-Zustand nicht abbilden und der
 *  Trainer sähe eine falsche Auswahl (Epic #71). */
export function einordnungsOptionenFuer(
  stufen: readonly string[],
  aktuelle?: string,
): { value: string; label: string; group?: string }[] {
  const optionen =
    schemaAusStufen(stufen) === "junioren"
      ? JUNIOREN_TEILE.flatMap((teil) =>
          teil.bloecke.map((b) => ({ value: b.slug, label: b.label, group: teil.label })),
        )
      : TRAININGSTEILE.map((t) => ({ value: t.slug, label: t.label }));

  return aktuelle === NACHARBEIT
    ? [...optionen, { value: NACHARBEIT, label: "Nacharbeit", group: "Ohne Entsprechung" }]
    : optionen;
}
