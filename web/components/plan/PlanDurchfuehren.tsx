"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { PlanExerciseDetail } from "./PlanExerciseDetail";
import { groupByTeil, leseBloecke, formatDuration } from "@/lib/plan";
import type { PlanDetail } from "@/lib/queries/plans";

/* Mobile Durchführungsansicht (Story #17): Trainingsteil für Trainingsteil
   (nur belegte), grosse Bedienflächen, Bildschirm-Wachhalten (Best-Effort).
   Lesend — keine Mutationen. */
export function PlanDurchfuehren({ plan }: { plan: PlanDetail }) {
  const sections = groupByTeil(plan.exercises).filter((s) => s.items.length > 0);
  const [idx, setIdx] = useState(0);

  // Bildschirm wachhalten, solange die Ansicht aktiv und sichtbar ist
  // (Best-Effort, AC7). Ohne Browser-Unterstützung still no-op.
  useEffect(() => {
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLock> };
    };
    if (!nav.wakeLock) return;
    let lock: WakeLock | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await nav.wakeLock!.request("screen");
      } catch {
        /* z. B. nicht im Vordergrund — ignorieren */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  const total = sections.reduce((a, s) => a + s.sum, 0);

  if (sections.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="type-headline-small text-on-surface">{plan.name}</h1>
        <p className="mt-3 type-body-medium text-on-surface-variant">
          Diesem Plan sind noch keine Übungen zugeordnet.
        </p>
      </main>
    );
  }

  const section = sections[idx];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-4 sm:px-6">
      <header className="mb-4">
        <p className="type-label-medium text-on-surface-variant">{plan.name}</p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h1 className="type-headline-medium text-on-surface">{section.label}</h1>
          <span className="type-label-large text-on-surface-variant">
            {idx + 1}/{sections.length}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 type-label-medium text-on-surface-variant">
          {section.sum > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Clock size={15} strokeWidth={2} aria-hidden />
              {formatDuration(section.sum)} in diesem Teil
            </span>
          )}
          {total > 0 && (
            <span>
              {section.sum > 0 ? "· " : ""}Gesamt {formatDuration(total)}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {leseBloecke(section).map((b) => (
          <div key={b.key} className="flex flex-col gap-6">
            {b.label && (
              <h2 className="type-title-medium text-on-surface-variant">{b.label}</h2>
            )}
            {b.items.map((item, i) => (
              <div key={item.id}>
                <p className="mb-2 type-label-small text-on-surface-variant">
                  Übung {i + 1} von {b.items.length}
                </p>
                <PlanExerciseDetail item={item} showSource />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Spielfeldrand-Navigation: grosse, sicher treffbare Flächen */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-outline bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="focus-ring inline-flex h-14 flex-1 items-center justify-center gap-1.5 rounded-[4px] border-[1.5px] border-outline type-label-large text-on-surface transition-colors hover:bg-on-surface/8 disabled:opacity-30"
          >
            <ChevronLeft size={22} strokeWidth={2.5} aria-hidden />
            Zurück
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(sections.length - 1, i + 1))}
            disabled={idx === sections.length - 1}
            className="focus-ring inline-flex h-14 flex-1 items-center justify-center gap-1.5 rounded-[4px] bg-primary type-label-large text-on-primary transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            Weiter
            <ChevronRight size={22} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </nav>
    </div>
  );
}
