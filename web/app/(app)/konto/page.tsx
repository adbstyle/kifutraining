import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { AnzeigenameForm } from "./AnzeigenameForm";
import { KontoRahmen } from "./KontoRahmen";
import { createClient } from "@/lib/supabase/server";
import { getAnzeigenameFuer } from "@/lib/queries/profil";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Profil im Konto - KiFu", robots: { index: false } };

/* Konto › Profil (#662 AK 2): die E-Mail-Adresse zum Lesen, der Anzeigename
   zum Ändern und der Weg zu einem neuen Passwort. Abmelden steht im
   Konto-Menü der Seitenleiste (#661), nicht hier. */
export default async function KontoProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Mit dem schon geholten User direkt, ohne zweites getUser() (Verbrauch #444).
  const anzeigeName = user ? await getAnzeigenameFuer(supabase, user.id) : null;

  return (
    <KontoRahmen reiter="profil">
      <Card className="flex flex-col gap-5 p-6">
        {user?.email && (
          <section aria-labelledby="konto-email">
            <h2 id="konto-email" className="type-title-small text-on-surface">
              E-Mail-Adresse
            </h2>
            <p className="type-body-large mt-1 break-all text-on-surface">{user.email}</p>
            <p className="type-body-small mt-1 text-on-surface-mittel">
              Damit meldest du dich an. Sehen können sie die Mitglieder deiner Teams und die
              Vereinsverwaltung.
            </p>
          </section>
        )}

        {anzeigeName && (
          <div className="border-t border-linie pt-5">
            <AnzeigenameForm aktuell={anzeigeName} />
          </div>
        )}

        {/* Ein Passwort ändert man über denselben Link per E-Mail wie beim
            Vergessen; die Seite steht auch Angemeldeten offen. */}
        <section aria-labelledby="konto-passwort" className="border-t border-linie pt-5">
          <h2 id="konto-passwort" className="type-title-small text-on-surface">
            Passwort
          </h2>
          <p className="type-body-small mt-1 text-on-surface-mittel">
            Ein neues Passwort setzt du über einen Link, den wir dir per E-Mail senden.
          </p>
          <Link
            href="/passwort-vergessen"
            className="focus-ring type-label-medium mt-2 inline-block rounded-flaeche text-primary underline"
          >
            Passwort vergessen?
          </Link>
        </section>
      </Card>
    </KontoRahmen>
  );
}
