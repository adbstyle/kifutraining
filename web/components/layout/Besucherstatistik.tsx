"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { useParams } from "next/navigation";

/* Besucherstatistik über Vercel Web Analytics: zählt Seitenaufrufe nach Pfad,
   Herkunft, Land und Gerät. Legt nichts im Browser ab (kein Cookie, kein
   localStorage) und erkennt Besucher nur über einen täglich wechselnden
   Hash — darum steht sie nicht in lib/browser-speicher.ts. Eingebunden nur
   auf Production (siehe Root-Layout).

   Eigene Client-Komponente, weil `beforeSend` eine Funktion ist und das
   Root-Layout als Server-Komponente keine Funktion an den Client reichen kann.

   Die Query-Strings fallen vor dem Senden weg: Sie tragen Suchbegriffe,
   Filter und Weiterleitungsziele (`?q=`, `?redirect=`), die in eine
   Statistik nicht gehören. Pfade bekannter Routen enthalten nur Slugs und
   UUIDs; eine unbekannte Adresse dagegen ist beliebiger Text (vertippt,
   eingefügt) und wird gar nicht gezählt. Umschreiben genügte dort nicht:
   Das Skript schickt neben der URL die Route als eigenes Feld (`dp`), an
   `beforeSend` vorbei — und bei Sonderzeichen im Pfad ist diese Route der
   rohe Pfad, weil die Lib die kodierten Parameter nicht wiederfindet. */
function ohneQuery(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.search = "";
  return { ...event, url: url.toString() };
}

function verwerfen(): null {
  return null;
}

export function Besucherstatistik() {
  // Der Parameter heisst wie der Ordner `app/(app)/[...nichtGefunden]`.
  // Analytics registriert `beforeSend` bei jedem Wechsel neu, und zwar vor
  // dem Seitenaufruf derselben Navigation (Effekt-Reihenfolge in der Lib).
  const params = useParams();
  const unbekannt = params != null && "nichtGefunden" in params;
  return <Analytics beforeSend={unbekannt ? verwerfen : ohneQuery} />;
}
