import type { ReactNode } from "react";
import { TabNav } from "@/components/ui";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";

/* Der Rahmen der drei Konto-Seiten (#662): Überschrift, Reiter und Brotkrumen.
   Jedes Thema hat seine eigene Adresse, damit es sich für sich anzeigen und
   verlinken lässt (AK 1, AK 5) — die KI-Zugänge und Abos etwa unter
   «Verbindungen». Die Reiter sind Links (`TabNav`), keine Schaltflächen:
   Zurück im Browser führt zum vorigen Thema, und die Warnung vor ungesicherten
   Angaben (#246) fängt den Wechsel ab. Welcher Reiter offen ist, setzt jede
   Seite selbst; der Rahmen liest die Adresse nicht. */
const KONTO_REITER = [
  { id: "profil", label: "Profil", href: "/konto" },
  { id: "verbindungen", label: "Verbindungen", href: "/konto/verbindungen" },
  { id: "daten", label: "Daten und Konto", href: "/konto/daten" },
] as const;

type KontoReiter = (typeof KONTO_REITER)[number]["id"];

export function KontoRahmen({ reiter, children }: { reiter: KontoReiter; children: ReactNode }) {
  const offen = KONTO_REITER.find((r) => r.id === reiter) ?? KONTO_REITER[0];
  // Auf dem Profil ist «Konto» die Seite selbst; sonst führt die Krume dorthin zurück.
  const krumen = reiter === "profil" ? [{ label: "Konto" }] : [{ label: "Konto", href: "/konto" }, { label: offen.label }];
  return (
    <Seitenrahmen breite="2xl" krumen={krumen}>
      <h1 className="type-headline-large mb-4 text-on-surface">Dein Konto</h1>
      <TabNav
        ariaLabel="Bereiche des Kontos"
        className="mb-6"
        items={KONTO_REITER.map((r) => ({ label: r.label, href: r.href, current: r.id === reiter }))}
      />
      {children}
    </Seitenrahmen>
  );
}
