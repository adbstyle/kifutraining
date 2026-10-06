"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { versionAnker } from "@/lib/versionen-anker";

/* Das Inhaltsverzeichnis neben den Versionen (ab `lg`): je Version Nummer und
   Thema als Sprung zu ihrem Text. Hervorgehoben ist die Version, deren Text
   gerade oben im Fenster steht — so weiss man beim Scrollen, wo man ist. Es
   klebt unter der Kopfzeile und scrollt für sich, wenn es länger ist als das
   Fenster; die hervorgehobene Zeile bleibt darin sichtbar. Wo es steht und
   wie breit, regelt VersionenFlaeche. */
export function VersionenVerzeichnis({
  eintraege,
}: {
  /** `href` nur, wo der Text nicht auf der Seite steht (ältere Versionen,
   *  die erst `?alle=1` zeigt); sonst ist es die Sprungmarke. */
  eintraege: { version: string; titel: string; href?: string }[];
}) {
  const [aktiv, setzeAktiv] = useState<string | undefined>(eintraege[0]?.version);

  useEffect(() => {
    const ziele = eintraege
      .map((e) => document.getElementById(versionAnker(e.version)))
      .filter((el): el is HTMLElement => !!el);
    // Aktuell ist der unterste Text, dessen Anfang das obere Drittel des
    // Fensters erreicht hat — am Seitenende der letzte, den sonst ein kurzer
    // Text nie erreichte. Die Texte stehen der Reihe nach untereinander, also
    // genügt eine binäre Suche. Geprüft wird beim Laden, beim Scrollen
    // (höchstens einmal pro Bild), bei Grössenänderung und nach einem Sprung.
    let bild = 0;
    const pruefe = () => {
      bild = 0;
      if (ziele.length === 0) return;
      const amEnde =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let index = 0;
      if (amEnde) index = ziele.length - 1;
      else {
        const linie = window.innerHeight / 3;
        let von = 0;
        let bis = ziele.length - 1;
        while (von <= bis) {
          const mitte = (von + bis) >> 1;
          if (ziele[mitte].getBoundingClientRect().top <= linie) {
            index = mitte;
            von = mitte + 1;
          } else bis = mitte - 1;
        }
      }
      setzeAktiv(ziele[index].dataset.version);
    };
    const plane = () => {
      if (!bild) bild = requestAnimationFrame(pruefe);
    };
    pruefe();
    window.addEventListener("scroll", plane, { passive: true });
    window.addEventListener("resize", plane);
    window.addEventListener("hashchange", plane);
    return () => {
      cancelAnimationFrame(bild);
      window.removeEventListener("scroll", plane);
      window.removeEventListener("resize", plane);
      window.removeEventListener("hashchange", plane);
    };
  }, [eintraege]);

  // Die hervorgehobene Zeile im Verzeichnis sichtbar halten — nur das
  // Verzeichnis scrollt dafür, nie das Fenster (`scrollIntoView` täte beides).
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const zeile = nav?.querySelector<HTMLElement>(`[data-verzeichnis="${aktiv}"]`);
    if (!nav || !zeile) return;
    const oben = zeile.offsetTop; // relativ zum Verzeichnis: `sticky` ist positioniert
    if (oben < nav.scrollTop) nav.scrollTop = oben;
    else if (oben + zeile.offsetHeight > nav.scrollTop + nav.clientHeight) {
      nav.scrollTop = oben + zeile.offsetHeight - nav.clientHeight;
    }
  }, [aktiv]);

  return (
    <nav
      ref={navRef}
      aria-label="Versionen"
      className="sticky top-16 max-h-[calc(100dvh-5rem)] overflow-y-auto print:hidden"
    >
      <ol className="flex flex-col gap-0.5">
        {eintraege.map((e) => {
          const istAktiv = e.version === aktiv;
          return (
            <li key={e.version}>
              <a
                href={e.href ?? `#${versionAnker(e.version)}`}
                data-verzeichnis={e.version}
                aria-current={istAktiv ? "location" : undefined}
                className={cn(
                  "focus-ring-inset state flex flex-col rounded-flaeche px-2.5 py-1.5 transition-colors",
                  istAktiv ? "bg-elev-08 text-on-surface" : "text-on-surface-mittel hover:text-on-surface",
                )}
              >
                <span className={cn("type-body-small", istAktiv && "text-primary")}>{e.version}</span>
                <span className="type-body-medium truncate">{e.titel}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
