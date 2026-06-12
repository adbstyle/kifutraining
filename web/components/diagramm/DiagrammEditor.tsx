"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  FLAECHE,
  DIAGRAMM_VERSION,
  FARBEN,
  farbSlugs,
  type FarbSlug,
  type DiagrammData,
  type DiagrammElement,
  type SymbolTyp,
  type Punkt,
  type Rotation,
} from "@/lib/diagramm";
import { saveDiagramm } from "@/lib/actions/diagramm";
import { SYMBOLE, symbolDef } from "./symbols";
import { Rasen, ElementGrafik, sortiertNachEbene } from "./DiagrammView";

type SaveStatus = "gespeichert" | "ausstehend" | "speichert" | "fehler";

const AUTOSAVE_MS = 800;

/** Pointer-Position -> Flächen-Koordinaten (berücksichtigt viewBox-Skalierung). */
function flaechenPunkt(svg: SVGSVGElement, e: { clientX: number; clientY: number }): Punkt {
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);

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

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const ersterRender = useRef(true);

  // Autosave: debounced nach jeder Änderung (#49 AK6). Kein expliziter
  // Speicher-Schritt; Status informiert über ausstehend/gespeichert/Fehler.
  useEffect(() => {
    if (ersterRender.current) {
      ersterRender.current = false;
      return;
    }
    setStatus("ausstehend");
    const timer = setTimeout(async () => {
      setStatus("speichert");
      const result = await saveDiagramm(exerciseId, {
        version: DIAGRAMM_VERSION,
        elemente,
      });
      setStatus(result.ok ? "gespeichert" : "fehler");
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [elemente, exerciseId]);

  function addSymbol(typ: SymbolTyp) {
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
    setElemente((prev) => prev.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  }

  function setFarbe(id: string, farbe: FarbSlug) {
    setElemente((prev) =>
      prev.map((el) => (el.id === id && el.art === "symbol" ? { ...el, farbe } : el)),
    );
  }

  // Drehen in festen 45°-Schritten — andere Winkel gibt es nicht (#51 AK3).
  function drehen(id: string, delta: 45 | -45) {
    setElemente((prev) =>
      prev.map((el) =>
        el.id === id && el.art === "symbol" && symbolDef(el.typ).drehbar
          ? { ...el, rotation: (((el.rotation ?? 0) + delta + 360) % 360) as Rotation }
          : el,
      ),
    );
  }

  function onElementPointerDown(e: React.PointerEvent, el: DiagrammElement) {
    if (el.art !== "symbol") return;
    e.stopPropagation();
    setSelectedId(el.id);
    const svg = svgRef.current;
    if (!svg) return;
    const p = flaechenPunkt(svg, e);
    dragRef.current = { id: el.id, dx: p.x - el.x, dy: p.y - el.y };
    svg.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    const p = flaechenPunkt(svg, e);
    setElemente((prev) =>
      prev.map((el) =>
        el.id === drag.id && el.art === "symbol"
          ? {
              ...el,
              x: clamp(p.x - drag.dx, FLAECHE.breite),
              y: clamp(p.y - drag.dy, FLAECHE.hoehe),
            }
          : el,
      ),
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
          <Button key={typ} variant="tonal" size="sm" onClick={() => addSymbol(typ)}>
            {SYMBOLE[typ].label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="danger"
            size="sm"
            onClick={removeSelected}
            disabled={!selected}
            aria-label="Ausgewähltes Element entfernen"
          >
            <Trash2 size={16} strokeWidth={2} aria-hidden />
            Entfernen
          </Button>
        </div>
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

      {/* Farbwahl für das ausgewählte färbbare Element */}
      {selected?.art === "symbol" && symbolDef(selected.typ).faerbbar && (
        <div className="flex items-center gap-2" role="group" aria-label="Farbe des Elements">
          <span className="type-label-small text-on-surface-variant">Farbe</span>
          {farbSlugs.map((slug) => {
            const aktiv = (selected.farbe ?? symbolDef(selected.typ).defaultFarbe) === slug;
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
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${FLAECHE.breite} ${FLAECHE.hoehe}`}
          className="block h-auto w-full touch-none select-none"
          data-testid="diagramm-flaeche"
          onPointerDown={() => setSelectedId(null)}
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
              {/* Unsichtbare Treffer-Fläche: macht auch Symbole mit
                  fill="none" (Reifen) oder dünnen Linien zuverlässig greifbar. */}
              {el.art === "symbol" && <TrefferFlaeche element={el} />}
              <ElementGrafik element={el} />
              {el.id === selectedId && el.art === "symbol" && (
                <SelektionsRahmen element={el} />
              )}
            </g>
          ))}
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

function SelektionsRahmen({
  element,
}: {
  element: Extract<DiagrammElement, { art: "symbol" }>;
}) {
  const def = symbolDef(element.typ);
  const r = 8; // Luft um die Symbol-Begrenzung
  return (
    <rect
      x={element.x - def.breite / 2 - r}
      y={element.y - def.hoehe / 2 - r}
      width={def.breite + r * 2}
      height={def.hoehe + r * 2}
      fill="none"
      stroke="#ffffff"
      strokeWidth={2.5}
      strokeDasharray="6 4"
      pointerEvents="none"
    />
  );
}
