"use client";

import { Fragment, forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ClipboardPaste, Copy, Ellipsis, Minus, PaintBucket, Redo2, RotateCcw, RotateCw, Trash2, Undo2, Waypoints, X } from "lucide-react";
import { Breadcrumbs, type BreadcrumbItem, Button, IconButton, Tooltip } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  FLAECHE,
  DIAGRAMM_VERSION,
  FARBEN,
  FORM_DEFAULT_FARBE,
  LINIE_DEFAULT_FARBE,
  MAX_TEXT_LAENGE,
  bbox,
  dreieckEcken,
  farbSlugs,
  type FarbSlug,
  type DiagrammData,
  type DiagrammElement,
  type PfadTyp,
  type SymbolTyp,
  type Punkt,
  type Rotation,
  type TextElement,
  type FormElement,
  type FormTyp,
} from "@/lib/diagramm";
import { saveDiagramm } from "@/lib/actions/diagramm";
import { SYMBOLE, symbolDef } from "./symbols";
import {
  Rasen,
  ElementGrafik,
  GlyphVorschau,
  PfadGrafik,
  FormGrafik,
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

/** Diagonaler Versatz pro Einfügen, damit Kopien kaskadieren statt stapeln (#63 AK6). */
const EINFUEGE_VERSATZ = 40;

/** Eigenständige Kopie eines Elements mit diagonalem Versatz (#63).
 *  Punkt-Geometrie wird tief kopiert; der Versatz ist so begrenzt,
 *  dass die Kopie vollständig auf der Fläche bleibt. */
function versetzteKopie(el: DiagrammElement, versatz: number): DiagrammElement {
  const id = crypto.randomUUID();
  switch (el.art) {
    case "symbol":
    case "text":
      return {
        ...el,
        id,
        x: clamp(el.x + versatz, FLAECHE.breite),
        y: clamp(el.y + versatz, FLAECHE.hoehe),
      };
    case "pfad": {
      const box = bbox(el.punkte);
      const dx = clamp(box.minX + versatz, FLAECHE.breite - (box.maxX - box.minX)) - box.minX;
      const dy = clamp(box.minY + versatz, FLAECHE.hoehe - (box.maxY - box.minY)) - box.minY;
      return { ...el, id, punkte: el.punkte.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    }
    case "form": {
      const dx = clamp(el.x + versatz, FLAECHE.breite - el.breite) - el.x;
      const dy = clamp(el.y + versatz, FLAECHE.hoehe - el.hoehe) - el.y;
      return {
        ...el,
        id,
        x: el.x + dx,
        y: el.y + dy,
        punkte: el.punkte?.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      };
    }
  }
}

/** Welche Ecke einer Form gezogen wird; die gegenüberliegende bleibt Anker. */
type Ecke = "tl" | "tr" | "bl" | "br";

type Drag = { gemerkt: boolean } & (
  | { modus: "punktig"; id: string; dx: number; dy: number }
  | { modus: "pfad"; id: string; start: Punkt; orig: Punkt[] }
  | { modus: "form"; id: string; start: Punkt; orig: FormElement }
  | { modus: "groesse"; id: string; orig: FormElement; ecke: Ecke }
  // Einzelner Stütz-/Eckpunkt im Form-Bearbeitungsmodus (#66).
  | { modus: "vertex"; id: string; index: number }
);

/** Mindestkantenlänge einer Form beim Resize (verhindert Entartung). */
const FORM_MIN = 60;

/** Punktbasiert form-bearbeitbar (#66): Pfade sowie Polygone und Dreiecke —
 *  alle über ihre Stütz-/Eckpunkte. Rechteck/Ellipse haben keine Eckpunkte. */
function geometrieEditierbar(el: DiagrammElement): boolean {
  return (
    el.art === "pfad" ||
    (el.art === "form" && (el.form === "polygon" || el.form === "dreieck"))
  );
}

/** Über Eck-Anfasser in der Grösse anpassbar (#66): Rechteck und Ellipse —
 *  ihre Grundform bleibt dabei erhalten. */
function formResizable(el: DiagrammElement): el is FormElement {
  return el.art === "form" && (el.form === "rechteck" || el.form === "ellipse");
}

/** Editierbare Punkte einer Form: vorhandene punkte, sonst die abgeleiteten
 *  Dreieck-Ecken (Materialisierung beim ersten Bearbeiten). */
function formPunkte(el: FormElement): Punkt[] {
  // Dreieck: drei freie Ecken, sonst aus der Box abgeleitet (identisch zur
  // Render-Logik in FormGrafik). Polygon trägt seine Punkte stets selbst.
  if (el.form === "dreieck") {
    return el.punkte?.length === 3 ? el.punkte : dreieckEcken(el.x, el.y, el.breite, el.hoehe);
  }
  return el.punkte ?? [];
}

/** Was gerade Punkt für Punkt gezeichnet wird: Bewegung/Linie oder Polygon-Form. */
type Zeichnen = { werkzeug: PfadTyp | "polygon"; punkte: Punkt[] };

const FORMEN: Record<FormTyp, string> = {
  rechteck: "Rechteck",
  ellipse: "Ellipse",
  dreieck: "Dreieck",
  polygon: "Polygon",
};

/** Cluster-Reihenfolge des Glyph-Bands (gruppiert, ohne sichtbare Überschrift —
 *  die Anordnung trägt die Gruppierung, der Tooltip den Namen). */
const GRUPPE_TORE: SymbolTyp[] = ["tor", "minitor"];
const GRUPPE_MATERIAL: SymbolTyp[] = ["pylone", "teller", "stange", "reifen", "huerde"];
const GRUPPE_PERSONEN: SymbolTyp[] = ["spieler", "torwart"];
const GRUPPE_BAELLE: SymbolTyp[] = ["fussball", "handball", "tennisball"];

/** Statische Mini-Vorschau-Elemente für die Kacheln — Koordinaten sind
 *  beliebig, `GlyphVorschau` passt den Inhalt quadratisch ein. */
const symVorschau = (typ: SymbolTyp): DiagrammElement => ({
  id: `v-${typ}`,
  art: "symbol",
  typ,
  x: 0,
  y: 0,
  farbe: SYMBOLE[typ].defaultFarbe,
});
const pfadVorschau = (typ: PfadTyp): DiagrammElement => ({
  id: `v-${typ}`,
  art: "pfad",
  typ,
  // Linie waagrecht (kein Pfeil), Bewegungen diagonal aufwärts (Richtung sichtbar).
  punkte: typ === "linie" ? [{ x: 0, y: 45 }, { x: 90, y: 45 }] : [{ x: 8, y: 88 }, { x: 64, y: 6 }],
});
const formVorschau = (form: FormTyp): DiagrammElement =>
  form === "polygon"
    ? {
        id: "v-form-polygon",
        art: "form",
        form,
        x: 0,
        y: 0,
        breite: 90,
        hoehe: 90,
        punkte: [{ x: 12, y: 22 }, { x: 82, y: 10 }, { x: 90, y: 72 }, { x: 38, y: 86 }],
      }
    : { id: `v-form-${form}`, art: "form", form, x: 4, y: 18, breite: 92, hoehe: 60 };
const textVorschau: DiagrammElement = { id: "v-text", art: "text", x: 0, y: 0, text: "T" };

/** Eine Werkzeug-Kachel des Bands. */
type Kachel = {
  key: string;
  label: string;
  element: DiagrammElement;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
};

/** WYSIWYG-Glyph-Kachel: Mini-Vorschau des Elements, Name nur per Tooltip +
 *  aria-label (kein sichtbarer Text). Aktive Zeichen-Werkzeuge sind markiert. */
function GlyphKachel({ label, element, active = false, disabled = false, onClick }: Kachel) {
  return (
    <Tooltip label={label} placement="bottom">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "focus-ring flex size-12 items-center justify-center overflow-hidden rounded-[6px] border transition-colors",
          active ? "border-primary ring-1 ring-primary" : "border-outline-variant hover:border-outline",
          disabled && "cursor-not-allowed opacity-40 hover:border-outline-variant",
        )}
      >
        <GlyphVorschau element={element} groesse={40} />
      </button>
    </Tooltip>
  );
}

export function DiagrammEditor({
  exerciseId,
  name,
  crumbs,
  initial,
}: {
  exerciseId: string;
  name: string;
  crumbs: BreadcrumbItem[];
  initial: DiagrammData;
}) {
  const [elemente, setElemente] = useState<DiagrammElement[]>(initial.elemente);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Form-Bearbeitungsmodus (#66): zeigt am Element greifbare Stütz-/Eckpunkte.
  // Nur das „tiefer ausgewählte" Element ist editierbar; null = nur Auswahl.
  const [bearbeitenId, setBearbeitenId] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("gespeichert");
  // Aktiver Zeichenmodus (#52/#53): Klicks setzen Stützpunkte.
  const [zeichnen, setZeichnen] = useState<Zeichnen | null>(null);
  const [hoverPunkt, setHoverPunkt] = useState<Punkt | null>(null);

  // Undo/Redo (#54): Schnappschüsse vor jeder abgeschlossenen Bearbeitung;
  // ein Drag zählt als EIN Schritt (Schnappschuss beim Greifen).
  const [verlauf, setVerlauf] = useState<DiagrammElement[][]>([]);
  const [zukunft, setZukunft] = useState<DiagrammElement[][]>([]);

  // Zwischenablage (#63): Schnappschuss zum Kopier-Zeitpunkt, bewusst
  // ausserhalb des Undo-Verlaufs — Ändern/Löschen des Originals und
  // Undo lassen den kopierten Stand unberührt (AK10). Der Zähler
  // staffelt den Versatz, damit Mehrfach-Einfügen kaskadiert (AK6);
  // als Ref, weil er kein Rendering treibt und so auch bei schnell
  // aufeinanderfolgendem Einfügen nie einen veralteten Stand liest.
  const [zwischenablage, setZwischenablage] = useState<DiagrammElement | null>(null);
  const eingefuegtRef = useRef(0);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const ersterRender = useRef(true);
  // Saves laufen strikt nacheinander: ein langsamer älterer Save kann so
  // nie einen neueren Stand in der DB überschreiben.
  const saveKette = useRef<Promise<unknown>>(Promise.resolve());

  // Kontextuelle Element-Leiste (#65): schwebt am ausgewählten Element und
  // verdrängt nichts im Layout — die Zeichenfläche bleibt ruhig stehen.
  const wrapRef = useRef<HTMLDivElement>(null);
  const leisteRef = useRef<HTMLDivElement>(null);
  const [leistePos, setLeistePos] = useState<{ left: number; top: number } | null>(null);
  // Gerenderte Breite der Fläche in Pixel → viewBox-Koordinaten umrechnen.
  const [flaecheBreite, setFlaecheBreite] = useState(0);
  // Während eines Drags tritt die Leiste zurück, damit das Element frei und
  // unverdeckt platziert werden kann (#65 AK6).
  const [dragAktiv, setDragAktiv] = useState(false);
  // Inline-Textbearbeitung (#65 AK9): direkt am Element statt im Werkzeugbereich.
  const [editId, setEditId] = useState<string | null>(null);
  const editAusgang = useRef("");
  const textGemerkt = useRef(false);

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
    setBearbeitenId(null);
  }

  function wiederherstellen() {
    if (zukunft.length === 0) return;
    const naechster = zukunft[zukunft.length - 1];
    setZukunft((z) => z.slice(0, -1));
    setVerlauf((v) => [...v, elemente]);
    setElemente(naechster);
    setSelectedId(null);
    setBearbeitenId(null);
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
    setBearbeitenId(null);
  }

  // In den Form-Bearbeitungsmodus wechseln (#66): „tiefer auswählen" per
  // Doppelklick oder Leisten-Knopf. Beim Dreieck werden die Anfasser aus den
  // abgeleiteten Ecken gezeigt (formPunkte); die Punkte werden erst beim ersten
  // Eckpunkt-Drag materialisiert — als regulärer, rückgängig machbarer Schritt.
  function bearbeitenStart(el: DiagrammElement) {
    if (zeichnen || !geometrieEditierbar(el)) return;
    setSelectedId(el.id);
    setBearbeitenId(el.id);
  }

  function kopieren() {
    if (zeichnen) return;
    const el = elemente.find((e) => e.id === selectedId);
    if (!el) return;
    setZwischenablage(el);
    eingefuegtRef.current = 0;
  }

  function einfuegen() {
    if (!zwischenablage || zeichnen) return;
    merken();
    eingefuegtRef.current += 1;
    const neu = versetzteKopie(zwischenablage, eingefuegtRef.current * EINFUEGE_VERSATZ);
    setElemente((prev) => [...prev, neu]);
    setSelectedId(neu.id);
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

  function setGefuellt(id: string, gefuellt: boolean) {
    merken();
    setElemente((prev) =>
      prev.map((el) => (el.id === id && el.art === "form" ? { ...el, gefuellt } : el)),
    );
  }

  function startZeichnen(werkzeug: PfadTyp | "polygon") {
    setSelectedId(null);
    setBearbeitenId(null);
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
                art: "form" as const,
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

  function addForm(form: Exclude<FormTyp, "polygon">) {
    merken();
    const neu: DiagrammElement = {
      id: crypto.randomUUID(),
      art: "form",
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
    // Auswahl eines anderen Elements verlässt den Form-Bearbeitungsmodus.
    if (el.id !== bearbeitenId) setBearbeitenId(null);
    setSelectedId(el.id);
    const svg = svgRef.current;
    if (!svg) return;
    const p = flaechenPunkt(svg, e);
    // gemerkt=false: der Undo-Schnappschuss entsteht erst bei der ersten
    // echten Bewegung — blosses Selektieren flutet den Verlauf nicht.
    dragRef.current =
      el.art === "pfad"
        ? { gemerkt: false, modus: "pfad", id: el.id, start: p, orig: el.punkte }
        : el.art === "form"
          ? { gemerkt: false, modus: "form", id: el.id, start: p, orig: el }
          : { gemerkt: false, modus: "punktig", id: el.id, dx: p.x - el.x, dy: p.y - el.y };
    svg.setPointerCapture(e.pointerId);
  }

  /** Eck-Anfasser einer Form gepackt (#53 AK4, #66: alle vier Ecken). */
  function onResizePointerDown(e: React.PointerEvent, el: FormElement, ecke: Ecke) {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    dragRef.current = { gemerkt: false, modus: "groesse", id: el.id, orig: el, ecke };
    svg.setPointerCapture(e.pointerId);
  }

  /** Einzelnen Stütz-/Eckpunkt im Bearbeitungsmodus gepackt (#66). */
  function onVertexPointerDown(e: React.PointerEvent, el: DiagrammElement, index: number) {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    dragRef.current = { gemerkt: false, modus: "vertex", id: el.id, index };
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
    if (!drag.gemerkt) {
      merken();
      drag.gemerkt = true;
      setDragAktiv(true);
    }
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
        if (drag.modus === "form" && el.art === "form") {
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
        if (drag.modus === "groesse" && el.art === "form") {
          const o = drag.orig;
          const px = clamp(p.x, FLAECHE.breite);
          const py = clamp(p.y, FLAECHE.hoehe);
          const rechts = o.x + o.breite;
          const unten = o.y + o.hoehe;
          // Gezogene Kante folgt dem Pointer; die gegenüberliegende bleibt Anker.
          const links = drag.ecke === "tl" || drag.ecke === "bl";
          const oben = drag.ecke === "tl" || drag.ecke === "tr";
          const x = links ? Math.min(px, rechts - FORM_MIN) : o.x;
          const breite = links ? rechts - x : Math.max(FORM_MIN, px - o.x);
          const y = oben ? Math.min(py, unten - FORM_MIN) : o.y;
          const hoehe = oben ? unten - y : Math.max(FORM_MIN, py - o.y);
          return { ...el, x, y, breite, hoehe };
        }
        if (drag.modus === "vertex") {
          const np = { x: clamp(p.x, FLAECHE.breite), y: clamp(p.y, FLAECHE.hoehe) };
          if (el.art === "pfad") {
            return { ...el, punkte: el.punkte.map((q, i) => (i === drag.index ? np : q)) };
          }
          if (el.art === "form") {
            // Eckpunkt verschieben; Begrenzungsbox aus den Punkten nachführen,
            // damit Selektionsrahmen und Leisten-Verankerung konsistent bleiben.
            const punkte = formPunkte(el).map((q, i) => (i === drag.index ? np : q));
            const box = bbox(punkte);
            return {
              ...el,
              punkte,
              x: box.minX,
              y: box.minY,
              breite: box.maxX - box.minX,
              hoehe: box.maxY - box.minY,
            };
          }
        }
        return el;
      }),
    );
  }

  function onPointerUp() {
    dragRef.current = null;
    setDragAktiv(false);
  }

  // Inline-Textbearbeitung (#65 AK9): Doppelklick öffnet die Eingabe direkt am
  // Element. Verlassen übernimmt, Escape verwirft (#65 PC3).
  function starteTextBearbeitung(el: TextElement) {
    if (zeichnen) return;
    setSelectedId(el.id);
    editAusgang.current = el.text;
    textGemerkt.current = false;
    setEditId(el.id);
  }

  function bearbeiteText(id: string, text: string) {
    // Ein Schnappschuss pro Bearbeitung: der ganze Edit ist ein Undo-Schritt.
    if (!textGemerkt.current) {
      merken();
      textGemerkt.current = true;
    }
    setText(id, text);
  }

  function beendeTextBearbeitung(abbrechen: boolean) {
    // Schützt vor doppeltem Aufruf (z. B. Escape-keydown UND folgendes Blur):
    // der zweite Lauf trifft auf editId === null und tut nichts.
    if (editId === null) return;
    if (abbrechen && textGemerkt.current) {
      // Auf den Ausgangstext zurück und den Edit-Schnappschuss wieder entfernen.
      setText(editId, editAusgang.current);
      setVerlauf((v) => v.slice(0, -1));
    }
    setEditId(null);
    textGemerkt.current = false;
  }

  const selected = elemente.find((e) => e.id === selectedId) ?? null;

  // Rendergrösse der Fläche verfolgen, damit die Leiste in Pixel positioniert
  // werden kann (das SVG skaliert über die viewBox mit der Containerbreite).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const messen = () => setFlaecheBreite(wrap.clientWidth);
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Leiste am ausgewählten Element verankern: oberhalb, sonst unterhalb; immer
  // innerhalb der Fläche, ohne das Element zu verdecken (#65 AK7/AK8).
  // useLayoutEffect misst die Leiste und setzt die Position vor dem Paint —
  // dadurch kein Flackern und keine Layout-Verschiebung der Fläche.
  useLayoutEffect(() => {
    if (!selected || dragAktiv || editId !== null || flaecheBreite === 0) {
      setLeistePos(null);
      return;
    }
    const bar = leisteRef.current;
    if (!bar) return;
    const scale = flaecheBreite / FLAECHE.breite;
    const flaecheHoehe = flaecheBreite * (FLAECHE.hoehe / FLAECHE.breite);
    const box = elementBBox(selected);
    const mitteX = (box.x + box.breite / 2) * scale;
    const obenY = box.y * scale;
    const untenY = (box.y + box.hoehe) * scale;
    const { width: bw, height: bh } = bar.getBoundingClientRect();
    const luft = 10;
    let top = obenY - bh - luft;
    if (top < luft) top = untenY + luft;
    top = Math.min(Math.max(top, luft), Math.max(luft, flaecheHoehe - bh - luft));
    const left = Math.min(
      Math.max(mitteX - bw / 2, luft),
      Math.max(luft, flaecheBreite - bw - luft),
    );
    setLeistePos({ left, top });
    // selected ist aus elemente abgeleitet (find) und wechselt bei jeder
    // Geometrie-Änderung die Referenz — elemente als Dep wäre redundant.
  }, [selected, dragAktiv, editId, flaecheBreite]);

  const statusText: Record<SaveStatus, string> = {
    gespeichert: "Gespeichert",
    ausstehend: "Änderungen …",
    speichert: "Wird gespeichert …",
    fehler: "Speichern fehlgeschlagen — Änderung wird erneut versucht.",
  };

  // Werkzeug-Kacheln gruppenweise zusammenstellen. Symbole werden sofort
  // platziert; Pfad-/Polygon-Werkzeuge schalten den Zeichenmodus und sind
  // dann „aktiv", während die übrigen Kacheln gesperrt sind.
  const istAktiv = (w: PfadTyp | "polygon") => zeichnen?.werkzeug === w;
  const symKachel = (typ: SymbolTyp): Kachel => ({
    key: typ,
    label: SYMBOLE[typ].label,
    element: symVorschau(typ),
    disabled: !!zeichnen,
    onClick: () => addSymbol(typ),
  });
  const pfadKachel = (typ: PfadTyp): Kachel => ({
    key: typ,
    label: PFAD_WERKZEUGE[typ],
    element: pfadVorschau(typ),
    active: istAktiv(typ),
    disabled: !!zeichnen && !istAktiv(typ),
    onClick: () => (istAktiv(typ) ? abbrechenZeichnen() : startZeichnen(typ)),
  });
  const formKachel = (form: FormTyp): Kachel =>
    form === "polygon"
      ? {
          key: "form-polygon",
          label: "Polygon",
          element: formVorschau(form),
          active: istAktiv("polygon"),
          disabled: !!zeichnen && !istAktiv("polygon"),
          onClick: () => (istAktiv("polygon") ? abbrechenZeichnen() : startZeichnen("polygon")),
        }
      : {
          key: `form-${form}`,
          label: FORMEN[form],
          element: formVorschau(form),
          disabled: !!zeichnen,
          onClick: () => addForm(form),
        };
  const gruppen: Kachel[][] = [
    GRUPPE_TORE.map(symKachel),
    GRUPPE_MATERIAL.map(symKachel),
    GRUPPE_PERSONEN.map(symKachel),
    GRUPPE_BAELLE.map(symKachel),
    (Object.keys(PFAD_WERKZEUGE) as PfadTyp[]).map(pfadKachel),
    [...(Object.keys(FORMEN) as FormTyp[]).map(formKachel), {
      key: "text",
      label: "Textbox",
      element: textVorschau,
      disabled: !!zeichnen,
      onClick: addText,
    }],
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf wie bei anderen Entitäten (Übungs-Detail): Breadcrumb links,
          globale Aktionen als Icon-Cluster rechts (ml-auto), Titel darunter.
          Die Aktionen leben hier im Editor, weil sie dessen Verlauf/
          Zwischenablage brauchen. */}
      <header>
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <Breadcrumbs items={crumbs} className="min-w-0 flex-1" />
          <div className="ml-auto flex shrink-0 items-center gap-0.5" role="group" aria-label="Aktionen">
            <Tooltip label="Rückgängig">
              <IconButton
                icon={Undo2}
                label="Rückgängig"
                size="sm"
                onClick={rueckgaengig}
                disabled={verlauf.length === 0 || !!zeichnen}
              />
            </Tooltip>
            <Tooltip label="Wiederherstellen">
              <IconButton
                icon={Redo2}
                label="Wiederherstellen"
                size="sm"
                onClick={wiederherstellen}
                disabled={zukunft.length === 0 || !!zeichnen}
              />
            </Tooltip>
            <Tooltip label="Kopiertes Element einfügen">
              <IconButton
                icon={ClipboardPaste}
                label="Kopiertes Element einfügen"
                size="sm"
                onClick={einfuegen}
                disabled={!zwischenablage || !!zeichnen}
              />
            </Tooltip>
          </div>
        </div>
        <h1 className="type-headline-large text-on-surface">Feld-Diagramm</h1>
        <p className="type-body-medium mt-2 text-on-surface-variant">
          {name} — Elemente platzieren, verschieben, in der Form anpassen und
          entfernen. Änderungen werden automatisch gespeichert.
        </p>
      </header>

      {/* Werkzeug-Palette: ein gruppiertes Glyph-Band. Jede Kachel zeigt das
          Element als Mini-Vorschau (WYSIWYG); der Name kommt nur über Tooltip +
          aria-label. Cluster sind durch eine Haarlinie getrennt und brechen als
          Einheit um. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Elemente, Bewegungen, Formen und Text">
        {gruppen.map((gruppe, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <span aria-hidden className="h-10 w-px shrink-0 self-center bg-outline-variant" />}
            <div className="flex shrink-0 items-center gap-1.5">
              {gruppe.map(({ key, ...rest }) => (
                <GlyphKachel key={key} {...rest} />
              ))}
            </div>
          </Fragment>
        ))}
      </div>

      {/* Zeichen-Steuerung — nur sichtbar, während ein Pfad/Polygon gezeichnet wird. */}
      {zeichnen && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Zeichnen">
          <span className="type-body-small text-on-surface-variant" data-testid="zeichnen-hinweis">
            {zeichnen.werkzeug === "pass"
              ? "Start und Ziel anklicken."
              : zeichnen.werkzeug === "polygon"
                ? "Eckpunkte der Form anklicken (mindestens drei)."
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
        </div>
      )}

      {/* Zeichenfläche — selektionsabhängige Optionen schweben kontextuell am
          Element (ElementLeiste), nicht mehr als Zeilen darüber (#65). */}
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-[6px] border border-outline-variant focus-ring"
        tabIndex={0}
        role="application"
        aria-label="Zeichenfläche für das Feld-Diagramm"
        onKeyDown={(e) => {
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            removeSelected();
          }
          if (e.key === "Escape") {
            if (zeichnen) abbrechenZeichnen();
            else if (bearbeitenId) setBearbeitenId(null);
          }
          if (e.key === "Enter" && zeichnen) fertigZeichnen();
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
            e.preventDefault();
            if (e.shiftKey) wiederherstellen();
            else rueckgaengig();
          }
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
            e.preventDefault();
            kopieren();
          }
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
            e.preventDefault();
            einfuegen();
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
              setBearbeitenId(null);
            }
          }}
          onDoubleClick={() => {
            // Doppelklick landet wegen setPointerCapture (onElementPointerDown)
            // immer auf dem SVG, nie am Element-<g>. Darum hier auf die bereits
            // gesetzte Selektion stützen: Textbox = inline bearbeiten, Pfad/
            // Polygon/Dreieck = Form-Bearbeitungsmodus „tiefer auswählen" (#66).
            if (zeichnen) fertigZeichnen();
            else if (selected?.art === "text") starteTextBearbeitung(selected);
            else if (selected && geometrieEditierbar(selected)) bearbeitenStart(selected);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
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
              {/* Eck-Anfasser zum Grössen-Anpassen (Rechteck/Ellipse) — im
                  Form-Bearbeitungsmodus ausgeblendet, dort gelten Punkte. */}
              {el.id === selectedId && el.id !== bearbeitenId && formResizable(el) && (
                <FormAnfasser element={el} onGreifen={onResizePointerDown} />
              )}
              {/* Punkt-Anfasser im Form-Bearbeitungsmodus (#66). */}
              {el.id === bearbeitenId && geometrieEditierbar(el) && (
                <PunktAnfasser
                  punkte={el.art === "pfad" ? el.punkte : el.art === "form" ? formPunkte(el) : []}
                  onGreifen={(e, i) => onVertexPointerDown(e, el, i)}
                />
              )}
            </g>
          ))}

          {/* Vorschau der entstehenden Bewegung bzw. der Polygon-Form */}
          {zeichnen && zeichnen.punkte.length > 0 && (
            <g pointerEvents="none" opacity={0.75} data-testid="zeichnen-vorschau">
              {zeichnen.werkzeug === "polygon" ? (
                <FormGrafik
                  element={{
                    id: "vorschau",
                    art: "form",
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

        {/* Kontextuelle Optionen am ausgewählten Element (#65) */}
        {selected && !dragAktiv && editId === null && (
          <ElementLeiste
            ref={leisteRef}
            element={selected}
            pos={leistePos}
            bearbeitbar={geometrieEditierbar(selected)}
            imBearbeiten={bearbeitenId === selected.id}
            onBearbeiten={() =>
              bearbeitenId === selected.id ? setBearbeitenId(null) : bearbeitenStart(selected)
            }
            onDrehen={(delta) => drehen(selected.id, delta)}
            onFarbe={(farbe) => setFarbe(selected.id, farbe)}
            onGestrichelt={(gestrichelt) => setGestrichelt(selected.id, gestrichelt)}
            onGefuellt={(gefuellt) => setGefuellt(selected.id, gefuellt)}
            onKopieren={kopieren}
            onEntfernen={removeSelected}
          />
        )}

        {/* Inline-Textbearbeitung direkt am Element (#65 AK9) */}
        {editId !== null && selected && selected.art === "text" && flaecheBreite > 0 && (
          <TextEingabe
            element={selected}
            scale={flaecheBreite / FLAECHE.breite}
            onChange={(text) => bearbeiteText(selected.id, text)}
            onCommit={() => beendeTextBearbeitung(false)}
            onCancel={() => beendeTextBearbeitung(true)}
          />
        )}
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

/** Begrenzungsrahmen eines Elements in Flächen-Koordinaten — Single Source für
 *  den Selektionsrahmen und die Verankerung der kontextuellen Leiste (#65).
 *  Rotation bleibt bewusst unberücksichtigt, konsistent mit dem Rahmen. */
function elementBBox(element: DiagrammElement): {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
} {
  if (element.art === "symbol") {
    const def = symbolDef(element.typ);
    return {
      x: element.x - def.breite / 2,
      y: element.y - def.hoehe / 2,
      breite: def.breite,
      hoehe: def.hoehe,
    };
  }
  if (element.art === "pfad") {
    const box = bbox(element.punkte);
    return { x: box.minX, y: box.minY, breite: box.maxX - box.minX, hoehe: box.maxY - box.minY };
  }
  if (element.art === "form") {
    return { x: element.x, y: element.y, breite: element.breite, hoehe: element.hoehe };
  }
  const box = textBox(element);
  return { x: box.x, y: box.y, breite: box.breite, hoehe: box.hoehe };
}

function SelektionsRahmen({ element }: { element: DiagrammElement }) {
  const r = 8; // Luft um die Element-Begrenzung
  const { x, y, breite, hoehe } = elementBBox(element);
  return (
    <rect
      x={x - r}
      y={y - r}
      width={breite + r * 2}
      height={hoehe + r * 2}
      fill="none"
      stroke="#ffffff"
      strokeWidth={2.5}
      strokeDasharray="6 4"
      pointerEvents="none"
    />
  );
}

/** Vier Eck-Anfasser zum Grössen-Anpassen einer Form (#66). Die gezogene Ecke
 *  folgt dem Pointer, die gegenüberliegende bleibt Anker — die Grundform
 *  (Rechteck/Ellipse) bleibt erhalten. */
function FormAnfasser({
  element,
  onGreifen,
}: {
  element: FormElement;
  onGreifen: (e: React.PointerEvent, el: FormElement, ecke: Ecke) => void;
}) {
  const { x, y, breite, hoehe } = element;
  const ecken: { ecke: Ecke; cx: number; cy: number; cursor: string }[] = [
    { ecke: "tl", cx: x, cy: y, cursor: "cursor-nwse-resize" },
    { ecke: "tr", cx: x + breite, cy: y, cursor: "cursor-nesw-resize" },
    { ecke: "bl", cx: x, cy: y + hoehe, cursor: "cursor-nesw-resize" },
    { ecke: "br", cx: x + breite, cy: y + hoehe, cursor: "cursor-nwse-resize" },
  ];
  return (
    <>
      {ecken.map(({ ecke, cx, cy, cursor }) => (
        <rect
          key={ecke}
          x={cx - 11}
          y={cy - 11}
          width={22}
          height={22}
          fill="#ffffff"
          stroke="rgba(0,0,0,.45)"
          strokeWidth={2}
          className={cursor}
          data-testid="form-anfasser"
          aria-label="Grösse anpassen"
          onPointerDown={(e) => onGreifen(e, element, ecke)}
        />
      ))}
    </>
  );
}

/** Greifbare Stütz-/Eckpunkte im Form-Bearbeitungsmodus (#66). Blau abgesetzt
 *  (vs. weisse Resize-Quadrate), mit grosszügiger unsichtbarer Trefferfläche,
 *  damit die Punkte auch am verkleinerten Bild präzise greifbar sind (NFR). */
function PunktAnfasser({
  punkte,
  onGreifen,
}: {
  punkte: Punkt[];
  onGreifen: (e: React.PointerEvent, index: number) => void;
}) {
  return (
    <>
      {punkte.map((p, i) => (
        <g
          key={i}
          className="cursor-grab"
          data-testid="punkt-anfasser"
          aria-label={`Punkt ${i + 1} verschieben`}
          onPointerDown={(e) => onGreifen(e, i)}
        >
          <circle cx={p.x} cy={p.y} r={18} fill="transparent" />
          <circle cx={p.x} cy={p.y} r={9} fill="#ffffff" stroke="#1565c0" strokeWidth={3} />
        </g>
      ))}
    </>
  );
}

/** Kontextuelle Bedienleiste am ausgewählten Element (#65): schwebt als HTML
 *  über der Zeichenfläche, ausserhalb des Dokumentflusses — so verschiebt das
 *  Ein-/Ausblentden die Fläche nicht. Eine Leiste, intern durch einen Trenner
 *  in Eigenschaften (links) und Strukturaktionen (rechts) gruppiert. */
const ElementLeiste = forwardRef<
  HTMLDivElement,
  {
    element: DiagrammElement;
    pos: { left: number; top: number } | null;
    bearbeitbar: boolean;
    imBearbeiten: boolean;
    onBearbeiten: () => void;
    onDrehen: (delta: 45 | -45) => void;
    onFarbe: (farbe: FarbSlug) => void;
    onGestrichelt: (gestrichelt: boolean) => void;
    onGefuellt: (gefuellt: boolean) => void;
    onKopieren: () => void;
    onEntfernen: () => void;
  }
>(function ElementLeiste(
  {
    element,
    pos,
    bearbeitbar,
    imBearbeiten,
    onBearbeiten,
    onDrehen,
    onFarbe,
    onGestrichelt,
    onGefuellt,
    onKopieren,
    onEntfernen,
  },
  ref,
) {
  const drehbar = element.art === "symbol" && symbolDef(element.typ).drehbar;
  const faerbbar =
    (element.art === "symbol" && symbolDef(element.typ).faerbbar) ||
    (element.art === "pfad" && element.typ === "linie") ||
    element.art === "form";
  const stilbar = element.art === "pfad" && element.typ === "linie";
  const fuellbar = element.art === "form";
  const hatEigenschaften = drehbar || faerbbar || stilbar || fuellbar || bearbeitbar;
  const standardFarbe =
    element.art === "symbol"
      ? symbolDef(element.typ).defaultFarbe
      : element.art === "form"
        ? FORM_DEFAULT_FARBE
        : LINIE_DEFAULT_FARBE;

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Optionen für das ausgewählte Element"
      className="absolute z-20 flex items-center gap-1 rounded-[6px] border border-outline-variant bg-surface-container-high px-1.5 py-1 shadow-e4"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {drehbar && element.art === "symbol" && (
        <>
          <IconButton
            icon={RotateCcw}
            label="45 Grad nach links drehen"
            size="sm"
            onClick={() => onDrehen(-45)}
          />
          <IconButton
            icon={RotateCw}
            label="45 Grad nach rechts drehen"
            size="sm"
            onClick={() => onDrehen(45)}
          />
        </>
      )}

      {faerbbar && (
        <div className="flex items-center gap-1" role="group" aria-label="Farbe des Elements">
          {farbSlugs.map((slug) => {
            const aktuell = "farbe" in element ? element.farbe : undefined;
            const aktiv = (aktuell ?? standardFarbe) === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => onFarbe(slug)}
                aria-label={`Farbe ${slug}`}
                aria-pressed={aktiv}
                className={`focus-ring h-6 w-6 rounded-full border-2 ${
                  aktiv ? "border-on-surface" : "border-outline-variant"
                }`}
                style={{ backgroundColor: FARBEN[slug] }}
              />
            );
          })}
        </div>
      )}

      {stilbar && element.art === "pfad" && (
        <>
          <IconButton
            icon={Minus}
            label="Durchgezogene Linie"
            size="sm"
            active={!element.gestrichelt}
            onClick={() => onGestrichelt(false)}
          />
          <IconButton
            icon={Ellipsis}
            label="Gestrichelte Linie"
            size="sm"
            active={!!element.gestrichelt}
            onClick={() => onGestrichelt(true)}
          />
        </>
      )}

      {fuellbar && element.art === "form" && (
        <IconButton
          icon={PaintBucket}
          label={element.gefuellt ? "Füllung entfernen" : "Fläche füllen"}
          size="sm"
          active={!!element.gefuellt}
          onClick={() => onGefuellt(!element.gefuellt)}
        />
      )}

      {bearbeitbar && (
        <IconButton
          icon={Waypoints}
          label={imBearbeiten ? "Punkte bearbeiten beenden" : "Punkte bearbeiten"}
          size="sm"
          active={imBearbeiten}
          onClick={onBearbeiten}
        />
      )}

      {hatEigenschaften && <span aria-hidden className="mx-0.5 h-5 w-px bg-outline-variant" />}

      <IconButton
        icon={Copy}
        label="Ausgewähltes Element kopieren"
        size="sm"
        onClick={onKopieren}
      />
      <IconButton
        icon={Trash2}
        label="Ausgewähltes Element entfernen"
        size="sm"
        onClick={onEntfernen}
        className="text-error hover:text-error"
      />
    </div>
  );
});

/** Inline-Eingabe für eine Textbox (#65 AK9), exakt über dem Element platziert. */
function TextEingabe({
  element,
  scale,
  onChange,
  onCommit,
  onCancel,
}: {
  element: TextElement;
  scale: number;
  onChange: (text: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const box = textBox(element);
  return (
    <input
      autoFocus
      aria-label="Text der Textbox bearbeiten"
      value={element.text}
      maxLength={MAX_TEXT_LAENGE}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={onCommit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="absolute z-30 rounded-[5px] border-[1.5px] border-primary bg-white text-center text-[#212121] outline-none"
      style={{
        left: box.x * scale,
        top: box.y * scale,
        width: box.breite * scale,
        height: box.hoehe * scale,
        fontSize: 30 * scale,
        fontFamily: "var(--font-sans, sans-serif)",
      }}
    />
  );
}
