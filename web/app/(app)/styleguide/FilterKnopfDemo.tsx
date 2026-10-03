"use client";

import { useState } from "react";
import { AuswahlFilter, Button, FilterChip, FilterKnopf, SearchField, TextField } from "@/components/ui";
import { stufenOptionen } from "@/lib/filter-optionen";

const formen = [
  { value: "spielform", label: "Spielform mit klarer Aufgabe und Überzahl für die angreifende Mannschaft" },
  { value: "uebungsform", label: "Übungsform ohne Gegenspieler, mit Wiederholung der Technik in Bewegung" },
  { value: "wettkampf", label: "Wettkampfform" },
];

/* Eine Filterleiste wie im Katalog: Suche, Auswahlfilter, ein Zahlenfilter
   und ein Schalter — alles 36 px hoch, in einer umbrechenden Zeile. */
export function FilterKnopfDemo() {
  const [stufen, setStufen] = useState<string[]>(["F", "E"]);
  const [form, setForm] = useState<string[]>([]);
  const [kinder, setKinder] = useState("12");
  const [meine, setMeine] = useState(false);
  const zahl = kinder.trim() ? Number(kinder) : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchField
        label="Übungen durchsuchen"
        labelVersteckt
        umrandet
        placeholder="Übungen durchsuchen"
        className="w-full sm:w-72"
      />
      <AuswahlFilter label="Alterskategorie" options={stufenOptionen} value={stufen} onChange={setStufen} />
      <AuswahlFilter label="Erscheinungsform" options={formen} value={form} onChange={setForm} />
      <FilterKnopf
        label="Verfügbare Kinder"
        aktiv={zahl !== undefined}
        badge={zahl}
        badgeLabel={zahl !== undefined ? `${zahl} Kinder` : undefined}
        panelClassName="w-64 px-3 py-2"
      >
        <TextField
          label="Anzahl Kinder"
          type="number"
          min={1}
          umrandet
          value={kinder}
          onChange={(e) => setKinder(e.target.value)}
          supportingText="Zeigt Übungen, die mit so vielen Kindern durchführbar sind."
        />
      </FilterKnopf>
      <FilterChip selected={meine} onClick={() => setMeine((m) => !m)}>
        Meine Übungen
      </FilterChip>
      <Button
        variant="text"
        onClick={() => {
          setStufen([]);
          setForm([]);
          setKinder("");
          setMeine(false);
        }}
      >
        Zurücksetzen
      </Button>
    </div>
  );
}
