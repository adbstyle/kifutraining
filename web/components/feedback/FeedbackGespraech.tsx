"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, CircleCheck, X } from "lucide-react";
import { Button, Card, IconButton, SectionMessage, TextArea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { AUFBEWAHRUNG_MONATE, NACHRICHT_MAX } from "@/lib/feedback/regeln";
import type { FeedbackGespraech as Gespraech } from "./useFeedbackGespraech";

/** Der Name des Dialogs — in der Seitenleiste, im Kopf und am privaten Link. */
export const FEEDBACK_TITEL = "Fragen und Feedback";

/* ── Fläche ─────────────────────────────────────────────────────
   Der Rahmen um das Gespräch. Am Desktop (`panel`) eine Spalte rechts neben
   dem Inhalt, die beim Seitenwechsel stehen bleibt — die Seite, um die es
   geht, bleibt daneben sichtbar und bedienbar. Unter `lg` und am privaten
   Link (`vollbild`) füllt sie den Bildschirm. Die Spalte ist Rahmen wie die
   Seitenleiste: Fläche 01dp mit Haarlinie, ohne Schatten. `eingebettet`
   füllt den umgebenden Rahmen (Styleguide). */
export function FeedbackFlaeche({
  form,
  onSchliessen,
  children,
}: {
  form: "panel" | "vollbild" | "eingebettet";
  onSchliessen: () => void;
  children: React.ReactNode;
}) {
  const titelId = "feedback-titel";
  return (
    <section
      role="dialog"
      aria-labelledby={titelId}
      className={cn(
        "flex flex-col bg-elev-00 print:hidden",
        form === "eingebettet" ? "h-full border border-linie bg-elev-01" : "fixed inset-0 z-50",
        form === "panel" &&
          "lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-(--feedback-breite) lg:shrink-0 lg:self-start lg:border-l lg:border-linie lg:bg-elev-01",
      )}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-linie pr-2 pl-4">
        <h2 id={titelId} className="type-title-medium flex-1 truncate text-on-surface">
          {FEEDBACK_TITEL}
        </h2>
        <IconButton icon={X} label="Fragen und Feedback schliessen" onClick={onSchliessen} />
      </header>
      {children}
    </section>
  );
}

/* ── Gespräch ───────────────────────────────────────────────────
   Chat nach der KiFu-Regel «Farbe füllt nur, wo eine Fläche gemeint ist»:
   Die KI schreibt auf den Grund, die eigenen Nachrichten stehen rechts auf
   einer helleren Fläche — keine farbigen Sprechblasen. Die Einordnung
   (Fehler, Wunsch, Frage) zeigt der Dialog nicht (PO 6). */
export function FeedbackGespraech({
  g,
  seite,
  onSchliessen,
  dringend,
  fokussieren = true,
}: {
  g: Gespraech;
  /** Beim Öffnen ins Feld springen; nicht im Styleguide, der sonst dorthin scrollte. */
  fokussieren?: boolean;
  /** Die Seite, auf der die Person gerade ist (nur der Pfad). */
  seite: () => string;
  onSchliessen: () => void;
  /** Am privaten Link: wohin mit Dringendem (#544). */
  dringend?: string;
}) {
  const [text, setText] = useState("");
  const feldRef = useRef<HTMLTextAreaElement>(null);
  const endeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fokussieren) feldRef.current?.focus();
  }, [fokussieren]);
  useEffect(() => {
    if (fokussieren) endeRef.current?.scrollIntoView({ block: "end" });
  }, [fokussieren, g.verlauf.length, g.unterwegs, g.zusammenfassung, g.fehler]);

  if (g.phase === "gesendet") {
    return (
      <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-6 pt-16 pb-6 text-center">
        <CircleCheck size={40} strokeWidth={1.5} aria-hidden className="text-icon-success" />
        <p role="status" className="type-headline-small text-on-surface">
          Danke, dein Feedback ist angekommen.
        </p>
        <p className="type-body-medium max-w-xs text-on-surface-mittel">
          Das Feedback wird gelesen und von der Entwicklung priorisiert. Eine Antwort bekommst du über
          KiFu nicht.
          {dringend && ` ${dringend}`}
        </p>
        <p className="type-body-small max-w-xs text-on-surface-mittel">
          Nach {AUFBEWAHRUNG_MONATE} Monaten wird dein Feedback automatisch gelöscht.
        </p>
        <div className="flex-1" />
        <Button variant="outlined" onClick={onSchliessen}>
          Schliessen
        </Button>
      </div>
    );
  }

  const senden = () => {
    const t = text.trim();
    if (!t) return;
    g.senden(t, seite());
    setText("");
  };
  const zeigeEingabe = g.phase === "gespraech" && g.stand.offen;

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4" aria-live="polite">
        <SectionMessage appearance="information">
          Dieses Gespräch führt Haiku, ein KI-Modell von Anthropic (USA).
        </SectionMessage>
        <div className="flex flex-col gap-1.5">
          <p className="type-body-large text-on-surface">
            Hallo! Was möchtest du melden – etwas, das nicht funktioniert, einen Wunsch oder eine
            Frage? Erzähl es in deinen Worten.
          </p>
          <p className="type-body-medium text-on-surface-mittel">Bitte gib keine sensiblen Angaben ein.</p>
        </div>

        {g.verlauf.map((n, i) => (
          <Beitrag key={i} von={n.von} text={n.text} />
        ))}
        {g.unterwegs && <Beitrag von="person" text={g.unterwegs} />}
        {g.unterwegs && <Tippt />}

        {g.zusammenfassung && !g.unterwegs && g.phase === "gespraech" && (
          <Card aria-label="Zusammenfassung" className="flex flex-col gap-3 p-4">
            <h3 className="type-title-small text-on-surface">{g.zusammenfassung.titel}</h3>
            <dl className="flex flex-col gap-2.5">
              {g.zusammenfassung.punkte.map((p) => (
                <div key={p.bezeichnung}>
                  <dt className="type-label-small text-on-surface-mittel">{p.bezeichnung}</dt>
                  <dd className="type-body-medium mt-0.5 text-on-surface">{p.text}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => g.bestaetigen(seite())} disabled={g.wartet}>
                Bestätigen und senden
              </Button>
              <Button variant="outlined" onClick={onSchliessen} disabled={g.wartet}>
                Verwerfen
              </Button>
            </div>
          </Card>
        )}

        {g.fehler && (
          <SectionMessage appearance="error">
            <p>{g.fehler}</p>
            {g.phase === "beendet" && (
              <Button variant="outlined" onClick={onSchliessen} className="mt-3">
                Schliessen
              </Button>
            )}
          </SectionMessage>
        )}
        <div ref={endeRef} />
      </div>

      {zeigeEingabe && (
        <div className="flex shrink-0 flex-col gap-1.5 border-t border-linie bg-elev-01 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2">
            <TextArea
              ref={feldRef}
              label={g.verlauf.length === 0 ? "Schreib dein Anliegen" : "Schreib deine Antwort"}
              labelVersteckt
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Enter bricht die Zeile um wie in jedem Textfeld von KiFu;
                // mit Cmd/Ctrl geht die Nachricht ab.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  senden();
                }
              }}
              maxLength={NACHRICHT_MAX}
              className="min-w-0 flex-1"
            />
            <IconButton
              icon={ArrowUp}
              label="Senden"
              primary
              onClick={senden}
              disabled={g.wartet || !text.trim()}
              className="mb-1 shrink-0"
            />
          </div>
          <div className="type-body-small flex items-center justify-between gap-3 px-0.5 text-on-surface-mittel tabular-nums">
            <span>{g.stand.zaehler}</span>
            {g.kannZusammenfassen ? (
              <Button variant="link" onClick={() => g.zusammenfassen(seite())} disabled={g.wartet}>
                Jetzt zusammenfassen
              </Button>
            ) : (
              <span>
                {text.length} / {NACHRICHT_MAX}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Beitrag({ von, text }: { von: "person" | "ki"; text: string }) {
  return von === "person" ? (
    <p className="type-body-medium max-w-[85%] self-end rounded-flaeche bg-elev-02 px-3 py-2.5 whitespace-pre-wrap text-on-surface">
      <span className="sr-only">Du: </span>
      {text}
    </p>
  ) : (
    <p className="type-body-large max-w-[92%] whitespace-pre-wrap text-on-surface">{text}</p>
  );
}

/** Drei Punkte, solange die Antwort unterwegs ist. */
function Tippt() {
  return (
    <span role="status" className="flex gap-1.5 py-2">
      <span className="sr-only">Die Antwort kommt …</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-on-surface-mittel motion-reduce:animate-none"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
