"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { IconButton } from "@/components/ui";
import { BenachrichtigungEintrag } from "@/components/privat/BenachrichtigungEintrag";
import { BenachrichtigenFeld } from "@/components/team/BenachrichtigenFeld";
import { knopfLabel, type BenachrichtigenVorgang, type BenachrichtigungSerie, type BenachrichtigungTermin, type LinkBenachrichtigung } from "@/lib/benachrichtigung";

/* Die Benachrichtigungen an ihren Anwendungsfällen (Epic #641): die Glocke mit
   Zähler im Kopf des privaten Links, ein Eintrag je Ereignis und das Häkchen
   im Dialog der Mitglieder. Die Beispiele sind erfunden. */
const SPIEL: BenachrichtigungTermin = { team: "E-Junioren", art: "spiel", bezeichnung: "FC Wyler - FC Aarau", datum: "2026-12-05", beginn: "14:00", ende: "15:30", ort: "Sportplatz Wyler" };
const TRAINING: BenachrichtigungTermin = { team: "E-Junioren", art: "training", bezeichnung: null, datum: "2026-12-02", beginn: "18:00", ende: "19:30", ort: "Turnhalle Schulhaus Nord" };
const SERIE: BenachrichtigungSerie = {
  team: "E-Junioren",
  art: "training",
  ab: "2026-12-01",
  angaben: { wochentage: [2], beginn: "18:00", ende: "19:30" },
  wegfall: { von: "2026-12-02", bis: "2026-12-16", wochentage: [3], anzahl: 3 },
};

const BEISPIELE: { e: LinkBenachrichtigung; neu: boolean; amLink: boolean }[] = [
  { e: { id: "1", ereignis: "neues_spiel", termin_id: "t1", erstellt: 3, erstellt_tag: "2026-11-18", inhalt: SPIEL }, neu: true, amLink: true },
  { e: { id: "2", ereignis: "ausfall", termin_id: "t2", erstellt: 2, erstellt_tag: "2026-11-18", inhalt: { ...TRAINING, grund: "Halle gesperrt" } }, neu: true, amLink: true },
  { e: { id: "3", ereignis: "ruecknahme", termin_id: "t2", erstellt: 2, erstellt_tag: "2026-11-17", inhalt: TRAINING }, neu: false, amLink: true },
  { e: { id: "4", ereignis: "verlegung", termin_id: "t1", erstellt: 1, erstellt_tag: "2026-11-17", inhalt: { ...SPIEL, datum: "2026-12-06", beginn: "10:00", ende: "11:30" } }, neu: false, amLink: true },
  { e: { id: "5", ereignis: "wegfall", termin_id: "t3", erstellt: 1, erstellt_tag: "2026-11-10", inhalt: TRAINING }, neu: false, amLink: false },
  { e: { id: "6", ereignis: "serie", termin_id: null, erstellt: 1, erstellt_tag: "2026-11-10", inhalt: SERIE }, neu: false, amLink: false },
];

const VORGAENGE: BenachrichtigenVorgang[] = ["neues_spiel", "ausfall", "aendern"];

export function BenachrichtigungDemo() {
  const [an, setAn] = useState<Record<string, boolean>>({ neues_spiel: true, ausfall: true, aendern: true });
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Glocke mit Zähler (<code>IconButton</code>, <code>zahl</code>) - keine neuen, drei neue, ab zehn «9+»
        </p>
        <div className="flex items-center gap-4">
          {[0, 3, 12].map((n) => (
            <IconButton key={n} icon={Bell} zahl={n} label={knopfLabel(n)} />
          ))}
        </div>
      </div>
      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Einträge - je Ereignis eines; neu mit Lozenge, rot nur bei Ausfall und Wegfall; «Zum Termin» nur, solange der Termin am Link steht
        </p>
        <ul className="flex max-w-md flex-col gap-2">
          {BEISPIELE.map((b) => (
            <BenachrichtigungEintrag key={b.e.id} e={b.e} neu={b.neu} heute="2026-11-18" amLink={b.amLink} onZumTermin={() => {}} />
          ))}
        </ul>
      </div>
      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Häkchen im Dialog der Mitglieder (<code>Checkbox</code> mit <code>hinweis</code>) - vorbelegt an, die Zeile darunter je Vorgang
        </p>
        <div className="flex max-w-md flex-col gap-2">
          {VORGAENGE.map((v) => (
            <BenachrichtigenFeld key={v} vorgang={v} checked={an[v]} onChange={(a) => setAn((x) => ({ ...x, [v]: a }))} />
          ))}
        </div>
      </div>
    </div>
  );
}
