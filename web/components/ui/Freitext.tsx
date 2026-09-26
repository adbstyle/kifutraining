import { cn } from "@/lib/cn";
import { freitextBloecke } from "@/lib/freitext";

/* Ein Freitext mit einfachen Listen (Story #282): Ablauf und Varianten einer
   Übung. Die Regeln stehen in `lib/freitext.ts`; hier nur die Darstellung.

   Text trägt seine Zeilenumbrüche selbst (whitespace-pre-line), Listen stehen
   wie die Üben-Schritte im methodischen Fahrplan. Alles läuft als React-Text
   — eingegebenes HTML erscheint als Text und wird nie ausgeführt (NFR 2). */
export function Freitext({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("type-body-large flex flex-col gap-3 text-on-surface", className)}>
      {freitextBloecke(text).map((b, i) =>
        b.art === "text" ? (
          <p key={i} className="whitespace-pre-line">
            {b.text}
          </p>
        ) : b.art === "aufzaehlung" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.punkte.map((p, j) => (
              <li key={j}>{p}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} start={b.start} className="list-decimal space-y-1 pl-5">
            {b.punkte.map((p, j) => (
              <li key={j}>{p}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
