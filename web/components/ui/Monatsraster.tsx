import { cn } from "@/lib/cn";
import { monatsRaster, tagText } from "@/lib/monat";

const WOCHENTAGE = [
  ["Mo", "Montag"],
  ["Di", "Dienstag"],
  ["Mi", "Mittwoch"],
  ["Do", "Donnerstag"],
  ["Fr", "Freitag"],
  ["Sa", "Samstag"],
  ["So", "Sonntag"],
] as const;

/* Ein Monat als Raster Montag bis Sonntag; der Inhalt eines Tages kommt vom
   Aufrufer. Die Randwochen zeigen die Tage der Nachbarmonate auf dem Grund,
   mit leiserer Tageszahl — Einträge behalten ihren vollen Kontrast.

   Bewusst eine TABELLE und kein Gitter (kein role="grid"): Das Raster wird
   gelesen, nicht mit Pfeiltasten durchwandert — die Bedienelemente in den
   Tagen sind gewöhnliche Knöpfe in der Tab-Reihenfolge. Ein «grid» versprächt
   Pfeiltasten-Navigation, die es hier nicht gibt. Darum role="table" mit
   Zeilen, Spaltenköpfen und Zellen, auf Blöcken statt <table>, weil die leere
   Woche eine gerundete, gestrichelte Zeile trägt.

   Schmal scrollt das Raster waagrecht im eigenen Behälter, nie die Seite. Der
   Tag kommt auch für Screenreader als ausgeschriebenes Datum (die sichtbare
   Zahl ist stumm geschaltet), «heute» als `aria-current`. Eine leere Woche
   trägt die Kennzeichnung sichtbar (gestrichelt) und als Text. */
export function Monatsraster({
  monat,
  heute,
  renderTag,
  leereWoche,
  label,
}: {
  /** `YYYY-MM`. */
  monat: string;
  /** Der heutige Kalendertag (`YYYY-MM-DD`) — er bekommt die Kontur. */
  heute: string;
  renderTag: (tag: string) => React.ReactNode;
  /** Ist diese Woche (ihre sieben Kalendertage) leer? Dann trägt die Zeile eine Kennzeichnung. */
  leereWoche?: (tage: string[]) => boolean;
  /** Benennt den Behälter (Region), etwa den Monatsnamen; die Tabelle darin trägt keinen zweiten Namen. */
  label: string;
}) {
  const wochen = monatsRaster(monat);
  // `relative`: ohne eigenen Bezug entkommen die sr-only-Texte (absolut) dem
  // Scroll-Behälter und weiten auf dem Handy die ganze Seite.
  return (
    <div role="region" aria-label={label} className="relative overflow-x-auto">
      {/* Die Zeilen tragen immer eine Kontur (durchsichtig), damit die leere
          Woche mit ihrer sichtbaren die Spalten nicht verschiebt. */}
      <div role="table" className="flex min-w-[36rem] flex-col gap-px">
        <div role="row" className="kontur grid grid-cols-7 gap-px border-transparent text-center type-body-small text-on-surface-mittel">
          {WOCHENTAGE.map(([kurz, lang]) => (
            <div role="columnheader" key={kurz} className="py-1">
              <span aria-hidden>{kurz}</span>
              <span className="sr-only">{lang}</span>
            </div>
          ))}
        </div>
        {wochen.map((w) => {
          const leer = leereWoche?.(w.map((d) => d.tag)) ?? false;
          return (
            <div
              role="row"
              key={w[0].tag}
              className={cn(
                "kontur grid grid-cols-7 gap-px rounded-flaeche",
                leer ? "border-dashed border-kante" : "border-transparent",
              )}
            >
              {w.map(({ tag, imMonat }, i) => (
                <div
                  role="cell"
                  key={tag}
                  aria-current={tag === heute ? "date" : undefined}
                  className={cn(
                    "min-h-24 min-w-0 p-1",
                    // Die Tage der Nachbarmonate liegen auf dem Grund statt auf
                    // der Tagesfläche — NICHT über `opacity` gedämpft: Das risse
                    // die Schrift der Einträge unter 4.5:1.
                    imMonat ? "bg-elev-01" : "bg-elev-00",
                    tag === heute && "kontur border-primary",
                  )}
                >
                  {leer && i === 0 && <span className="sr-only">Woche ohne Termin. </span>}
                  <div className={cn("type-body-small", imMonat ? "text-on-surface" : "text-on-surface-mittel")} aria-hidden>
                    {Number(tag.slice(8))}
                  </div>
                  <span className="sr-only">{tagText(tag)}{tag === heute ? ", heute" : ""}. </span>
                  {renderTag(tag)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
