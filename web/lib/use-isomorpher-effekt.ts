import { useEffect, useLayoutEffect } from "react";

/* Layout-Effekt im Browser, gewöhnlicher Effekt auf dem Server. Auf dem Server
   gibt es keinen Layout-Effekt; React warnte sonst bei jedem Ausliefern.
   Gebraucht, wo ein Zustand noch vor dem Zeichnen stehen muss — und vor den
   gewöhnlichen Effekten der Kinder, die ihn lesen. */
export const useIsomorpherEffekt = typeof window === "undefined" ? useEffect : useLayoutEffect;
