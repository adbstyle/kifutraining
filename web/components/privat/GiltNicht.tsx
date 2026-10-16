import { Link2Off } from "lucide-react";

/* Ein privater Link oder eine Abholadresse, die nicht gilt — erneuert,
   ausgeschaltet, entfernt oder nie vergeben sehen alle gleich aus und nennen
   weder Team noch Spieler:in (#436 AK 10, 11; #438 AK 17, 18). */
export function GiltNicht({ titel, text }: { titel: string; text: string }) {
  return (
    <div className="flex min-h-[70vh] flex-col justify-center gap-4 px-6 py-8">
      <Link2Off size={48} strokeWidth={1.6} className="text-on-surface-mittel" aria-hidden />
      <h1 className="type-headline-small text-on-surface">{titel}</h1>
      <p className="type-body-large text-on-surface-mittel">{text}</p>
    </div>
  );
}
