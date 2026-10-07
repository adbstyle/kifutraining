"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface VerzeichnisEintrag {
  /** Die Sprungmarke des Abschnitts auf der Seite. */
  id: string;
  titel: string;
  /** Kleine Zeile über dem Titel, z. B. die Versionsnummer. */
  zusatz?: string;
  /** Nur, wo der Abschnitt nicht auf der Seite steht (etwa ältere Versionen,
   *  die erst `?alle=1` zeigt); sonst führt der Eintrag zur Sprungmarke. */
  href?: string;
}

/** Einträge unter einem Untertitel (Atlassian: «Forms and inputs»). */
export interface VerzeichnisGruppe {
  titel?: string;
  eintraege: readonly VerzeichnisEintrag[];
}

/** Ein Obertitel (Material: «Foundations», «Styles»), auf- und zuklappbar.
 *  Ohne Titel stehen die Gruppen ohne Kopf da — so trägt «Versionen» eine
 *  flache Liste. */
export interface VerzeichnisBereich {
  titel?: string;
  gruppen: readonly VerzeichnisGruppe[];
}

/* Das Inhaltsverzeichnis neben einer langen Seite (ab `lg`): je Abschnitt ein
   Sprung zu seinem Text, gegliedert in Obertitel und Untertitel. Hervor-
   gehoben ist der Abschnitt, der gerade oben im Fenster steht — so weiss man
   beim Scrollen, wo man ist. Es klebt unter der Kopfzeile und scrollt für
   sich, wenn es länger ist als das Fenster; die hervorgehobene Zeile bleibt
   darin sichtbar. Wo es steht und wie breit, regelt VerzeichnisFlaeche.

   Die Obertitel klappen, die Untertitel nicht: Sie benennen nur, was folgt.
   Steht der aktuelle Abschnitt in einem zugeklappten Bereich, trägt dessen
   Titel den Akzent. */
export function Verzeichnis({
  name,
  bereiche,
}: {
  /** Name der Navigation für Screenreader, z. B. «Versionen». */
  name: string;
  bereiche: readonly VerzeichnisBereich[];
}) {
  const ids = useMemo(
    () => bereiche.flatMap((b) => b.gruppen.flatMap((g) => g.eintraege.map((e) => e.id))),
    [bereiche],
  );
  const [aktiv, setzeAktiv] = useState<string | undefined>(ids[0]);
  const [zu, setzeZu] = useState<ReadonlySet<number>>(new Set());
  const basis = useId();

  useEffect(() => {
    const ziele = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    // Aktuell ist der unterste Abschnitt, dessen Anfang das obere Drittel des
    // Fensters erreicht hat — am Seitenende der letzte, den sonst ein kurzer
    // Abschnitt nie erreichte. Die Abschnitte stehen der Reihe nach
    // untereinander, also genügt eine binäre Suche. Geprüft wird beim Laden,
    // beim Scrollen (höchstens einmal pro Bild), bei Grössenänderung und
    // nach einem Sprung.
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
      setzeAktiv(ziele[index].id);
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
  }, [ids]);

  // Die hervorgehobene Zeile im Verzeichnis sichtbar halten — nur das
  // Verzeichnis scrollt dafür, nie das Fenster (`scrollIntoView` täte beides).
  // In einem zugeklappten Bereich gibt es nichts zu zeigen.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const zeile = nav?.querySelector<HTMLElement>(`[data-verzeichnis="${aktiv}"]`);
    if (!nav || !zeile || zeile.offsetParent === null) return;
    const oben = zeile.offsetTop; // relativ zum Verzeichnis: `sticky` ist positioniert
    if (oben < nav.scrollTop) nav.scrollTop = oben;
    else if (oben + zeile.offsetHeight > nav.scrollTop + nav.clientHeight) {
      nav.scrollTop = oben + zeile.offsetHeight - nav.clientHeight;
    }
  }, [aktiv, zu]);

  const umschalten = (bi: number) =>
    setzeZu((vorher) => {
      const neu = new Set(vorher);
      if (!neu.delete(bi)) neu.add(bi);
      return neu;
    });

  return (
    <nav
      ref={navRef}
      aria-label={name}
      className="sticky top-16 flex max-h-[calc(100dvh-5rem)] flex-col gap-2 overflow-y-auto print:hidden"
    >
      {bereiche.map((b, bi) => {
        const offen = !zu.has(bi);
        const inhaltId = `${basis}-${bi}`;
        const traegtAktiv = b.gruppen.some((g) => g.eintraege.some((e) => e.id === aktiv));
        return (
          <div key={b.titel ?? bi}>
            {b.titel && (
              <button
                type="button"
                aria-expanded={offen}
                aria-controls={inhaltId}
                onClick={() => umschalten(bi)}
                className="focus-ring-inset state type-title-small flex w-full items-center gap-1.5 rounded-flaeche px-1.5 py-1.5 text-on-surface transition-colors"
              >
                <ChevronRight
                  size={16}
                  strokeWidth={2.5}
                  aria-hidden
                  className={cn(
                    "shrink-0 text-on-surface-mittel transition-transform",
                    offen && "rotate-90",
                  )}
                />
                <span className={cn("truncate", !offen && traegtAktiv && "text-primary")}>
                  {b.titel}
                </span>
              </button>
            )}
            <div id={inhaltId} hidden={!offen} className={cn(b.titel && "pl-5")}>
              {b.gruppen.map((g, gi) => {
                const titelId = `${inhaltId}-${gi}`;
                return (
                  <div key={g.titel ?? gi}>
                    {g.titel && (
                      <p
                        id={titelId}
                        className="type-body-small px-2.5 pt-3 pb-1 text-on-surface-mittel"
                      >
                        {g.titel}
                      </p>
                    )}
                    <ol
                      aria-labelledby={g.titel ? titelId : undefined}
                      className="flex flex-col gap-0.5"
                    >
                      {g.eintraege.map((e) => {
                        const istAktiv = e.id === aktiv;
                        return (
                          <li key={e.id}>
                            <a
                              href={e.href ?? `#${e.id}`}
                              data-verzeichnis={e.id}
                              aria-current={istAktiv ? "location" : undefined}
                              className={cn(
                                "focus-ring-inset state flex flex-col rounded-flaeche px-2.5 py-1.5 transition-colors",
                                istAktiv
                                  ? "bg-elev-08 text-on-surface"
                                  : "text-on-surface-mittel hover:text-on-surface",
                              )}
                            >
                              {e.zusatz && (
                                <span className={cn("type-body-small", istAktiv && "text-primary")}>
                                  {e.zusatz}
                                </span>
                              )}
                              <span className="type-body-medium truncate">{e.titel}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
