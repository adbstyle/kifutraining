"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Redo2, RotateCcw, RotateCw, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui";
import {
  FLAECHE,
  DIAGRAMM_VERSION,
  FARBEN,
  ZONE_DEFAULT_FARBE,
  LINIE_DEFAULT_FARBE,
  MAX_TEXT_LAENGE,
  bbox,
  farbSlugs,
  type FarbSlug,
  type DiagrammData,
  type DiagrammElement,
  type PfadTyp,
  type SymbolTyp,
  type Punkt,
  type Rotation,
  type ZoneElement,
  type ZonenForm,
} from "@/lib/diagramm";
import { saveDiagramm } from "@/lib/actions/diagramm";
import { SYMBOLE, symbolDef } from "./symbols";
import {
  Rasen,
  ElementGrafik,
  PfadGrafik,
  ZoneGrafik,
  punkteAttr,
  sortiertNachEbene,
  textBox,
} from "./DiagrammView";

type SaveStatus = "gespeichert" | "ausstehend" | "speichert" | "fehler";

const AUTOSAVE_MS = 800;

const PFAD_WERKZEUGE: Record<PfadTyp, string> = {
  laufweg: "Laufweg",
  dribbling: "Dribbling",
  pass: "Pass/Schuss",
  linie: "Linie",
};

/** Pointer-Position -> Flächen-Koordinaten (berücksichtigt viewBox-Skalierung). */
function flaechenPunkt(svg: SVGSVGElement, e: { clientX: number; clientY: number }): Punkt {
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);

type Drag =
  | { modus: "punktig"; id: string; dx: number; dy: number }
  | { modus: "pfad"; id: string; start: Punkt; orig: Punkt[] }
  | { modus: "zone"; id: string; start: Punkt; orig: ZoneElement }
  | { modus: "groesse"; id: string; orig: ZoneElement };

/** Was gerade Punkt für Punkt gezeichnet wird: Bewegung/Linie oder Polygon-Zone. */
type Zeichnen = { werkzeug: PfadTyp | "polygon"; punkte: Punkt[] };

const ZONEN_WERKZEUGE: Record<ZonenForm, string> = {
  rechteck: "Rechteck",
  ellipse: "Ellipse",
  dreieck: "Dreieck",
  polygon: "Polygon",
};

export function DiagrammEditor({
  exerciseId,
  initial,
}: {
  exerciseId: string;
  initial: DiagrammData;
}) {
  const [elemente, setElemente] = useState<DiagrammElement[]>(initial.elemente);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("gespeichert");
  // Aktiver Zeichenmodus (#52/#53): Klicks setzen Stützpunkte.
  const [zeichnen, setZeichnen] = useState<Zeichnen | null>(null);
  const [hoverPunkt, setHoverPunkt] = useState<Punkt | null>(null);

  // Undo/Redo (#54): Schnappschüsse vor jeder abgeschlossenen Bearbeitung;
  // ein Drag zählt als EIN Schritt (Schnappschuss beim Greifen).
  const [verlauf, setVerlauf] = useState<DiagrammElement[][]>([]);
  const [zukunft, setZukunft] = useState<DiagrammElement[][]>([]);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const ersterRender = useRef(true);
  // Saves laufen strikt nacheinander: ein langsamer älterer Save kann so
  // nie einen neueren Stand in der DB überschreiben.
  const saveKette = useRef<Promise<unknown>>(Promise.resolve());

  function merken() {
    setVerlauf((v) => [...v.slice(-49), elemente]);
    setZukunft([]);
  }

  function rueckgaengig() {
    if (verlauf.length === 0) return;
    const letzter = verlauf[verlauf.length - 1];
    setVerlauf((v) => v.slice(0, -1));
    setZukunft((z) => [...z, elemente]);
    setElemente(letzter);
    setSelectedId(null);
  }

  function wiederherstellen() {
    if (zukunft.length === 0) return;
    const naechster = zukunft[zukunft.length - 1];
    setZukunft((z) => z.slice(0, -1));
    setVerlauf((v) => [...v, elemente]);
    setElemente(naechster);
    setSelectedId(null);
  }

  // Autosave: debounced nach jeder Änderung (#49 AK6). Kein expliziter
  // Speicher-Schritt; Status informiert über ausstehend/gespeichert/Fehler.
  useEffect(() => {
    if (ersterRender.current) {
      ersterRender.current = false;
      return;
    }
    setStatus("ausstehend");
    const timer = setTimeout(() => {
      setStatus("speichert");
      saveKette.current = saveKette.current.then(async () => {
        const result = await saveDiagramm(exerciseId, {
          version: DIAGRAMM_VERSION,
          elemente,
        });
        setStatus(result.ok ? "gespeichert" : "fehler");
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [elemente, exerciseId]);

  function addSymbol(typ: SymbolTyp) {
    merken();
    const n = elemente.length;
    const neu: DiagrammElement = {
      id: crypto.randomUUID(),
      art: "symbol",
      typ,
      // Versetzt um die Mitte platzieren, damit Neues nicht exakt stapelt.
      x: FLAECHE.breite / 2 + ((n % 5) - 2) * 70,
      y: FLAECHE.hoehe / 2 + ((Math.floor(n / 5) % 5) - 2) * 70,
    };
    setElemente((prev) => [...prev, neu]);
    setSelectedId(neu.id);
  }

  function removeSelected() {
    if (!selectedId) return;
    merken();
    setElemente((prev) => prev.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  }

  function setFarbe(id: string, farbe: FarbSlug) {
    merken();
    setElemente((prev) =>
      prev.map((el) => (el.id === id && el.art !== "text" ? { ...el, farbe } : el)),
    );
  }

  function setGestrichelt(id: string, gestrichelt: boolean) {
    merken();
    setElemente((prev) =>
      prev.map((el) =>
        el.id === id && el.art === "pfad" ? { ...el, gestrichelt } : el,
      ),
    );
  }

  function startZeichnen(werkzeug: PfadTyp | "polygon") {
    setSelectedId(null);
    setZeichnen({ werkzeug, punkte: [] });
  }

  function abbrechenZeichnen() {
    setZeichnen(null);
    setHoverPunkt(null);
  }

  const minPunkte = (werkzeug: PfadTyp | "polygon") => (werkzeug === "polygon" ? 3 : 2);

  function fertigZeichnen(punkteOverride?: Punkt[]) {
    if (!zeichnen) return;
    const punkte = punkteOverride ?? zeichnen.punkte;
    if (punkte.length >= minPunkte(zeichnen.werkzeug)) {
      merken();
      const neu: DiagrammElement =
        zeichnen.werkzeug === "polygon"
          ? (() => {
              const box = bbox(punkte);
              return {
                id: crypto.randomUUID(),
                art: "zone" as const,
                form: "polygon" as const,
                x: box.minX,
                y: box.minY,
                breite: box.maxX - box.minX,
                hoehe: box.maxY - box.minY,
                punkte,
              };
            })()
          : {
              id: crypto.randomUUID(),
              art: "pfad",
              typ: zeichnen.werkzeug,
              punkte,
            };
      setElemente((prev) => [...prev, neu]);
      setSelectedId(neu.id);
    }
    setZeichnen(null);
    setHoverPunkt(null);
  }

  function zeichnenKlick(p: Punkt) {
    if (!zeichnen) return;
    const punkte = [...zeichnen.punkte, p];
    // Pass/Schuss ist ein gerader Pfeil: Start + Ziel, dann fertig (#52 AK3).
    if (zeichnen.werkzeug === "pass" && punkte.length === 2) {
      fertigZeichnen(punkte);
      return;
    }
    setZeichnen({ ...zeichnen, punkte });
  }

  function addZone(form: Exclude<ZonenForm, "polygon">) {
    merken();
    const neu: DiagrammElement = {
      id: crypto.randomUUID(),
      art: "zone",
      form,
      x: FLAECHE.breite / 2 - 130,
      y: FLAECHE.hoehe / 2 - 90,
      breite: 260,
      hoehe: 180,
    };
    setElemente((prev) => [...prev, neu]);
    setSelectedId(neu.id);
  }

  function addText() {
    merken();
    const neu: DiagrammElement = {
      id: crypto.randomUUID(),
      art: "text",
      x: FLAECHE.breite / 2,
      y: FLAECHE.hoehe / 2,
      text: "Text",
    };
    setElemente((prev) => [...prev, neu]);
    setSelectedId(neu.id);
  }

  function setText(id: string, text: string) {
    setElemente((prev) =>
      prev.map((el) => (el.id === id && el.art === "text" ? { ...el, text } : el)),
    );
  }

  // Drehen in festen 45°-Schritten — andere Winkel gibt es nicht (#51 AK3).
  function drehen(id: string, delta: 45 | -45) {
    merken();
    setElemente((prev) =>
      prev.map((el) =>
        el.id === id && el.art === "symbol" && symbolDef(el.typ).drehbar
          ? { ...el, rotation: (((el.rotation ?? 0) + delta + 360) % 360) as Rotation }
          : el,
      ),
    );
  }

  function onElementPointerDown(e: React.PointerEvent, el: DiagrammElement) {
    // Im Zeichenmodus zählen Klicks auf Elemente als Stützpunkte (kein Drag).
    if (zeichnen) return;
    e.stopPropagation();
    setSelectedId(el.id);
    const svg = svgRef.current;
    if (!svg) return;
    merken();
    const p = flaechenPunkt(svg, e);
    dragRef.current =
      el.art === "pfad"
        ? { modus: "pfad", id: el.id, start: p, orig: el.punkte }
        : el.art === "zone"
          ? { modus: "zone", id: el.id, start: p, orig: el }
          : { modus: "punktig", id: el.id, dx: p.x - el.x, dy: p.y - el.y };
    svg.setPointerCapture(e.pointerId);
  }

  /** Grösse-Anfasser einer Zone gepackt (#53 AK4). */
  function onResizePointerDown(e: React.PointerEvent, el: ZoneElement) {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    merken();
    dragRef.current = { modus: "groesse", id: el.id, orig: el };
    svg.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    if (zeichnen) {
      setHoverPunkt(flaechenPunkt(svg, e));
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    const p = flaechenPunkt(svg, e);
    setElemente((prev) =>
      prev.map((el) => {
        if (el.id !== drag.id) return el;
        if (drag.modus === "punktig" && el.art !== "pfad") {
          return {
            ...el,
            x: clamp(p.x - drag.dx, FLAECHE.breite),
            y: clamp(p.y - drag.dy, FLAECHE.hoehe),
          };
        }
        if (drag.modus === "pfad" && el.art === "pfad") {
          // Ganzen Pfad verschieben; Delta so begrenzen, dass die
          // Begrenzungsbox auf der Fläche bleibt (keine Verformung).
          const box = bbox(drag.orig);
          const dx = clamp(p.x - drag.start.x + box.minX, FLAECHE.breite - (box.maxX - box.minX)) - box.minX;
          const dy = clamp(p.y - drag.start.y + box.minY, FLAECHE.hoehe - (box.maxY - box.minY)) - box.minY;
          return { ...el, punkte: drag.orig.map((q) => ({ x: q.x + dx, y: q.y + dy })) };
        }
        if (drag.modus === "zone" && el.art === "zone") {
          const o = drag.orig;
          const dx = clamp(p.x - drag.start.x + o.x, FLAECHE.breite - o.breite) - o.x;
          const dy = clamp(p.y - drag.start.y + o.y, FLAECHE.hoehe - o.hoehe) - o.y;
          return {
            ...el,
            x: o.x + dx,
            y: o.y + dy,
            punkte: o.punkte?.map((q) => ({ x: q.x + dx, y: q.y + dy })),
          };
        }
        if (drag.modus === "groesse" && el.art === "zone") {
          const o = drag.orig;
          const breite = Math.max(60, clamp(p.x, FLAECHE.breite) - o.x);
          const hoehe = Math.max(60, clamp(p.y, FLAECHE.hoehe) - o.y);
          // Polygon-Punkte proportional zur neuen Begrenzung skalieren.
          const punkte = o.punkte?.map((q) => ({
            x: o.breite > 0 ? o.x + (q.x - o.x) * (breite / o.breite) : q.x,
            y: o.hoehe > 0 ? o.y + (q.y - o.y) * (hoehe / o.hoehe) : q.y,
          }));
          return { ...el, breite, hoehe, punkte };
        }
        return el;
      }),
    );
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  const selected = elemente.find((e) => e.id === selectedId) ?? null;

  const statusText: Record<SaveStatus, string> = {
    gespeichert: "Gespeichert",
    ausstehend: "Änderungen …",
    speichert: "Wird gespeichert …",
    fehler: "Speichern fehlgeschlagen — Änderung wird erneut versucht.",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Werkzeug-Palette */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(SYMBOLE) as SymbolTyp[]).map((typ) => (
          <Button key={typ} variant="tonal" size="sm" disabled={!!zeichnen} onClick={() => addSymbol(typ)}>
            {SYMBOLE[typ].label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outlined"
            size="sm"
            onClick={rueckgaengig}
            disabled={verlauf.length === 0 || !!zeichnen}
            aria-label="Rückgängig"
          >
            <Undo2 size={16} strokeWidth={2} aria-hidden />
          </Button>
          <Button
            variant="outlined"
            size="sm"
            onClick={wiederherstellen}
            disabled={zukunft.length === 0 || !!zeichnen}
            aria-label="Wiederherstellen"
          >
            <Redo2 size={16} strokeWidth={2} aria-hidden />
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={removeSelected}
            disabled={!selected || !!zeichnen}
            aria-label="Ausgewähltes Element entfernen"
          >
            <Trash2 size={16} strokeWidth={2} aria-hidden />
            Entfernen
          </Button>
        </div>
      </div>

      {/* Bewegungs-/Linien-Werkzeuge (#52), Zonen und Textbox (#53) */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Bewegungen, Linien, Zonen und Text">
        {(Object.keys(PFAD_WERKZEUGE) as PfadTyp[]).map((typ) => (
          <Button
            key={typ}
            variant={zeichnen?.werkzeug === typ ? "filled" : "outlined"}
            size="sm"
            aria-pressed={zeichnen?.werkzeug === typ}
            disabled={!!zeichnen && zeichnen.werkzeug !== typ}
            onClick={() => (zeichnen?.werkzeug === typ ? abbrechenZeichnen() : startZeichnen(typ))}
          >
            {PFAD_WERKZEUGE[typ]}
          </Button>
        ))}
        <span aria-hidden className="h-5 w-px bg-outline-variant" />
        {(Object.keys(ZONEN_WERKZEUGE) as ZonenForm[]).map((form) =>
          form === "polygon" ? (
            <Button
              key={form}
              variant={zeichnen?.werkzeug === "polygon" ? "filled" : "outlined"}
              size="sm"
              aria-pressed={zeichnen?.werkzeug === "polygon"}
              disabled={!!zeichnen && zeichnen.werkzeug !== "polygon"}
              onClick={() =>
                zeichnen?.werkzeug === "polygon" ? abbrechenZeichnen() : startZeichnen("polygon")
              }
            >
              Zone Polygon
            </Button>
          ) : (
            <Button key={form} variant="outlined" size="sm" disabled={!!zeichnen} onClick={() => addZone(form)}>
              Zone {ZONEN_WERKZEUGE[form]}
            </Button>
          ),
        )}
        <Button variant="outlined" size="sm" disabled={!!zeichnen} onClick={addText}>
          Textbox
        </Button>
        {zeichnen && (
          <>
            <span className="type-body-small text-on-surface-variant" data-testid="zeichnen-hinweis">
              {zeichnen.werkzeug === "pass"
                ? "Start und Ziel anklicken."
                : zeichnen.werkzeug === "polygon"
                  ? "Eckpunkte der Zone anklicken (mindestens drei)."
                  : "Punkte auf der Fläche anklicken; Knicke und Kurven entstehen über mehrere Punkte."}
            </span>
            {zeichnen.werkzeug !== "pass" && (
              <Button
                variant="filled"
                size="sm"
                onClick={() => fertigZeichnen()}
                disabled={zeichnen.punkte.length < minPunkte(zeichnen.werkzeug)}
              >
                <Check size={16} strokeWidth={2} aria-hidden />
                Fertig
              </Button>
            )}
            <Button variant="text" size="sm" onClick={abbrechenZeichnen}>
              <X size={16} strokeWidth={2} aria-hidden />
              Abbrechen
            </Button>
          </>
        )}
      </div>

      {/* Drehung für das ausgewählte richtungsbehaftete Element */}
      {selected?.art === "symbol" && symbolDef(selected.typ).drehbar && (
        <div className="flex items-center gap-2" role="group" aria-label="Element drehen">
          <span className="type-label-small text-on-surface-variant">Drehen</span>
          <Button variant="outlined" size="sm" onClick={() => drehen(selected.id, -45)} aria-label="45 Grad nach links drehen">
            <RotateCcw size={16} strokeWidth={2} aria-hidden />
            45°
          </Button>
          <Button variant="outlined" size="sm" onClick={() => drehen(selected.id, 45)} aria-label="45 Grad nach rechts drehen">
            <RotateCw size={16} strokeWidth={2} aria-hidden />
            45°
          </Button>
          <span className="type-body-small text-on-surface-variant" data-testid="rotation-anzeige">
            {selected.rotation ?? 0}°
          </span>
        </div>
      )}

      {/* Texteingabe für die ausgewählte Textbox (#53 AK6) */}
      {selected?.art === "text" && (
        <div className="flex items-center gap-2">
          <label htmlFor="textbox-text" className="type-label-small text-on-surface-variant">
            Text
          </label>
          <input
            id="textbox-text"
            type="text"
            maxLength={MAX_TEXT_LAENGE}
            value={selected.text}
            onFocus={merken}
            onChange={(e) => setText(selected.id, e.target.value)}
            className="focus-ring type-body-medium w-72 rounded-(--field-shape) border-[1.5px] border-(--field-outline) bg-transparent px-3 py-2 text-on-surface"
          />
        </div>
      )}

      {/* Farbwahl: färbbare Symbole, freie Linien (#52 AK5) und Zonen (#53 AK3) */}
      {((selected?.art === "symbol" && symbolDef(selected.typ).faerbbar) ||
        (selected?.art === "pfad" && selected.typ === "linie") ||
        selected?.art === "zone") && (
        <div className="flex items-center gap-2" role="group" aria-label="Farbe des Elements">
          <span className="type-label-small text-on-surface-variant">Farbe</span>
          {farbSlugs.map((slug) => {
            const standard =
              selected.art === "symbol"
                ? symbolDef(selected.typ).defaultFarbe
                : selected.art === "zone"
                  ? ZONE_DEFAULT_FARBE
                  : LINIE_DEFAULT_FARBE;
            const aktiv = (selected.farbe ?? standard) === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => setFarbe(selected.id, slug)}
                aria-label={`Farbe ${slug}`}
                aria-pressed={aktiv}
                className={`focus-ring h-7 w-7 rounded-full border-2 ${
                  aktiv ? "border-on-surface" : "border-outline-variant"
                }`}
                style={{ backgroundColor: FARBEN[slug] }}
              />
            );
          })}
        </div>
      )}

      {/* Linienstil für freie Linien (#52 AK6) */}
      {selected?.art === "pfad" && selected.typ === "linie" && (
        <div className="flex items-center gap-2" role="group" aria-label="Linienstil">
          <span className="type-label-small text-on-surface-variant">Stil</span>
          <Button
            variant={selected.gestrichelt ? "outlined" : "filled"}
            size="sm"
            aria-pressed={!selected.gestrichelt}
            onClick={() => setGestrichelt(selected.id, false)}
          >
            Durchgezogen
          </Button>
          <Button
            variant={selected.gestrichelt ? "filled" : "outlined"}
            size="sm"
            aria-pressed={!!selected.gestrichelt}
            onClick={() => setGestrichelt(selected.id, true)}
          >
            Gestrichelt
          </Button>
        </div>
      )}

      {/* Zeichenfläche */}
      <div
        className="overflow-hidden rounded-[6px] border border-outline-variant focus-ring"
        tabIndex={0}
        role="application"
        aria-label="Zeichenfläche für das Feld-Diagramm"
        onKeyDown={(e) => {
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            removeSelected();
          }
          if (e.key === "Escape") abbrechenZeichnen();
          if (e.key === "Enter" && zeichnen) fertigZeichnen();
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
            e.preventDefault();
            if (e.shiftKey) wiederherstellen();
            else rueckgaengig();
          }
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${FLAECHE.breite} ${FLAECHE.hoehe}`}
          className={`block h-auto w-full touch-none select-none ${zeichnen ? "cursor-crosshair" : ""}`}
          data-testid="diagramm-flaeche"
          onPointerDown={(e) => {
            if (zeichnen) {
              zeichnenKlick(flaechenPunkt(e.currentTarget, e));
            } else {
              setSelectedId(null);
            }
          }}
          onDoubleClick={() => fertigZeichnen()}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <Rasen />
          {sortiertNachEbene(elemente).map((el) => (
            <g
              key={el.id}
              data-element-id={el.id}
              className="cursor-move"
              onPointerDown={(e) => onElementPointerDown(e, el)}
            >
              {/* Unsichtbare Treffer-Flächen: machen auch Symbole mit
                  fill="none" (Reifen) und dünne Linien zuverlässig greifbar. */}
              {el.art === "symbol" && <TrefferFlaeche element={el} />}
              {el.art === "pfad" && (
                <polyline
                  points={punkteAttr(el.punkte)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={28}
                />
              )}
              <ElementGrafik element={el} />
              {el.id === selectedId && <SelektionsRahmen element={el} />}
              {el.id === selectedId && el.art === "zone" && (
                <rect
                  x={el.x + el.breite - 11}
                  y={el.y + el.hoehe - 11}
                  width={22}
                  height={22}
                  fill="#ffffff"
                  stroke="rgba(0,0,0,.45)"
                  strokeWidth={2}
                  className="cursor-nwse-resize"
                  data-testid="zone-anfasser"
                  onPointerDown={(e) => onResizePointerDown(e, el)}
                />
              )}
            </g>
          ))}

          {/* Vorschau des entstehenden Pfads bzw. der Polygon-Zone */}
          {zeichnen && zeichnen.punkte.length > 0 && (
            <g pointerEvents="none" opacity={0.75} data-testid="zeichnen-vorschau">
              {zeichnen.werkzeug === "polygon" ? (
                <ZoneGrafik
                  element={{
                    id: "vorschau",
                    art: "zone",
                    form: "polygon",
                    x: 0,
                    y: 0,
                    breite: 0,
                    hoehe: 0,
                    punkte: hoverPunkt ? [...zeichnen.punkte, hoverPunkt] : zeichnen.punkte,
                  }}
                />
              ) : (
                <PfadGrafik
                  element={{
                    id: "vorschau",
                    art: "pfad",
                    typ: zeichnen.werkzeug,
                    punkte: hoverPunkt ? [...zeichnen.punkte, hoverPunkt] : zeichnen.punkte,
                  }}
                />
              )}
              {zeichnen.punkte.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={6} fill="#ffffff" stroke="rgba(0,0,0,.4)" />
              ))}
            </g>
          )}
        </svg>
      </div>

      <p
        className={`type-body-small ${status === "fehler" ? "text-error" : "text-on-surface-variant"}`}
        role="status"
        data-testid="autosave-status"
      >
        {statusText[status]}
      </p>
    </div>
  );
}

function TrefferFlaeche({
  element,
}: {
  element: Extract<DiagrammElement, { art: "symbol" }>;
}) {
  const def = symbolDef(element.typ);
  return (
    <rect
      x={element.x - def.breite / 2}
      y={element.y - def.hoehe / 2}
      width={def.breite}
      height={def.hoehe}
      fill="transparent"
      transform={`rotate(${element.rotation ?? 0} ${element.x} ${element.y})`}
    />
  );
}

function SelektionsRahmen({ element }: { element: DiagrammElement }) {
  const r = 8; // Luft um die Element-Begrenzung
  let x: number, y: number, b: number, h: number;
  if (element.art === "symbol") {
    const def = symbolDef(element.typ);
    x = element.x - def.breite / 2;
    y = element.y - def.hoehe / 2;
    b = def.breite;
    h = def.hoehe;
  } else if (element.art === "pfad") {
    const box = bbox(element.punkte);
    x = box.minX;
    y = box.minY;
    b = box.maxX - box.minX;
    h = box.maxY - box.minY;
  } else if (element.art === "zone") {
    x = element.x;
    y = element.y;
    b = element.breite;
    h = element.hoehe;
  } else {
    const box = textBox(element);
    x = box.x;
    y = box.y;
    b = box.breite;
    h = box.hoehe;
  }
  return (
    <rect
      x={x - r}
      y={y - r}
      width={b + r * 2}
      height={h + r * 2}
      fill="none"
      stroke="#ffffff"
      strokeWidth={2.5}
      strokeDasharray="6 4"
      pointerEvents="none"
    />
  );
}
