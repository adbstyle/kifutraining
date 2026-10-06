"use client";

import { useEffect } from "react";
import {
  GESEHEN_EREIGNIS,
  gesehenCookie,
  gesehenImBrowser,
  spaeter,
} from "@/lib/versionen-gesehen";

/* Merkt sich, was die Seite «Versionen» gerade angezeigt hat (#410): den
   Zeitpunkt des neuesten gezeigten Releases. Nur Angezeigtes zählt — zeigt
   die Seite einen älteren Stand, bleibt ein neuerer Release markiert. Danach
   meldet sie es der Seitenleiste, die ihre Markierung sofort abnimmt. */
export function VersionenGesehen({ neueste }: { neueste: string }) {
  useEffect(() => {
    const bisher = gesehenImBrowser();
    if (bisher && !spaeter(neueste, bisher)) return;
    document.cookie = gesehenCookie(neueste);
    window.dispatchEvent(new CustomEvent(GESEHEN_EREIGNIS, { detail: neueste }));
  }, [neueste]);
  return null;
}
