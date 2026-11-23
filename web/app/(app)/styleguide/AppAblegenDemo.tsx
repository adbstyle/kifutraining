"use client";

import { useState } from "react";
import { Button, SectionMessage } from "@/components/ui";
import { AppAblegenAnleitung, AppAblegenHinweis, AppAblegenKnopf } from "@/components/privat/AppAblegen";
import { appName, type Geraet } from "@/lib/app-ablegen";

/* «Als App ablegen» am privaten Link (#650) für jedes Gerät, ohne das eigene:
   der Hinweis auf dem iPhone, auf Android und im Browser einer App, der
   ruhige Knopf unter den Terminen und die Anleitung je Gerät. Erfundene Namen. */
const GERAETE: { titel: string; geraet: Geraet }[] = [
  { titel: "iPhone (Safari)", geraet: { system: "ios", inApp: false } },
  { titel: "Android (Chrome)", geraet: { system: "android", inApp: false } },
  { titel: "Browser in einer App (WhatsApp, Instagram …)", geraet: { system: "ios", inApp: true } },
];

export function AppAblegenDemo() {
  const [anleitung, setAnleitung] = useState<Geraet | null>(null);
  const [zu, setZu] = useState<Record<string, boolean>>({});
  return (
    <div className="flex max-w-md flex-col gap-6">
      {GERAETE.map(({ titel, geraet }) => (
        <div key={titel}>
          <p className="type-label-small mb-2 text-on-surface-mittel">Hinweis · {titel}</p>
          {zu[titel] ? (
            <Button type="button" variant="link" onClick={() => setZu({ ...zu, [titel]: false })}>
              Geschlossen - wieder zeigen
            </Button>
          ) : (
            <AppAblegenHinweis
              vorname="Lena"
              geraet={geraet}
              onSchliessen={() => setZu({ ...zu, [titel]: true })}
              onAktion={() => setAnleitung(geraet)}
            />
          )}
        </div>
      ))}
      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">Knopf unter den Terminen (öffnet hier die Anleitung fürs iPhone)</p>
        <div className="flex flex-col">
          <AppAblegenKnopf onClick={() => setAnleitung(GERAETE[0].geraet)} />
        </div>
      </div>
      <AppAblegenAnleitung
        open={!!anleitung}
        onClose={() => setAnleitung(null)}
        geraet={anleitung ?? GERAETE[0].geraet}
        name={appName("Lena", "FC Wyler")}
      />
    </div>
  );
}

/** Eine schliessbare Section Message für den Abschnitt der Section Message. */
export function SchliessbareMeldung() {
  const [zu, setZu] = useState(false);
  if (zu)
    return (
      <Button type="button" variant="link" onClick={() => setZu(false)}>
        Geschlossen - wieder zeigen
      </Button>
    );
  return (
    <SectionMessage onSchliessen={() => setZu(true)} schliessenLabel="Hinweis schliessen">
      Schliessbar: der Icon-Knopf ✕ oben rechts. Wann der Hinweis wiederkommt, bestimmt der Aufrufer.
    </SectionMessage>
  );
}
