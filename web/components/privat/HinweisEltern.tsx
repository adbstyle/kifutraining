import { KuerzbarerText } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Der Hinweis für Eltern am privaten Link (#590 AK 9, 11) — an Training und
 *  Spiel gleich: unter einer Linie am Fuss der Karte, auf vier Zeilen gekürzt
 *  mit «Ganz lesen», Webadressen als Link. Ohne Hinweis nichts; die
 *  Datenebene liefert an einem ausgefallenen Termin keinen. An einer
 *  gedämpften Karte tritt er mit ihr zurück. */
export function HinweisEltern({ text, gedaempft }: { text: string | null; gedaempft: boolean }) {
  if (!text) return null;
  return (
    <div className="border-t border-linie pt-3">
      <KuerzbarerText
        text={text}
        zeilen={4}
        className={cn("type-body-medium", gedaempft ? "text-on-surface-mittel" : "text-on-surface")}
      />
    </div>
  );
}
