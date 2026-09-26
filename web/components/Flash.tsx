"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/layout/SnackbarKontext";

/** Meldet eine Bestätigung, die über die Adresse in diese Ansicht gereist ist
 *  (etwa `?created=1` nach dem Erstellen), an den Snackbar-Platz. Die Meldung
 *  kann nicht vor dem Wechsel entstehen: Der Platz verwirft beim Pfadwechsel
 *  alles, was auf der alten Ansicht gemeldet wurde.
 *
 *  Danach nimmt sie ihre Parameter aus der Adresse, sonst käme die Bestätigung
 *  beim Neuladen oder über «Zurück» ein zweites Mal (#234). Bewusst über den
 *  Router und nicht per `history.replaceState`: Der zweite Weg spart zwar die
 *  Server-Runde, lässt aber den gespeicherten Seitenstand samt dieser Meldung
 *  am Verlaufseintrag hängen — «Zurück» holte ihn wieder hervor, und mit ihm
 *  die Bestätigung. Rendert nichts. */
export function Flash({ message, param }: { message: string; param: string | readonly string[] }) {
  const melde = useSnackbar();
  const router = useRouter();
  // Der Entwicklungsmodus lässt Effekte doppelt laufen; gemeldet wird einmal.
  const gemeldet = useRef(false);

  useEffect(() => {
    if (gemeldet.current) return;
    gemeldet.current = true;
    melde(message);
    const url = new URL(window.location.href);
    for (const p of typeof param === "string" ? [param] : param) url.searchParams.delete(p);
    router.replace(url.pathname + url.search + url.hash, { scroll: false });
  }, [melde, message, param, router]);

  return null;
}
