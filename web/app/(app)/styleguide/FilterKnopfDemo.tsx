"use client";

import { useState } from "react";
import { AuswahlFilter, Button, FilterChip, FilterSuche, ZahlFilter } from "@/components/ui";
import { stufenOptionen } from "@/lib/filter-optionen";

const formen = [
  { value: "spielform", label: "Spielform mit klarer Aufgabe und Überzahl für die angreifende Mannschaft" },
  { value: "uebungsform", label: "Übungsform ohne Gegenspieler, mit Wiederholung der Technik in Bewegung" },
  { value: "wettkampf", label: "Wettkampfform" },
];

/* Eine Filterleiste wie im Katalog: Suche, Auswahlfilter, ein Zahlenfilter
   und ein Schalter — alles 36 px hoch, in einer umbrechenden Zeile. */
export function FilterKnopfDemo() {
  const [q, setQ] = useState("");
  const [stufen, setStufen] = useState<string[]>(["F", "E"]);
  const [form, setForm] = useState<string[]>([]);
  const [kinder, setKinder] = useState<number | undefined>(12);
  const [meine, setMeine] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSuche label="Übungen durchsuchen" initial={q} onCommit={setQ} />
      <AuswahlFilter label="Alterskategorie" options={stufenOptionen} value={stufen} onChange={setStufen} />
      <AuswahlFilter label="Erscheinungsform" options={formen} value={form} onChange={setForm} />
      <ZahlFilter
        label="Verfügbare Kinder"
        feldLabel="Anzahl Kinder"
        einheit="Kinder"
        hinweis="Zeigt Übungen, die mit so vielen Kindern durchführbar sind."
        gesetzt={kinder}
        onCommit={(v) => setKinder(v.trim() ? Number(v) : undefined)}
      />
      <FilterChip selected={meine} onClick={() => setMeine((m) => !m)}>
        Meine Übungen
      </FilterChip>
      <Button
        variant="text"
        onClick={() => {
          setQ("");
          setStufen([]);
          setForm([]);
          setKinder(undefined);
          setMeine(false);
        }}
      >
        Zurücksetzen
      </Button>
    </div>
  );
}
