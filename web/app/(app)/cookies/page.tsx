import type { Metadata } from "next";
import { Eigenschaft, Eigenschaften } from "@/components/ui";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { SPEICHERUNGEN } from "@/lib/browser-speicher";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cookies - KiFu" };

/* Was KiFu im Browser speichert, wozu und wie man es verhindert (#409).
   Keine Datenschutzerklärung — die gibt es bewusst nicht —, sondern die Liste
   der Speicherungen aus lib/browser-speicher.ts. Die Seite braucht selbst
   nichts aus dem Browser und steht darum auch dem offen, der Cookies sperrt.
   Sie hängt am Konto (Verweis dort, Brotkrume «Konto › Cookies»); ohne Konto
   steht sie für sich und ist über die Anmeldeseiten erreichbar. */
export default async function CookiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const krumen = user
    ? [{ label: "Konto", href: "/konto" }, { label: "Cookies" }]
    : [{ label: "Cookies" }];
  return (
    <Seitenrahmen breite="3xl" krumen={krumen}>
      <h1 className="sr-only">Cookies</h1>
      <div className="type-body-medium mb-8 flex flex-col gap-3 text-on-surface">
        <p>
          KiFu legt in deinem Browser nur ab, was die Anwendung selbst braucht. Nichts davon dient
          der Werbung oder einer Auswertung, und nichts geht an Dritte.
        </p>
        <p>
          Du kannst diese Cookies in den Einstellungen deines Browsers für ki-fu.ch sperren oder
          löschen. Was dann nicht mehr geht, steht bei jedem Eintrag.
        </p>
      </div>
      <div className="flex flex-col gap-8">
        {SPEICHERUNGEN.map((s) => (
          <Eigenschaften key={s.name} titel={s.titel}>
            <Eigenschaft label="Wozu">{s.zweck}</Eigenschaft>
            <Eigenschaft label="Wie lange">{s.dauer}</Eigenschaft>
            <Eigenschaft label="Ohne">{s.ohne}</Eigenschaft>
            <Eigenschaft label="Name">
              <code className="type-body-small">{s.name}</code>
            </Eigenschaft>
          </Eigenschaften>
        ))}
      </div>
    </Seitenrahmen>
  );
}
