"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { AppAblegenAnleitung, AppAblegenEintrag } from "@/components/privat/AppAblegen";
import { AngebotKarte } from "@/components/privat/Angebot";
import { appName, type Geraet } from "@/lib/app-ablegen";
import type { AngebotArt } from "@/lib/angebot";

/* Das Angebot am privaten Link (#698) in jeder Art, der Eintrag «Als App
   ablegen» der Glocken-Ansicht und die Anleitung je Gerät — ohne das eigene
   Gerät. «Nicht jetzt» blendet hier nur aus. Erfundene Namen. */
const ARTEN: { titel: string; art: AngebotArt; einrichten?: boolean; geraet: Geraet }[] = [
  { titel: "Mitteilungen einschalten (abgelegte App, Android ohne Ablegen)", art: "einschalten", geraet: { system: "android", inApp: false } },
  { titel: "Android, der Browser kann ablegen", art: "einschalten", einrichten: true, geraet: { system: "android", inApp: false } },
  { titel: "iPhone oder iPad im Browser", art: "ablegen_ios", geraet: { system: "ios", inApp: false } },
  { titel: "Browser in einer App (WhatsApp, Instagram …)", art: "in_app", geraet: { system: "ios", inApp: true } },
  { titel: "Mitteilungen gesperrt (nach 30 Tagen)", art: "gesperrt", geraet: { system: "android", inApp: false } },
];

export function AppAblegenDemo() {
  const [anleitung, setAnleitung] = useState<Geraet | null>(null);
  const [zu, setZu] = useState<Record<string, boolean>>({});
  return (
    <div className="flex max-w-md flex-col gap-6">
      {ARTEN.map(({ titel, art, einrichten, geraet }) => (
        <div key={titel}>
          <p className="type-label-small mb-2 text-on-surface-mittel">Angebot · {titel}</p>
          {zu[titel] ? (
            <Button type="button" variant="link" onClick={() => setZu({ ...zu, [titel]: false })}>
              Abgelehnt - wieder zeigen
            </Button>
          ) : (
            <AngebotKarte
              art={art}
              vorname="Lena"
              pfad="/abmelden/beispiel"
              einrichten={einrichten}
              onAnnehmen={() => setAnleitung(geraet)}
              onAblehnen={() => setZu({ ...zu, [titel]: true })}
            />
          )}
        </div>
      ))}
      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">Glocken-Ansicht · Als App ablegen (öffnet hier die Anleitung fürs iPhone)</p>
        <AppAblegenEintrag vorname="Lena" onAblegen={() => setAnleitung({ system: "ios", inApp: false })} />
      </div>
      <AppAblegenAnleitung
        open={!!anleitung}
        onClose={() => setAnleitung(null)}
        geraet={anleitung ?? { system: "ios", inApp: false }}
        name={appName("Lena", "FC Wyler")}
      />
    </div>
  );
}
