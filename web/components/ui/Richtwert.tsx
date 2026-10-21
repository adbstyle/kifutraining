import { cn } from "@/lib/cn";
import type { LozengeAppearance } from "@/lib/farben";
import { richtwertStufe, richtwertStufeText, type RichtwertStufe } from "@/lib/spiel";
import { Lozenge } from "./Lozenge";

/* Die Spielerzahl eines Spiels gegen seinen Richtwert (Epic #448, #463 AK 7):
   unter der Mindestzahl im Fehlerton, genau die Mindestzahl (knapp) und über
   der Höchstzahl in der Warnung, dazwischen im Erfolg (PO 2026-10-21). Ohne
   Richtwert bleibt die Zahl neutral. Die Farbe trägt es nie allein — die
   Lozenge sagt es in Worten (`richtwertStufeText`). */

const SCHRIFT: Record<RichtwertStufe, string> = {
  unter: "text-error",
  knapp: "text-on-lozenge-warning",
  im: "text-on-lozenge-success",
  ueber: "text-on-lozenge-warning",
};

const LOZENGE: Record<RichtwertStufe, LozengeAppearance> = {
  unter: "danger",
  knapp: "warning",
  im: "success",
  ueber: "warning",
};

/** Die Schriftfarbe einer Zahl gegen den Richtwert; ohne Richtwert keine. */
export function richtwertSchrift(zahl: number, min: number | null, max: number | null): string | undefined {
  const s = richtwertStufe(zahl, min, max);
  return s ? SCHRIFT[s] : undefined;
}

/** Die Bewertung als Lozenge («noch 2 bis Mindestzahl 9»); ohne Richtwert nichts. */
export function RichtwertLozenge({
  zahl,
  min,
  max,
  className,
}: {
  zahl: number;
  min: number | null;
  max: number | null;
  className?: string;
}) {
  const s = richtwertStufe(zahl, min, max);
  if (!s) return null;
  return (
    <Lozenge appearance={LOZENGE[s]} className={cn(className)}>
      {richtwertStufeText(zahl, min, max)}
    </Lozenge>
  );
}
