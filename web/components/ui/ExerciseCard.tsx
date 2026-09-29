import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { HerkunftBadge } from "./Badge";
import { Card } from "./Card";
import { UebungsBild } from "./UebungsBild";

/** Eine Angabe der Eckdaten-Zeile. `vorgelesen` ersetzt für die
 *  Sprachausgabe einen abgekürzten Text («4–8 Sp.» → «4–8 Spieler:innen»). */
export interface Eckdatum {
  text: string;
  vorgelesen?: string;
}

export interface ExerciseCardData {
  slug: string;
  name: string;
  /** Eckdaten unter dem Titel, fertig beschriftet und geordnet; der
   *  Feature-Layer entscheidet, welche Angaben eine Übung trägt (#305). */
  eckdaten: Eckdatum[];
  herkunft: "manual" | "user";
  visibility?: "public" | "private";
  bildUrl?: string | null;
  diagramm?: unknown;
  bildQuelle?: "foto" | "diagramm" | null;
}

export function ExerciseCard({
  ex,
  actionSlot,
}: {
  ex: ExerciseCardData;
  /** Optionaler Aktions-Slot oben rechts (z. B. Favoriten-Button). Wird vom
   *  Feature-Layer befüllt, damit dieses UI-Kit domänenfrei bleibt. */
  actionSlot?: ReactNode;
}) {
  return (
    <Card className="group overflow-hidden">
      {/* Die ganze Karte ist eine Trefferfläche — darum trägt der Link die
          Zustands-Ebene (`state`) und nicht der Kartenrand: die Karte hat
          keinen mehr, und ein Overlay über der gesamten Fläche zeigt
          deutlicher, was angefasst wird, als ein aufgehellter Strich. */}
      <Link
        href={`/uebung/${ex.slug}`}
        className="state focus-ring-inset block rounded-flaeche"
      >
        {/* Aktives Bild: Diagramm, Foto oder Platzhalter */}
        <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-linie">
          <UebungsBild
            name={ex.name}
            bildUrl={ex.bildUrl}
            diagramm={ex.diagramm}
            bildQuelle={ex.bildQuelle}
            sizes="(max-width: 640px) 100vw, 320px"
          />

          {/* Lesbarkeits-Scrim für die Overlays oben — auf der dunklen
              Platzhalter-Skizze kaum sichtbar, sorgt auf hellen
              Diagramm-Bildern für Kontrast. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-scrim/55 to-transparent"
          />

          {/* Herkunft oben links: Beim Überfliegen einer Kachelreihe ist die
              erste Frage, ob eine Übung aus dem Manual kommt, aus der
              Gemeinschaft oder noch der eigene Entwurf ist; die
              Alterskategorien stehen in den Eckdaten unter dem Titel (#305).
              Der Aktions-Slot liegt oben rechts
              (ausserhalb des Links, s. u.); beide deckt derselbe Verlauf. */}
          <div className="absolute left-2 top-2">
            <HerkunftBadge herkunft={ex.herkunft} visibility={ex.visibility} />
          </div>
        </div>

        {/* Inhalt */}
        <div className="p-3">
          <h3 className="type-title-medium text-on-surface transition-colors group-hover:text-primary">
            {ex.name}
          </h3>
          {/* Eckdaten: höchstens zwei Zeilen, was nicht passt, endet in
              Auslassungspunkten (#305 AK 14/15) — so bleiben die Kacheln
              einer Reihe gleich hoch, auch mit langer Einordnung. */}
          <p className="type-body-medium mt-1 line-clamp-2 text-on-surface-mittel">
            {ex.eckdaten.map((e, i) => (
              <Fragment key={i}>
                {i > 0 && " · "}
                {e.vorgelesen ? (
                  <>
                    <span aria-hidden="true">{e.text}</span>
                    <span className="sr-only">{e.vorgelesen}</span>
                  </>
                ) : (
                  e.text
                )}
              </Fragment>
            ))}
          </p>
        </div>
      </Link>

      {/* Aktions-Slot als Geschwister des Links (kein <button> in <a>),
          oben rechts über dem Diagramm. Inhalt liefert der Feature-Layer. */}
      {actionSlot && (
        <div className="absolute right-2 top-2 z-10">{actionSlot}</div>
      )}
    </Card>
  );
}
