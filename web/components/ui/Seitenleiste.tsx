"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LogIn,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ButtonLink } from "./Button";
import { IconButton } from "./IconButton";
import { tooltipFlaeche } from "./Tooltip";

/* ── Typen ──────────────────────────────────────────────────── */

export interface SeitenleisteUnterpunkt {
  label: string;
  href: string;
  /** Genau diese Seite ist offen → `aria-current="page"`. */
  current?: boolean;
}

export interface SeitenleisteEintrag {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Genau diese Seite ist offen → `aria-current="page"`. */
  current?: boolean;
  /** Etwas unterhalb des Eintrags ist offen (ein Unterpunkt, ein
   *  Team-Training). Hebt den Eintrag hervor, wenn die Unterpunkte nicht zu
   *  sehen sind: schmal oder zugeklappt. */
  bereichAktiv?: boolean;
  /** Aufklappbar; ohne oder leer = kein Pfeil. */
  unterpunkte?: SeitenleisteUnterpunkt[];
}

export interface SeitenleisteGruppe {
  titel: string;
  eintraege: SeitenleisteEintrag[];
}

export interface SeitenleisteKonto {
  name: string;
  email?: string;
  href: string;
  current?: boolean;
}

export interface SeitenleisteProps {
  gruppen: SeitenleisteGruppe[];
  /** Angemeldet: Konto-Karte unten. Sonst `anmeldenHref`. */
  konto?: SeitenleisteKonto;
  anmeldenHref?: string;
  /** Schmal (nur Zeichen). Wirkt ab `lg`; darunter ist die Leiste ein Drawer
   *  und zeigt immer alles. */
  slim: boolean;
  drawerOffen: boolean;
  onDrawerOffenChange: (offen: boolean) => void;
  /** Styleguide: füllt den umgebenden Rahmen statt des Fensters — kein
   *  Drawer, keine Kopfzeile, immer die Desktop-Form. */
  eingebettet?: boolean;
}

/* ── Breite ─────────────────────────────────────────────────────
   Die einzige Stelle mit den beiden Breiten. Wer die Leiste trägt (App-Rahmen,
   Styleguide-Demo), setzt die Variable auf seinen Wrapper; die Leiste und
   alles, was neben ihr fest am Fenster klebt (Snackbar, Durchführungsleiste),
   liest sie von dort. */
export const SEITENLEISTE_ID = "seitenleiste";

export function leisteStil(slim: boolean): CSSProperties {
  return { "--leiste-breite": slim ? "4.5rem" : "17.5rem" } as CSSProperties;
}

/* ── Kleinteile ─────────────────────────────────────────────── */

/** Initialen: zwei Wörter → je der erste Buchstabe, sonst die ersten zwei. */
function initialen(name: string) {
  const woerter = name.trim().split(/\s+/).filter(Boolean);
  const roh =
    woerter.length >= 2 ? `${woerter[0][0]}${woerter[1][0]}` : (woerter[0] ?? "").slice(0, 2);
  return roh.toUpperCase();
}

/** Marke: ein Fussball, gezeichnet wie ein Lucide-Zeichen (Strich, keine
 *  Füllung), damit er neben den übrigen Zeichen nicht aus der Reihe fällt.
 *  Lucide selbst kennt keinen Fussball. */
function FussballZeichen({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m12 7 4.2 3-1.6 5H9.4l-1.6-5z" />
      <path d="M12 2v5M21.5 9.5 16.2 10M18 20l-3.4-5M6 20l3.4-5M2.5 9.5 7.8 10" />
    </svg>
  );
}

/* Zeile: Zustands-Ebene + Fokus-Ring nach innen (der Scrollbereich der Liste
   schnitte einen äusseren ab). Aktiv steht die Zeile eine Stufe höher als
   ihr Grund — am Desktop 08dp auf 01dp, im Drawer (selbst 08dp) 12dp. */
const zeile =
  "focus-ring-inset state flex items-center rounded-flaeche transition-colors";
const zeileAktiv = "bg-elev-08 text-on-surface max-lg:bg-elev-12";
const zeileRuhe = "text-on-surface-mittel hover:text-on-surface";

/* ── Seitenleiste ───────────────────────────────────────────────
   Hauptnavigation am linken Rand. Ab `lg` eine feste Spalte, breit (280 px,
   Zeichen + Name) oder schmal (72 px, nur Zeichen) — umgeschaltet nur von
   Hand über den `SeitenleistenKnopf`, nie von selbst beim Überfahren: Eine
   Leiste, die sich unter dem Zeiger öffnet, schiebt sich über den Inhalt,
   den man gerade ansteuern wollte. Schmal trägt jeder Eintrag seinen Namen
   unsichtbar weiter (Screenreader) und zeigt ihn beim Überfahren oder
   Fokussieren als Hinweis daneben.

   Unter `lg` wird dieselbe Leiste zum Drawer von links, geöffnet über die
   Kopfzeile. Geschlossen ist er `invisible` — das nimmt ihn wie `inert` aus
   Tab-Reihenfolge und A11y-Baum, hängt aber nicht an einem Attribut, das am
   Desktop dieselbe Leiste stilllegte.

   Fläche 01dp mit Haarlinie: Die Leiste ist Rahmen, keine schwebende Fläche,
   und trägt darum keinen Schatten. Der Drawer schwebt und steht auf 08dp. */
export function Seitenleiste({
  gruppen,
  konto,
  anmeldenHref = "/login",
  slim,
  drawerOffen,
  onDrawerOffenChange,
  eingebettet,
}: SeitenleisteProps) {
  const reactId = useId();
  const navRef = useRef<HTMLElement>(null);
  const oeffnenRef = useRef<HTMLButtonElement>(null);
  const schliessenRef = useRef<HTMLButtonElement>(null);
  const [hinweis, setHinweis] = useState<{ label: string; top: number; left: number } | null>(
    null,
  );

  const offen = drawerOffen && !eingebettet;
  const schliessen = () => onDrawerOffenChange(false);

  // Drawer: Escape schliesst, der Seiteninhalt scrollt nicht mit, der Fokus
  // springt hinein und beim Schliessen zurück auf den Auslöser.
  useEffect(() => {
    if (!offen) return;
    schliessenRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDrawerOffenChange(false);
    }
    document.addEventListener("keydown", onKey);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const nav = navRef.current;
    const ausloeser = oeffnenRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = vorher;
      if (nav?.contains(document.activeElement)) ausloeser?.focus();
    };
  }, [offen, onDrawerOffenChange]);

  // Wächst das Fenster über `lg`, gibt es keinen Drawer mehr — sonst bliebe
  // die Scroll-Sperre am Desktop hängen.
  useEffect(() => {
    if (!offen) return;
    const mq = window.matchMedia("(min-width: 64rem)");
    const onChange = () => mq.matches && onDrawerOffenChange(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [offen, onDrawerOffenChange]);

  // Hinweis neben dem schmalen Eintrag. Er steht `fixed` ausserhalb der
  // Leiste, weil deren Scrollbereich ein seitlich herausragendes Kind
  // abschnitte; die Lage rechnet er beim Zeigen aus dem Eintrag.
  function zeigeHinweis(ziel: EventTarget) {
    const el = (ziel as HTMLElement).closest<HTMLElement>("[data-hinweis]");
    if (!el || !slim) return setHinweis(null);
    if (!eingebettet && !window.matchMedia("(min-width: 64rem)").matches) return;
    // Waagrecht an der Kante der Leiste, nicht des Eintrags — sonst läge der
    // Hinweis noch auf ihr.
    const r = el.getBoundingClientRect();
    const kante = navRef.current?.getBoundingClientRect().right ?? r.right;
    setHinweis({ label: el.dataset.hinweis ?? "", top: r.top + r.height / 2, left: kante + 8 });
  }
  useEffect(() => setHinweis(null), [slim]);

  // Slim-Varianten. Eingebettet gilt die Desktop-Form auf jeder Breite, sonst
  // erst ab `lg` — darunter zeigt der Drawer immer alles.
  const s = (klassen: { lg: string; immer: string }) =>
    slim ? (eingebettet ? klassen.immer : klassen.lg) : "";
  const textWeg = s({ lg: "lg:sr-only", immer: "sr-only" });
  const nurBreit = s({ lg: "lg:hidden", immer: "hidden" });
  const zeileMitte = s({ lg: "lg:justify-center", immer: "justify-center" });

  const navKlassen = eingebettet
    ? "flex h-full w-(--leiste-breite) shrink-0 flex-col overflow-hidden border-r border-linie bg-elev-01 transition-[width] duration-200 motion-reduce:transition-none"
    : cn(
        "flex flex-col print:hidden",
        // Unter lg: Drawer von links.
        "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[min(17.5rem,86vw)] max-lg:bg-elev-08 max-lg:shadow-dp-08 max-lg:duration-200 motion-reduce:transition-none",
        // Sichtbar wird er sofort (sonst nähme er den Fokus beim Öffnen
        // nicht an), unsichtbar erst, wenn er hinausgeglitten ist.
        offen
          ? "max-lg:transition-[translate]"
          : "max-lg:invisible max-lg:-translate-x-full max-lg:transition-[translate,visibility]",
        // Ab lg: feste Spalte, klebt beim Scrollen.
        "lg:sticky lg:top-0 lg:h-dvh lg:w-(--leiste-breite) lg:shrink-0 lg:self-start lg:overflow-hidden lg:border-r lg:border-linie lg:bg-elev-01 lg:transition-[width] lg:duration-200",
      );

  return (
    <>
      {!eingebettet && (
        <>
          {/* Kopfzeile unter lg: Auslöser des Drawers + Marke. */}
          <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-linie bg-elev-04 px-2 lg:hidden print:hidden">
            <IconButton
              ref={oeffnenRef}
              icon={MenuIcon}
              label="Navigation öffnen"
              aria-expanded={offen}
              aria-controls={SEITENLEISTE_ID}
              onClick={() => onDrawerOffenChange(true)}
            />
            <Marke />
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Navigation schliessen"
            onClick={schliessen}
            className={cn(
              "fixed inset-0 z-40 bg-scrim/60 transition-opacity duration-200 lg:hidden print:hidden",
              offen ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />
        </>
      )}

      <nav
        ref={navRef}
        id={eingebettet ? undefined : SEITENLEISTE_ID}
        aria-label="Hauptnavigation"
        className={navKlassen}
        onPointerOver={(e) => zeigeHinweis(e.target)}
        onPointerLeave={() => setHinweis(null)}
        onFocus={(e) => zeigeHinweis(e.target)}
        onBlur={() => setHinweis(null)}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 px-4">
          <Marke textKlasse={textWeg} />
          {!eingebettet && (
            <IconButton
              ref={schliessenRef}
              icon={X}
              label="Navigation schliessen"
              onClick={schliessen}
              className="ml-auto lg:hidden"
            />
          )}
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 py-3"
          onScroll={() => setHinweis(null)}
        >
          {gruppen.map((gruppe, gi) => (
            <div key={gruppe.titel} role="group" aria-label={gruppe.titel} className="flex flex-col gap-0.5">
              <p className={cn("type-label-small mb-1 px-2.5 whitespace-nowrap text-on-surface-tief", nurBreit)}>
                {gruppe.titel}
              </p>
              {/* Schmal steht statt des Titels eine Haarlinie — vor der
                  ersten Gruppe braucht es keine. */}
              {gi > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "mx-1 mb-2 hidden h-px bg-linie",
                    s({ lg: "lg:block", immer: "block!" }),
                  )}
                />
              )}
              {gruppe.eintraege.map((eintrag, ei) => (
                <Eintrag
                  key={eintrag.href}
                  eintrag={eintrag}
                  idBasis={`${reactId}-${gi}-${ei}`}
                  schmalAb={slim ? (eingebettet ? "immer" : "lg") : null}
                  textWeg={textWeg}
                  nurBreit={nurBreit}
                  zeileMitte={zeileMitte}
                  onNavigiert={schliessen}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="mx-4 shrink-0 border-t border-linie py-3">
          {konto ? (
            <Link
              href={konto.href}
              aria-current={konto.current ? "page" : undefined}
              data-hinweis="Konto"
              onClick={schliessen}
              className={cn(
                zeile,
                "gap-3 p-2",
                s({ lg: "lg:justify-center lg:p-0", immer: "justify-center p-0!" }),
                konto.current ? zeileAktiv : "text-on-surface",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "type-label-medium grid h-10 w-10 shrink-0 place-items-center rounded-full bg-elev-12 text-on-surface",
                  konto.current && "outline-2 outline-primary",
                )}
              >
                {initialen(konto.name)}
              </span>
              <span className={cn("flex min-w-0 flex-col", textWeg)}>
                <span className="type-title-small truncate">{konto.name}</span>
                {konto.email && (
                  <span className="type-body-small truncate text-on-surface-mittel">
                    {konto.email}
                  </span>
                )}
              </span>
            </Link>
          ) : (
            <ButtonLink
              href={anmeldenHref}
              data-hinweis="Anmelden"
              onClick={schliessen}
              className={cn("w-full", s({ lg: "lg:px-0", immer: "px-0!" }))}
            >
              <LogIn size={18} strokeWidth={2.5} aria-hidden className="shrink-0" />
              <span className={textWeg}>Anmelden</span>
            </ButtonLink>
          )}
        </div>
      </nav>

      {hinweis && (
        <span
          aria-hidden
          className={cn("pointer-events-none fixed z-50 -translate-y-1/2 print:hidden", tooltipFlaeche)}
          style={{ top: hinweis.top, left: hinweis.left }}
        >
          {hinweis.label}
        </span>
      )}
    </>
  );
}

/* Marke: Fussball im Primary-Quadrat + Wortmarke. Schmal bleibt das Quadrat. */
function Marke({ textKlasse }: { textKlasse?: string }) {
  return (
    <Link
      href="/"
      data-hinweis="KiFu"
      className="focus-ring-inset flex items-center gap-2.5 rounded-flaeche p-1.5 text-on-surface"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-flaeche bg-primary text-on-primary">
        <FussballZeichen />
      </span>
      <span className={cn("type-title-large", textKlasse)}>KiFu</span>
    </Link>
  );
}

function Eintrag({
  eintrag,
  idBasis,
  schmalAb,
  textWeg,
  nurBreit,
  zeileMitte,
  onNavigiert,
}: {
  eintrag: SeitenleisteEintrag;
  idBasis: string;
  /** Wo die schmale Form gilt: ab `lg`, immer (eingebettet) oder nirgends. */
  schmalAb: "lg" | "immer" | null;
  textWeg: string;
  nurBreit: string;
  zeileMitte: string;
  onNavigiert: () => void;
}) {
  const [aufgeklappt, setAufgeklappt] = useState(true);
  const Icon = eintrag.icon;
  const unter = eintrag.unterpunkte ?? [];
  const listeId = `${idBasis}-unter`;
  // Hervorgehoben: die Seite selbst — oder ein Bereich darunter, solange kein
  // sichtbarer Unterpunkt die Markierung selbst trägt (zugeklappt, schmal,
  // oder offen ist etwas ohne eigenen Unterpunkt, etwa ein Team-Training).
  const unterpunktZeigtEs = aufgeklappt && unter.some((u) => u.current);
  const hervorBreit = eintrag.current || (eintrag.bereichAktiv && !unterpunktZeigtEs);
  const hervorSchmal = eintrag.current || eintrag.bereichAktiv;
  const hervor = schmalAb === "immer" ? hervorSchmal : hervorBreit;
  // Schmal ab lg: darunter zeigt der Drawer die breite Form, also nur ab lg.
  const nurAbLg = schmalAb === "lg" && hervorSchmal && !hervorBreit;

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <Link
          href={eintrag.href}
          aria-current={eintrag.current ? "page" : undefined}
          data-hinweis={eintrag.label}
          onClick={onNavigiert}
          className={cn(
            zeile,
            "type-title-small h-10 min-w-0 flex-1 gap-3 px-2.5",
            zeileMitte,
            hervor ? zeileAktiv : cn(zeileRuhe, nurAbLg && "lg:bg-elev-08 lg:text-on-surface"),
          )}
        >
          <Icon
            size={20}
            strokeWidth={2}
            aria-hidden
            className={cn("shrink-0", hervor && "text-primary", nurAbLg && "lg:text-primary")}
          />
          <span className={cn("truncate", textWeg)}>{eintrag.label}</span>
        </Link>
        {unter.length > 0 && (
          <button
            type="button"
            aria-expanded={aufgeklappt}
            aria-controls={listeId}
            aria-label={`${eintrag.label} ${aufgeklappt ? "zuklappen" : "aufklappen"}`}
            onClick={() => setAufgeklappt(!aufgeklappt)}
            className={cn(
              zeile,
              "h-10 w-9 shrink-0 justify-center text-on-surface-tief hover:text-on-surface",
              nurBreit,
            )}
          >
            <ChevronDown
              size={16}
              strokeWidth={2.5}
              aria-hidden
              className={cn("transition-transform motion-reduce:transition-none", aufgeklappt && "rotate-180")}
            />
          </button>
        )}
      </div>
      {unter.length > 0 && (
        <ul id={listeId} hidden={!aufgeklappt} className={cn("mt-0.5 flex flex-col gap-0.5", nurBreit)}>
          {unter.map((u) => (
            <li key={u.href}>
              <Link
                href={u.href}
                aria-current={u.current ? "page" : undefined}
                onClick={onNavigiert}
                className={cn(
                  zeile,
                  "type-body-medium h-9 pr-2.5 pl-11",
                  u.current ? zeileAktiv : zeileRuhe,
                )}
              >
                <span className="truncate">{u.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Umschalter ─────────────────────────────────────────────────
   Steht im Inhalt vor den Brotkrumen, gefolgt von einer Haarlinie, die ihn
   vom Pfad trennt. Nur ab `lg` — darunter gibt es keine schmale Leiste. */
export function SeitenleistenKnopf({
  slim,
  onClick,
  immer,
}: {
  slim: boolean;
  onClick: () => void;
  /** Styleguide: auch unter `lg` zeigen. */
  immer?: boolean;
}) {
  const sichtbar = immer ? "" : "max-lg:hidden";
  return (
    <>
      <IconButton
        icon={slim ? PanelLeftOpen : PanelLeftClose}
        size="sm"
        label={slim ? "Seitenleiste vergrössern" : "Seitenleiste verkleinern"}
        aria-expanded={!slim}
        aria-controls={SEITENLEISTE_ID}
        onClick={onClick}
        className={cn("shrink-0", sichtbar)}
      />
      <span aria-hidden className={cn("h-5 w-px shrink-0 bg-linie", sichtbar)} />
    </>
  );
}
