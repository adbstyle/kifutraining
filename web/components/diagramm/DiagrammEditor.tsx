"use client";

import { useEffect, useRef, useState } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui";
import type { DiagrammData } from "@/lib/diagramm";
import type { VorlageItem } from "@/lib/queries/exercises";
import { DiagrammZeichnen } from "./DiagrammZeichnen";

type SaveStatus = "gespeichert" | "ausstehend" | "speichert" | "fehler";

const AUTOSAVE_MS = 800;

/**
 * Der Diagramm-Editor auf seiner eigenen Seite: die Zeichenfläche mit Kopf
 * (Brotkrumen, Titel) und Autosave an eine bereits gespeicherte Zeile
 * (#49 AK6) — eine Bibliotheks-Übung oder eine Fassung im Training (Epic #72).
 */
export function DiagrammEditor({
  speichern,
  name,
  crumbs,
  initial,
  vorlagen,
}: {
  /** Wohin das Diagramm gespeichert wird — an eine Bibliotheks-Übung oder an
   *  eine Fassung im Training (Epic #72). Der Editor bleibt davon unabhängig. */
  speichern: (data: DiagrammData) => Promise<{ ok: boolean; error?: string }>;
  name: string;
  crumbs: BreadcrumbItem[];
  initial: DiagrammData;
  /** Verfügbare Vorlagen-Diagramme (#61). */
  vorlagen: VorlageItem[];
}) {
  const [status, setStatus] = useState<SaveStatus>("gespeichert");
  // Der jüngste Stand der Zeichenfläche; null, solange nichts geändert wurde.
  const [stand, setStand] = useState<DiagrammData | null>(null);
  // Saves laufen strikt nacheinander: ein langsamer älterer Save kann so
  // nie einen neueren Stand in der DB überschreiben.
  const saveKette = useRef<Promise<unknown>>(Promise.resolve());

  // Autosave: debounced nach jeder Änderung (#49 AK6). Kein expliziter
  // Speicher-Schritt; Status informiert über ausstehend/gespeichert/Fehler.
  useEffect(() => {
    if (!stand) return;
    setStatus("ausstehend");
    const timer = setTimeout(() => {
      setStatus("speichert");
      saveKette.current = saveKette.current.then(async () => {
        const result = await speichern(stand);
        setStatus(result.ok ? "gespeichert" : "fehler");
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [stand, speichern]);

  const statusText: Record<SaveStatus, string> = {
    gespeichert: "Gespeichert",
    ausstehend: "Änderungen …",
    speichert: "Wird gespeichert …",
    fehler: "Speichern fehlgeschlagen — Änderung wird erneut versucht.",
  };

  return (
    <DiagrammZeichnen
      initial={initial}
      vorlagen={vorlagen}
      onChange={setStand}
      // Kopf wie bei anderen Entitäten (Übungs-Detail): Breadcrumb links,
      // globale Aktionen als Icon-Cluster rechts (ml-auto), Titel darunter.
      kopf={(aktionen) => (
        <header>
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <Breadcrumbs items={crumbs} className="min-w-0 flex-1" />
            <div className="ml-auto">{aktionen}</div>
          </div>
          <h1 className="type-headline-large text-on-surface">Feld-Diagramm</h1>
          <p className="type-body-medium mt-2 text-on-surface-mittel">
            {name} — Elemente platzieren, verschieben, in der Form anpassen und
            entfernen. Mehrere Elemente lassen sich per Auswahlrahmen oder
            Umschalt-Klick gemeinsam verschieben, kopieren und löschen. Änderungen
            werden automatisch gespeichert.
          </p>
        </header>
      )}
      fuss={
        <p
          className={`type-body-small ${status === "fehler" ? "text-error" : "text-on-surface-mittel"}`}
          role="status"
          data-testid="autosave-status"
        >
          {statusText[status]}
        </p>
      }
    />
  );
}
