"use client";

import { useMemo, useState } from "react";
import { Button, Dialog, SearchField, Banner } from "@/components/ui";
import { DiagrammView } from "./DiagrammView";
import { parseDiagramm } from "@/lib/diagramm";
import { normalizeSearch } from "@/lib/search";
import type { VorlageItem } from "@/lib/queries/exercises";

/**
 * Vorlagen-Auswahl (Epic #58, Story #61): öffnet einen Dialog mit den
 * verfügbaren Diagrammen (eigene + KiFu-Manual) als Vorschau. Beim Wählen ruft
 * sie `onPick` — die Zeichenfläche hängt dort ihre Wirkung an. Trägt die
 * Fläche schon eine Zeichnung, ist eine ausdrückliche Bestätigung nötig, bevor
 * ersetzt wird (#61 AK4, #246 AK 4).
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
  /** Kopiert die Vorlage. Gibt null bei Erfolg zurück, sonst einen
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

  async function kopieren(vorlage: VorlageItem) {
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
    else void kopieren(vorlage);
  }

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
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
        title="Vorlage kopieren"
        className="w-[min(48rem,calc(100vw-2rem))]"
      >
        {fehler && (
          <Banner tone="fehler" className="mb-4">
            {fehler}
          </Banner>
        )}
        <SearchField
          label="Übung suchen"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          // Die Suche filtert laufend; Enter hat nichts zu bestätigen. Liegt
          // der Picker in einem Formular (Erfassen, #246), sendete Enter sonst
          // die ganze Übung ab — der native <dialog> rendert kein Portal.
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          className="mb-4"
        />
        {gefiltert.length === 0 ? (
          <p className="py-6 text-center text-on-surface-mittel">
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
                    className="focus-ring state block w-full overflow-hidden rounded-flaeche border border-linie text-left disabled:opacity-50"
                  >
                    <span className="block aspect-[16/10] w-full border-b border-linie">
                      <DiagrammView diagramm={data} title={`Vorlage: ${vorlage.name}`} />
                    </span>
                    <span className="type-body-small block truncate p-2 text-on-surface-mittel">
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
              onClick={() => bestaetigen && kopieren(bestaetigen)}
              disabled={busy}
            >
              Ersetzen
            </Button>
          </>
        }
      >
        Die Zeichnung auf der Fläche wird durch die gewählte Vorlage ersetzt. Mit «Rückgängig»
        holst du sie zurück.
      </Dialog>
    </>
  );
}
