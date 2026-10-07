"use client";

import { useState } from "react";
import { AuswahlListe } from "@/components/ui";

/* Die Auswahlliste an ihrem Anwendungsfall: einem Training einen Termin
   wählen; vergangene Termine sind gedämpft. Die Einträge sind erfunden. */
const eintraege = [
  { id: "a", titel: "Di., 13.10.2026 · 18:00–19:30 Uhr", untertitel: "Ohne Training" },
  { id: "b", titel: "Do., 15.10.2026 · 18:00–19:30 Uhr", untertitel: "Trägt «Passspiel im Dreieck» - wird gelöscht" },
  { id: "c", titel: "Sa., 10.10.2026 · 10:00–11:30 Uhr", untertitel: "Trägt «Spiel auf zwei Tore» - bleibt im Team-Bestand", gedaempft: true },
];

export function AuswahlListeDemo() {
  const [wert, setWert] = useState<string | null>(null);
  return <AuswahlListe ariaLabel="Termine des Teams" items={eintraege} wert={wert} onWahl={setWert} className="max-w-md" />;
}
