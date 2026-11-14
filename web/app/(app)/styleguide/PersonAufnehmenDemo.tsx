"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, PersonAufnehmen } from "@/components/ui";
import { PERSON_MELDUNG, type PersonSchritt } from "@/lib/verein";
import { useSnackbar } from "@/components/layout/SnackbarKontext";

/* Zwei Arten der Aufnahme mit erfundenen Adressen. «lea@beispiel.test»
   findet eine Person, «frei@beispiel.test» hat schon einen Verein, alles
   andere kennt kein Konto — so zeigt die Demo alle Stufen und Meldungen. */
const GEFUNDEN: Record<string, string> = { "lea@beispiel.test": "Lea Frei" };

async function demoSuche(email: string): Promise<PersonSchritt> {
  await new Promise((r) => setTimeout(r, 300));
  const adresse = email.trim().toLowerCase();
  if (GEFUNDEN[adresse]) return { ok: true, anzeigeName: GEFUNDEN[adresse] };
  if (adresse === "frei@beispiel.test") return { ok: false, meldung: PERSON_MELDUNG.anderer_verein };
  return { ok: false, meldung: PERSON_MELDUNG.nicht_gefunden };
}

export function PersonAufnehmenDemo() {
  const melde = useSnackbar();
  const [offen, setOffen] = useState<"trainer" | "verwaltung" | null>(null);

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outlined" onClick={() => setOffen("trainer")}>
        <Plus size={18} strokeWidth={2} aria-hidden />
        Trainer:in aufnehmen
      </Button>
      <Button variant="outlined" onClick={() => setOffen("verwaltung")}>
        <Plus size={18} strokeWidth={2} aria-hidden />
        Person in die Verwaltung aufnehmen
      </Button>

      <PersonAufnehmen
        offen={offen === "trainer"}
        onClose={() => setOffen(null)}
        titel="Trainer:in aufnehmen"
        einleitung="Die Person braucht ein Konto bei KiFu. Sie ist sofort im Team, ohne Einladung."
        tragweite={[
          "Sie gehört damit zum FC Wyler. Solange sie dabei ist, kann sie keinem anderen Verein beitreten und keinen gründen. Die Vereinsverwaltung und das Trainerteam sehen ihre E-Mail-Adresse. Prüfe, dass es das richtige Konto ist.",
        ]}
        suche={demoSuche}
        aufnahme={demoSuche}
        onAufgenommen={(name) => melde(`${name} ist jetzt im Team.`)}
      />
      <PersonAufnehmen
        offen={offen === "verwaltung"}
        onClose={() => setOffen(null)}
        titel="Person in die Verwaltung aufnehmen"
        einleitung="Die Person braucht ein Konto bei KiFu. Sie ist sofort in der Verwaltung, ohne Annahme."
        tragweite={[
          "Sie gehört damit zum FC Wyler und verwaltet Teams, Spieler:innen und den Verein mit. Solange sie dabei ist, kann sie keinem anderen Verein beitreten und keinen eigenen gründen. Die Verwaltung und die Trainer:innen ihrer Teams sehen ihre E-Mail-Adresse. Prüfe, dass es das richtige Konto ist.",
        ]}
        suche={demoSuche}
        aufnahme={demoSuche}
        onAufgenommen={(name) => melde(`${name} gehört jetzt zur Vereinsverwaltung.`)}
      />
    </div>
  );
}
