"use client";

import { useEffect } from "react";
import { useVersionen } from "@/components/layout/VersionenKontext";

/* Meldet, was die Seite «Versionen» gerade angezeigt hat (#410): den
   Zeitpunkt des neuesten gezeigten Releases. Nur Angezeigtes zählt — zeigt
   die Seite einen älteren Stand, bleibt ein neuerer Release markiert. */
export function VersionenGesehen({ neueste }: { neueste: string }) {
  const { merkeGesehen } = useVersionen();
  useEffect(() => merkeGesehen(neueste), [neueste, merkeGesehen]);
  return null;
}
