"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/* Besucherstatistik über Vercel Web Analytics: zählt Seitenaufrufe nach Pfad,
   Herkunft, Land und Gerät. Legt nichts im Browser ab (kein Cookie, kein
   localStorage) und erkennt Besucher nur über einen täglich wechselnden
   Hash — darum steht sie nicht in lib/browser-speicher.ts.

   Eigene Client-Komponente, weil `beforeSend` eine Funktion ist und das
   Root-Layout als Server-Komponente keine Funktion an den Client reichen kann.

   Die Query-Strings fallen vor dem Senden weg: Sie tragen Suchbegriffe,
   Filter und Weiterleitungsziele (`?q=`, `?redirect=`), die in eine
   Statistik nicht gehören. Pfade dagegen enthalten nur Slugs und UUIDs. */
function ohneQuery(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.search = "";
  return { ...event, url: url.toString() };
}

export function Besucherstatistik() {
  return <Analytics beforeSend={ohneQuery} />;
}
