"use client";

import { useState } from "react";
import { AuswahlFilter, Button, FilterChip, FilterSuche, ZahlFilter, ZeitraumFilter } from "@/components/ui";
import { TEILNAHME_TEXT, ZEITRAUM_KURZWAHL, kurzwahlVon, zeitraumWert, type Zeitraum } from "@/lib/teilnahme";
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
  const heute = "2026-11-27";
  const [zeitraum, setZeitraum] = useState<Zeitraum>({ von: "2026-10-29", bis: null });
  const kurz = kurzwahlVon(zeitraum, heute);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSuche label="Übungen durchsuchen" initial={q} onCommit={setQ} />
      <AuswahlFilter label="Alterskategorie" options={stufenOptionen} value={stufen} onChange={setStufen} />
      <AuswahlFilter label="Erscheinungsform" options={formen} value={form} onChange={setForm} />
      <ZahlFilter
        label="Verfügbare Spieler:innen"
        feldLabel="Anzahl Spieler:innen"
        einheit="Spieler:innen"
        einheitEins="Spieler:in"
        hinweis="Zeigt Übungen, die mit so vielen Spieler:innen durchführbar sind."
        gesetzt={kinder}
        onCommit={(v) => setKinder(v.trim() ? Number(v) : undefined)}
      />
      <ZeitraumFilter
        label={TEILNAHME_TEXT.zeitraum}
        wert={zeitraumWert(zeitraum, heute)}
        von={zeitraum.von}
        bis={zeitraum.bis}
        bisHoechstens={heute}
        kurzwahl={ZEITRAUM_KURZWAHL.map((k) => ({ id: k.id, label: k.label, von: k.von(heute), aktiv: kurz?.id === k.id }))}
        texte={TEILNAHME_TEXT}
        onChange={(z) => setZeitraum({ von: z.von || null, bis: z.bis || null })}
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
          setZeitraum({ von: null, bis: null });
        }}
      >
        Zurücksetzen
      </Button>
    </div>
  );
}
