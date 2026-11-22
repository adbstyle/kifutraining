import type { Metadata } from "next";
import Link from "next/link";
import { Card, Gefahrenzone, SectionMessage } from "@/components/ui";
import { KontoRahmen } from "../KontoRahmen";
import { KontoClient } from "../KontoClient";
import { createClient } from "@/lib/supabase/server";
import { ladeKontoLoeschenInfo } from "@/lib/kern/verein";
import { SPEICHERUNGEN } from "@/lib/browser-speicher";
import { VEREIN_UNSTIMMIG } from "@/lib/verein";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Daten und Konto - KiFu", robots: { index: false } };

/* Konto › Daten und Konto (#662 AK 4): was KiFu im Browser ablegt, und das
   Löschen des Kontos. Die Kurzfassung liest dieselbe Liste wie die Seite
   «Cookies» (lib/browser-speicher.ts), damit beide nie auseinanderlaufen; die
   Einzelheiten stehen dort. */
export default async function KontoDatenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Wie das Löschen des Kontos zum Verein steht (#587): frei, letzte Verwaltung, einzige Person.
  const loeschInfo = user ? await ladeKontoLoeschenInfo(supabase, user.id) : null;

  return (
    <KontoRahmen reiter="daten">
      <Card className="mb-4 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="type-title-large text-on-surface">In deinem Browser</h2>
          <Link
            href="/cookies"
            className="focus-ring type-label-medium shrink-0 rounded-flaeche text-primary underline"
          >
            Alles zu Cookies
          </Link>
        </div>
        <p className="type-body-medium mt-2 text-on-surface-mittel">
          KiFu legt in deinem Browser nur ab, was die Anwendung selbst braucht: nichts für Werbung,
          nichts für Dritte.
        </p>
        <ul className="mt-4">
          {SPEICHERUNGEN.map((s) => s.titel).map((titel) => (
            <li key={titel} className="type-body-medium border-t border-linie py-3 text-on-surface">
              {titel}
            </li>
          ))}
        </ul>
      </Card>

      <Gefahrenzone>
        <h3 className="type-title-medium text-on-surface">Konto löschen</h3>
        <ul className="type-body-medium mt-2 list-disc space-y-1 pl-5 text-on-surface-mittel">
          <li>Öffentliche Übungen bleiben anonymisiert erhalten.</li>
          <li>Private Entwürfe werden samt Feld-Diagramm gelöscht.</li>
          <li>Verbundene KI-Assistenten verlieren ihren Zugang.</li>
        </ul>
        {/* Nur wo das Löschen den Verein trifft (letzte Verwaltung, einzige Person);
            ein Konto ohne Verein hat keinen, und sonst bleibt er unberührt. */}
        {loeschInfo?.ok && loeschInfo.wert.fall !== "frei" && (
          <p className="type-body-small mt-2 text-on-surface-mittel">
            Was mit deinem Verein geschieht, sagt der nächste Schritt.
          </p>
        )}
        <div className="mt-5">
          {/* Ohne die Lage im Verein gäbe es keinen Dialog, der sagt, was mitgeht. */}
          {loeschInfo?.ok ? (
            <KontoClient info={loeschInfo.wert} />
          ) : (
            <SectionMessage appearance="error">{loeschInfo ? loeschInfo.meldung : VEREIN_UNSTIMMIG.info}</SectionMessage>
          )}
        </div>
      </Gefahrenzone>
    </KontoRahmen>
  );
}
