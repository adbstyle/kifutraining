"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button, Dialog, TextField } from "@/components/ui";
import { DiagrammView } from "./DiagrammView";
import { parseDiagramm } from "@/lib/diagramm";
import { normalizeSearch } from "@/lib/search";
import type { VorlageItem } from "@/lib/queries/exercises";

/**
 * Vorlagen-Auswahl (Epic #58, Story #61): öffnet einen Dialog mit den
 * verfügbaren Diagrammen (eigene + KiFu-Manual) als Vorschau. Beim Wählen ruft
 * sie `onPick` — die beiden Einstiege (Bearbeiten-Seite, leerer Editor) hängen
 * dort ihre Wirkung an. Besitzt die Zielübung schon ein Diagramm, ist eine
 * ausdrückliche Bestätigung nötig, bevor ersetzt wird (#61 AK4).
 *
 * Rendert keinen Einstieg, wenn keine Vorlage verfügbar ist (#61 AK6).
 */
export function VorlagePicker({
  vorlagen,
  zielHatDiagramm,
  onPick,
  triggerLabel,
  triggerVariant = "outlined",
}: {
  vorlagen: VorlageItem[];
  zielHatDiagramm: boolean;
  /** Übernimmt die Vorlage. Gibt null bei Erfolg zurück, sonst einen
   *  Fehlertext, der im Dialog angezeigt wird (statt blind zu schliessen). */
  onPick: (vorlage: VorlageItem) => Promise<string | null> | string | null;
  triggerLabel: string;
  triggerVariant?: "tonal" | "outlined" | "text";
}) {
  const [offen, setOffen] = useState(false);
  const [bestaetigen, setBestaetigen] = useState<VorlageItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [suche, setSuche] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  // Freitextsuche über den Namen der Quell-Übung (#62), akzent-/case-insensitiv
  // wie die Übungssuche. Leeres Feld -> alle Vorlagen.
  const gefiltert = useMemo(() => {
    const q = normalizeSearch(suche.trim());
    if (!q) return vorlagen;
    return vorlagen.filter((v) => normalizeSearch(v.name).includes(q));
  }, [suche, vorlagen]);

  if (vorlagen.length === 0) return null;

  async function uebernehmen(vorlage: VorlageItem) {
    setBusy(true);
    try {
      const fehlertext = await onPick(vorlage);
      if (fehlertext) {
        // Fehlgeschlagen: zurück zur Auswahl, Hinweis zeigen statt blind schliessen.
        setBestaetigen(null);
        setFehler(fehlertext);
        return;
      }
      setBestaetigen(null);
      setFehler(null);
      setOffen(false);
    } finally {
      setBusy(false);
    }
  }

  function waehlen(vorlage: VorlageItem) {
    if (zielHatDiagramm) setBestaetigen(vorlage);
    else void uebernehmen(vorlage);
  }

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size="sm"
        onClick={() => {
          setFehler(null);
          setOffen(true);
        }}
      >
        {triggerLabel}
      </Button>

      <Dialog
        open={offen}
        onClose={() => {
          setOffen(false);
          setSuche("");
          setFehler(null);
        }}
        title="Vorlage übernehmen"
        className="w-[min(48rem,calc(100vw-2rem))]"
      >
        {fehler && (
          <p className="type-body-small mb-4 rounded-[4px] border border-error/40 bg-error/10 p-3 text-on-surface">
            {fehler}
          </p>
        )}
        <TextField
          label="Übung suchen"
          leadingIcon={Search}
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="mb-4"
        />
        {gefiltert.length === 0 ? (
          <p className="py-6 text-center text-on-surface-variant">
            Keine Vorlage gefunden.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gefiltert.map((vorlage) => {
              const data = parseDiagramm(vorlage.diagramm);
              if (!data) return null;
              return (
                <li key={vorlage.id}>
                  <button
                    type="button"
                    onClick={() => waehlen(vorlage)}
                    disabled={busy}
                    className="focus-ring block w-full overflow-hidden rounded-[6px] border border-outline-variant text-left transition-colors hover:border-on-surface/45 disabled:opacity-50"
                  >
                    <span className="block aspect-[16/10] w-full border-b border-outline-variant">
                      <DiagrammView diagramm={data} title={`Vorlage: ${vorlage.name}`} />
                    </span>
                    <span className="type-label-small block truncate p-2 text-on-surface-variant">
                      {vorlage.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Dialog>

      <Dialog
        open={!!bestaetigen}
        onClose={() => setBestaetigen(null)}
        title="Bestehendes Diagramm ersetzen?"
        actions={
          <>
            <Button type="button" variant="text" onClick={() => setBestaetigen(null)} disabled={busy}>
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={() => bestaetigen && uebernehmen(bestaetigen)}
              disabled={busy}
            >
              Ersetzen
            </Button>
          </>
        }
      >
        Das aktuelle Diagramm dieser Übung wird durch die gewählte Vorlage ersetzt.
        Das lässt sich nicht rückgängig machen.
      </Dialog>
    </>
  );
}
