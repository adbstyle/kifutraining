import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { gliederungBloecke, type GliederungInline } from "@/lib/gliederung";
import { textMitLinks } from "@/lib/text-links";
import { ExternerLink } from "./ExternerLink";

/* ── GegliederterText ─────────────────────────────────────────
   Ein Text, den Trainer:innen selbst gliedern: Zwischentitel, Aufzählungen,
   nummerierte Punkte, Hervorhebung (#598, die Infos zum Team). Die Regeln
   stehen in `lib/gliederung.ts`; hier nur die Darstellung.

   Neu, weil `Freitext` nur Listen kennt (bewusst kein Markdown) und
   `ReleaseText` fertiges Markdown aus dem Repository zeigt — samt Links mit
   Linktext, die hier nicht vorkommen dürfen (OoS 1). Webadressen werden zu
   externen Links (`ExternerLink`). Alles läuft als React-Text — eingegebenes
   HTML erscheint als Text und wird nie ausgeführt.

   `titelEbene`: die Überschriftenebene der Zwischentitel, eine unter der
   Überschrift, unter der der Text steht. */
export function GegliederterText({
  text,
  titelEbene = 3,
  className,
}: {
  text: string;
  titelEbene?: 3 | 4;
  className?: string;
}) {
  const Titel = titelEbene === 3 ? "h3" : "h4";
  return (
    <div className={cn("type-body-medium flex flex-col gap-3 break-words text-on-surface", className)}>
      {gliederungBloecke(text).map((b, i) =>
        b.art === "titel" ? (
          <Titel key={i} className="type-title-small mt-1 text-on-surface">
            <Zeile teile={b.text} />
          </Titel>
        ) : b.art === "absatz" ? (
          <p key={i}>
            {b.zeilen.map((z, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Zeile teile={z} />
              </Fragment>
            ))}
          </p>
        ) : b.art === "aufzaehlung" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.punkte.map((p, j) => (
              <li key={j}>
                <Zeile teile={p} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} start={b.start} className="list-decimal space-y-1 pl-5">
            {b.punkte.map((p, j) => (
              <li key={j}>
                <Zeile teile={p} />
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

function Zeile({ teile }: { teile: GliederungInline[] }) {
  return teile.map((t, i) => {
    const inhalt = textMitLinks(t.text).map((s, j) =>
      s.art === "link" ? (
        <ExternerLink key={j} href={s.href}>
          {s.text}
        </ExternerLink>
      ) : (
        <Fragment key={j}>{s.text}</Fragment>
      ),
    );
    return t.art === "fett" ? (
      <strong key={i} className="font-semibold">
        {inhalt}
      </strong>
    ) : (
      <Fragment key={i}>{inhalt}</Fragment>
    );
  });
}
