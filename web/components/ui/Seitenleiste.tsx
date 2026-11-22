"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { AB_LG } from "@/lib/breite";
import {
  ChevronDown,
  ChevronsUpDown,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Menu, type MenuItemDef } from "./Menu";
import { IconButton } from "./IconButton";
import { ZeichenPunkt } from "./ZeichenPunkt";
import { tooltipFlaeche } from "./Tooltip";
import { BereichWechsler, type BereichWechslerProps } from "./BereichWechsler";
import { SCHMAL_KLASSEN, type SchmalAb } from "./seitenleiste-schmal";

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

/** Die Konto-Karte unten in der Leiste (#661): ein Knopf, der das
 *  Konto-Menü öffnet — angemeldet wie ohne Anmeldung. */
export interface SeitenleisteKonto {
  /** Angemeldet der Anzeigename, sonst «Nicht angemeldet». */
  name: string;
  /** Die zweite Zeile: angemeldet die E-Mail, sonst «Anmelden oder Konto erstellen». */
  email?: string;
  /** Ohne Anmeldung: ein Personenzeichen statt der Initialen. */
  anonym?: boolean;
  /** Eine Seite des Kontos ist offen → die Karte ist hervorgehoben. */
  current?: boolean;
  /** Ein Release ist erschienen, den dieser Browser noch nicht gesehen hat
   *  (#410): ein Punkt am Avatar, im Menü die Plakette bei «Was ist neu». */
  neu?: boolean;
  /** Die Einträge des Menüs. Ziele tragen `href` (Links, #246), Aktionen
   *  `onSelect`; Zeilen mit `gewaehlt` (Darstellung) lassen den Drawer offen. */
  menue: MenuItemDef[];
}

export interface SeitenleisteProps {
  /** Der Wechsler oben, unter der Marke: eines der eigenen Teams oder der
   *  Verein. Fehlt er (kein Verein, kein Team), steht nichts an seiner Stelle. */
  bereich?: BereichWechslerProps;
  gruppen: SeitenleisteGruppe[];
  /** Die Konto-Karte unten mit dem Konto-Menü — auch ohne Anmeldung. */
  konto: SeitenleisteKonto;
  /** Schmal (nur Zeichen). Wirkt ab `lg`; darunter ist die Leiste ein Drawer
   *  und zeigt immer alles. */
  slim: boolean;
  /** Drawer unter `lg`; eingebettet ohne Wirkung. */
  drawerOffen?: boolean;
  onDrawerOffenChange?: (offen: boolean) => void;
  /** Styleguide: füllt den umgebenden Rahmen statt des Fensters — kein
   *  Drawer, keine Kopfzeile, immer die Desktop-Form. */
  eingebettet?: boolean;
}

/* ── Breite ─────────────────────────────────────────────────────
   Die Breiten der festen Spalte ab `lg` (der Drawer darunter ist ein
   Tailwind-Literal und so breit wie BREIT). Wer die Leiste trägt (App-Rahmen,
   Styleguide-Demo), setzt die Variable auf seinen Wrapper; die Leiste und
   alles, was neben ihr fest am Fenster klebt, liest sie von dort. */
const BREIT = "17.5rem";
const SCHMAL = "4.5rem";
const SEITENLEISTE_ID = "seitenleiste";

export function leisteStil(slim: boolean): CSSProperties {
  return { "--leiste-breite": slim ? SCHMAL : BREIT } as CSSProperties;
}

/** Wer unter lg oben klebt, steht unter der Kopfzeile mit dem Menüknopf
 *  (48 px, `h-12`) und ab lg am Fensterrand. Steht hier, neben der Höhe der
 *  Kopfzeile, damit beide Zahlen zusammen wandern. */
export const unterKopfzeile = "top-12 lg:top-0";

/** Für Flächen, die fest am Fenster unten kleben (Snackbar, Leiste der
 *  Durchführung): ab `lg` beginnen sie neben der Seitenleiste und laufen beim
 *  Umschalten mit. Fallback 0, falls kein Rahmen die Breite setzt. */
export const nebenLeiste =
  "left-0 transition-[left] duration-200 motion-reduce:transition-none lg:left-[var(--leiste-breite,0px)]";

/* ── Kleinteile ─────────────────────────────────────────────── */

function keineAktion() {}

/** Initialen: zwei Wörter → je der erste Buchstabe, sonst die ersten zwei. */
function initialen(name: string) {
  const woerter = name.trim().split(/\s+/).filter(Boolean);
  const roh =
    woerter.length >= 2 ? `${woerter[0][0]}${woerter[1][0]}` : (woerter[0] ?? "").slice(0, 2);
  return roh.toUpperCase();
}

/* Zeile: Zustands-Ebene + Fokus-Ring nach innen (der Scrollbereich der Liste
   schnitte einen äusseren ab). Aktiv ist die Zeile betont (`betont`): die
   Schrift zu 8 % über der Leiste — auf jeder Stufe und in beiden
   Erscheinungsbildern sichtbar. */
const zeile =
  "focus-ring-inset state flex items-center rounded-flaeche transition-colors";
const zeileAktiv = "betont text-on-surface";
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
  bereich,
  gruppen,
  konto,
  slim,
  drawerOffen = false,
  onDrawerOffenChange = keineAktion,
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
  // springt hinein, bleibt darin (Tab läuft im Kreis — der Inhalt dahinter
  // liegt unter dem Scrim) und geht beim Schliessen zurück auf den Auslöser.
  useEffect(() => {
    if (!offen) return;
    schliessenRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      // Escape in einem offenen Menü der Leiste (Konto, Bereich) schliesst
      // nur das Menü — das Menü hört selbst darauf und gibt den Fokus zurück.
      // Tab ebenso: Die Menüs stehen `fixed` (fehlen also unter den Zielen
      // unten) und schliessen bei Tab selbst.
      const imMenue = (e.target as Element | null)?.closest?.('[role="menu"]');
      if (e.key === "Escape") {
        if (imMenue) return;
        return onDrawerOffenChange(false);
      }
      if (e.key !== "Tab" || !navRef.current || imMenue) return;
      const ziele = [...navRef.current.querySelectorAll<HTMLElement>("a[href], button")].filter(
        (el) => el.offsetParent !== null,
      );
      const erstes = ziele[0];
      const letztes = ziele[ziele.length - 1];
      // Steht der Fokus nicht auf einem der Ziele (etwa nach einem Klick auf
      // eine leere Stelle der Leiste), holt Tab ihn zurück hinein.
      if (!ziele.includes(document.activeElement as HTMLElement)) {
        e.preventDefault();
        (e.shiftKey ? letztes : erstes)?.focus();
      } else if (e.shiftKey && document.activeElement === erstes) {
        e.preventDefault();
        letztes?.focus();
      } else if (!e.shiftKey && document.activeElement === letztes) {
        e.preventDefault();
        erstes?.focus();
      }
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
    const mq = window.matchMedia(AB_LG);
    const onChange = () => mq.matches && onDrawerOffenChange(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [offen, onDrawerOffenChange]);

  // Hinweis neben dem schmalen Eintrag. Er steht `fixed` ausserhalb der
  // Leiste, weil deren Scrollbereich ein seitlich herausragendes Kind
  // abschnitte; die Lage rechnet er beim Zeigen aus dem Eintrag.
  function zeigeHinweis(ziel: EventTarget, perFokus = false) {
    // Fokus zählt nur von der Tastatur: Ein Mausklick fokussiert den Link
    // ebenfalls, und weil die Leiste beim Seitenwechsel stehen bleibt, stünde
    // der Hinweis sonst noch auf der neuen Seite.
    if (perFokus && !(ziel as HTMLElement).matches(":focus-visible")) return;
    const el = (ziel as HTMLElement).closest<HTMLElement>("[data-hinweis]");
    if (!el || !slim) return setHinweis(null);
    if (!eingebettet && !window.matchMedia(AB_LG).matches) return;
    // Waagrecht an der Kante der Leiste, nicht des Eintrags — sonst läge der
    // Hinweis noch auf ihr.
    const r = el.getBoundingClientRect();
    const kante = navRef.current?.getBoundingClientRect().right ?? r.right;
    setHinweis({ label: el.dataset.hinweis ?? "", top: r.top + r.height / 2, left: kante + 8 });
  }
  useEffect(() => setHinweis(null), [slim]);

  const schmalAb: SchmalAb | null = slim ? (eingebettet ? "immer" : "lg") : null;
  const k = schmalAb ? SCHMAL_KLASSEN[schmalAb] : null;

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
        // Ab lg: feste Spalte, klebt beim Scrollen. `sticky` bildet einen
        // eigenen Stapelkontext — ohne Ebene malte später folgender Inhalt
        // (Karten, Seitenkopf z-20) über alles, was aus der Leiste ragt, etwa
        // das Konto-Menü der schmalen Leiste. z-30: über dem Inhalt,
        // unter Snackbar und Auswahlleiste.
        "lg:sticky lg:top-0 lg:z-30 lg:h-dvh lg:w-(--leiste-breite) lg:shrink-0 lg:self-start lg:overflow-hidden lg:border-r lg:border-linie lg:bg-elev-01 lg:transition-[width] lg:duration-200",
      );

  return (
    <>
      {!eingebettet && (
        <>
          {/* Kopfzeile unter lg: Auslöser des Drawers + Marke. */}
          <div className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-linie bg-elev-04 px-2 lg:hidden print:hidden">
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
        // Offen ist der Drawer ein modaler Dialog: Der Inhalt dahinter ist
        // `inert` (AppInhalt), Screenreader bleiben in der Leiste.
        role={offen ? "dialog" : undefined}
        aria-modal={offen || undefined}
        className={navKlassen}
        onPointerOver={(e) => zeigeHinweis(e.target)}
        onPointerLeave={() => setHinweis(null)}
        onFocus={(e) => zeigeHinweis(e.target, true)}
        onBlur={() => setHinweis(null)}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 px-4">
          <Marke textKlasse={k?.textWeg} />
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

        {bereich && (
          <BereichWechsler {...bereich} schmalAb={schmalAb} navRef={navRef} onNavigiert={schliessen} />
        )}

        <div
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 py-3"
          onScroll={() => setHinweis(null)}
        >
          {gruppen.map((gruppe, gi) => (
            <div key={gruppe.titel} role="group" aria-label={gruppe.titel} className="flex flex-col gap-0.5">
              <p className={cn("type-label-small mb-1 px-2.5 whitespace-nowrap text-on-surface-tief", k?.nurBreit)}>
                {gruppe.titel}
              </p>
              {/* Schmal steht statt des Titels eine Haarlinie — vor der
                  ersten Gruppe braucht es keine. */}
              {gi > 0 && (
                <span
                  aria-hidden
                  className={cn("mx-1 mb-2 hidden h-px bg-linie", k?.linie)}
                />
              )}
              {gruppe.eintraege.map((eintrag, ei) => (
                <Eintrag
                  key={eintrag.href}
                  eintrag={eintrag}
                  idBasis={`${reactId}-${gi}-${ei}`}
                  schmalAb={schmalAb}
                  onNavigiert={schliessen}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Die Konto-Karte öffnet das Konto-Menü (#661): Konto, Darstellung,
            Fragen und Feedback, Was ist neu und Abmelden — ohne Anmeldung
            Anmelden, Konto erstellen und Was ist neu. Den Styleguide führt
            die Leiste nicht: Er ist Werkzeug fürs Entwickeln, nicht für
            Nutzer:innen, und bleibt unter /styleguide erreichbar. */}
        <div className="mx-4 shrink-0 border-t border-linie py-3">
          <KontoKarte
            {...konto}
            schmalAb={schmalAb}
            navRef={navRef}
            onNavigiert={schliessen}
            onOeffnen={() => setHinweis(null)}
          />
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

/* Konto-Karte (#661, Entwurf «Seitenleiste mit Konto-Menü» und «Ohne Konto ·
   B»): Avatar, Name und zweite Zeile als ein Knopf, der das Konto-Menü öffnet.
   Breit klappt es über der Karte auf, so breit wie sie, schmal rechts neben
   der Leiste. Das Menü steht `fixed`, weil die Leiste ihren Inhalt
   abschneidet (`overflow-hidden`) — schmal ragte es sonst nicht hinaus. Die
   Lage wird beim Öffnen aus der Karte gerechnet; ändert sich das Fenster oder
   scrollt etwas darunter, geht es zu, statt von der Karte abzureissen.

   Ziele und Aktionen schliessen auch den Drawer; die Wahl der Darstellung
   lässt ihn offen: Wer umschaltet, will sehen, wie es aussieht. Tastatur nach
   dem Menü-Muster, dazu schliesst Tab und gibt den Fokus an die Karte. */
function KontoKarte({
  name,
  email,
  anonym,
  current,
  neu,
  menue,
  schmalAb,
  navRef,
  onNavigiert,
  onOeffnen,
}: SeitenleisteKonto & {
  schmalAb: SchmalAb | null;
  navRef: React.RefObject<HTMLElement | null>;
  onNavigiert: () => void;
  /** Das Menü geht auf — der Hinweis daneben (schmal) muss weichen. */
  onOeffnen: () => void;
}) {
  const knopfRef = useRef<HTMLButtonElement>(null);
  const [lage, setLage] = useState<CSSProperties | null>(null);
  const k = schmalAb ? SCHMAL_KLASSEN[schmalAb] : null;
  const zu = () => setLage(null);

  useEffect(() => {
    if (!lage) return;
    const schliessen = () => setLage(null);
    window.addEventListener("resize", schliessen);
    // Capture: Auch ein Scrollbereich ausserhalb des Fensters (Styleguide)
    // verschiebt die Karte.
    window.addEventListener("scroll", schliessen, true);
    return () => {
      window.removeEventListener("resize", schliessen);
      window.removeEventListener("scroll", schliessen, true);
    };
  }, [lage]);

  function oeffnen() {
    const r = knopfRef.current?.getBoundingClientRect();
    if (!r) return;
    const schmal =
      schmalAb === "immer" || (schmalAb === "lg" && window.matchMedia(AB_LG).matches);
    const kante = navRef.current?.getBoundingClientRect().right ?? r.right;
    onOeffnen();
    setLage(
      schmal
        ? { left: kante + 8, bottom: window.innerHeight - r.bottom, width: "16rem" }
        : { left: r.left, bottom: window.innerHeight - r.top + 4, width: r.width },
    );
  }

  // Ziele und Aktionen schliessen den Drawer, die Wahl einer Darstellung nicht.
  const eintraege = menue.map((m) =>
    m.gewaehlt === undefined
      ? {
          ...m,
          onSelect: () => {
            onNavigiert();
            m.onSelect?.();
          },
        }
      : m,
  );
  const hinweis = anonym ? "Anmelden" : "Konto";

  return (
    <>
      <button
        ref={knopfRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!lage}
        // Offen steht das Menü dort, wo schmal der Hinweis stünde.
        data-hinweis={lage ? undefined : hinweis}
        onClick={() => (lage ? zu() : oeffnen())}
        className={cn(
          zeile,
          "w-full gap-3 p-2 text-left",
          k?.konto,
          lage || current ? zeileAktiv : "text-on-surface",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "type-label-medium relative grid h-10 w-10 shrink-0 place-items-center rounded-full betont text-on-surface",
            current && "outline-2 outline-primary",
          )}
        >
          {anonym ? <UserRound size={20} strokeWidth={2} /> : initialen(name)}
          {/* Neue Version: ein Punkt am Avatar, breit wie schmal (Entwurf
              «Ohne Konto · B»); was er meldet, sagt der sr-only-Text unten. */}
          {neu && (
            <span className="absolute top-1 right-1 h-2 w-2">
              <ZeichenPunkt ton="primary" />
            </span>
          )}
        </span>
        <span className={cn("flex min-w-0 flex-1 flex-col", k?.textWeg)}>
          <span className="type-title-small truncate">{name}</span>
          {email && (
            <span className="type-body-small truncate text-on-surface-mittel">{email}</span>
          )}
          {neu && <span className="sr-only">, neue Version erschienen</span>}
        </span>
        <ChevronsUpDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={cn("shrink-0 text-on-surface-mittel", k?.nurBreit)}
        />
      </button>
      {lage && (
        <div
          className="fixed z-50"
          style={lage}
          onKeyDown={(e) => {
            if (e.key !== "Tab") return;
            e.preventDefault();
            zu();
            knopfRef.current?.focus();
          }}
        >
          <Menu
            open
            onClose={zu}
            triggerRef={knopfRef}
            label={hinweis}
            className="bottom-0 left-0 mt-0 w-full"
            items={eintraege}
          />
        </div>
      )}
    </>
  );
}

/* Marke: Bildmarke + Name. Schmal bleibt die Bildmarke. */
function Marke({ textKlasse }: { textKlasse?: string }) {
  return (
    <Link
      href="/"
      data-hinweis="KiFu"
      className="focus-ring-inset flex items-center gap-2.5 rounded-flaeche p-1.5 text-on-surface"
    >
      {/* Die Bildmarke (FutAssist, Variante F) ist dieselbe Datei wie das
          Favicon: eine Quelle für Tab, Homescreen und Leiste. Ihr Verlauf
          trägt sich auf hellem wie dunklem Grund. Den Namen sagt der Text
          daneben, darum stumm. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG, nichts zu optimieren */}
      <img src="/icon.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
      <span className={cn("type-title-large", textKlasse)}>KiFu</span>
    </Link>
  );
}

function Eintrag({
  eintrag,
  idBasis,
  schmalAb,
  onNavigiert,
}: {
  eintrag: SeitenleisteEintrag;
  idBasis: string;
  /** Wo die schmale Form gilt: ab `lg`, immer (eingebettet) oder nirgends. */
  schmalAb: SchmalAb | null;
  onNavigiert: () => void;
}) {
  const k = schmalAb ? SCHMAL_KLASSEN[schmalAb] : null;
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
            "type-title-small h-9 min-w-0 flex-1 gap-3 px-2.5",
            k?.mitte,
            hervor ? zeileAktiv : cn(zeileRuhe, nurAbLg && "lg:betont lg:text-on-surface"),
          )}
        >
          <Icon
            size={20}
            strokeWidth={2}
            aria-hidden
            className={cn("shrink-0", hervor && "text-primary", nurAbLg && "lg:text-primary")}
          />
          <span className={cn("truncate", k?.textWeg)}>{eintrag.label}</span>
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
              "h-9 w-9 shrink-0 justify-center text-on-surface-tief hover:text-on-surface",
              k?.nurBreit,
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
        <ul id={listeId} hidden={!aufgeklappt} className={cn("mt-0.5 flex flex-col gap-0.5", k?.nurBreit)}>
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
  const sichtbar = cn("print:hidden", !immer && "max-lg:hidden");
  return (
    <>
      <IconButton
        icon={slim ? PanelLeftOpen : PanelLeftClose}
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
