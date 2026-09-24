import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink, Card, Meldung } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import {
  MELDUNG_ANFRAGE_UNBEKANNT,
  MELDUNG_ZUGAENGE_GRENZE,
  grenzeErreicht,
  istAnfrageKennung,
} from "@/lib/mcp/regeln";
import {
  ZUGANG_DARF,
  ZUGANG_DARF_NICHT,
  ZUGANG_ERWEITERUNG,
  ZUGANG_WARNUNG,
} from "@/lib/mcp/umfang";
import { ZustimmungFormular } from "./ZustimmungFormular";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "KI-Assistent verbinden — KiFu",
  robots: { index: false },
};

const MELDUNG_UNVOLLSTAENDIG =
  "Diese Anfrage ist unvollständig. Starte das Verbinden in deinem KI-Client neu.";

/** Wohin es nach dem Erlauben zurückgeht, lesbar: der Host, bei einem eigenen
 *  Schema (`claude://…`) dessen Name. Unlesbares lässt den Satz weg, statt
 *  eine rohe Adresse zu zeigen. */
function ruecksprungZiel(redirectUri: string): string | null {
  try {
    const u = new URL(redirectUri);
    return u.host || u.protocol.replace(/:$/, "") || null;
  } catch {
    return null;
  }
}

/* Die Erlauben-Seite des OAuth-2.1-Servers (Story #142 AK 1–4, AK 11).
 *
 * Supabase Auth leitet den Trainer hierher, wenn ein KI-Client in seinem
 * Namen zugreifen will. Bei offener Client-Registrierung ist diese Seite die
 * EINZIGE Schranke: jeder kann einen Client mit beliebigem Namen anmelden.
 * Darum nennt sie den vollen Umfang (AK 2), warnt vor dem ungeprüften Namen
 * und lässt sich nicht in fremde Seiten einbetten (Header in next.config.ts).
 *
 * Die Anmeldung prüft die Seite selbst, nicht die Middleware: deren Umleitung
 * übernähme nur den Pfad, die `authorization_id` ginge verloren (AK 4). */
export default async function ZustimmungSeite({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string | string[] }>;
}) {
  const sp = await searchParams;
  const id = typeof sp.authorization_id === "string" ? sp.authorization_id : "";

  if (!istAnfrageKennung(id)) {
    return <Kopf titel="KI-Assistent verbinden" meldung={MELDUNG_UNVOLLSTAENDIG} />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // AK 4: erst zur Anmeldung, dann mit derselben Anfrage zurück hierher.
    // Der Login prüft das Ziel mit `sichererRuecksprung`.
    redirect(
      "/login?redirect=" +
        encodeURIComponent("/oauth/consent?authorization_id=" + encodeURIComponent(id)),
    );
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) {
    // Nie `error.message` zeigen: englisch und voller Interna.
    console.error("[ki-zugang] getAuthorizationDetails", error);
    return <Kopf titel="KI-Assistent verbinden" meldung={MELDUNG_ANFRAGE_UNBEKANNT} />;
  }
  // Schon zugestimmt: Supabase nennt direkt die Rücksprung-Adresse (PC 4).
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  // AK 11: Die Grenze früh zeigen, nicht erst nach dem Klick. Lässt sich die
  // Zahl nicht ermitteln, entscheidet die Action — sie prüft ohnehin nochmals.
  const { data: grants } = await supabase.auth.oauth.listGrants();
  const grenze = grants ? grenzeErreicht(grants, data.client.id) : false;

  const clientName = data.client.name?.trim() || "Ein unbenannter Client";
  const ziel = ruecksprungZiel(data.redirect_uri);

  return (
    <>
      <header className="mb-8">
        <p className="type-label-medium text-primary">KiFu</p>
        <h1 className="type-headline-large mt-1 text-on-surface">KI-Assistent verbinden?</h1>
        <p className="type-body-medium mt-2 text-on-surface-mittel">
          <strong className="text-on-surface">{clientName}</strong> möchte in deinem
          Namen auf KiFu zugreifen. Angemeldet als{" "}
          <strong className="break-all text-on-surface">{user.email}</strong>.
          {ziel && (
            <>
              {" "}Nach dem Erlauben geht es zurück zu{" "}
              <strong className="break-all text-on-surface">{ziel}</strong>.
            </>
          )}
        </p>
      </header>

      {/* AK 2: der VOLLE künftige Umfang, auch was erst später dazukommt —
          eine Erweiterung verlangt keine erneute Zustimmung (OoS 4). */}
      <Card className="mb-4 p-6">
        <p className="type-body-medium text-on-surface">
          Ein Zugang darf, was du in KiFu darfst, beschränkt auf die Werkzeuge, die
          KiFu dem Assistenten anbietet:
        </p>
        <ul className="type-body-medium mt-2 list-disc space-y-1 pl-5 text-on-surface-mittel">
          {ZUGANG_DARF.map((z) => (
            <li key={z}>{z}</li>
          ))}
        </ul>
        <p className="type-body-medium mt-4 text-on-surface">Nicht erreichbar:</p>
        <ul className="type-body-medium mt-2 list-disc space-y-1 pl-5 text-on-surface-mittel">
          {ZUGANG_DARF_NICHT.map((z) => (
            <li key={z}>{z}</li>
          ))}
        </ul>
        <p className="type-body-small mt-4 text-on-surface-mittel">{ZUGANG_ERWEITERUNG}</p>
      </Card>

      <p className="type-body-small mb-4 text-on-surface-mittel">{ZUGANG_WARNUNG}</p>

      {grenze && (
        <Meldung tone="fehler" role="status" className="mb-4">
          <p>{MELDUNG_ZUGAENGE_GRENZE}</p>
          <ButtonLink href="/konto" variant="outlined" size="sm" className="mt-3">
            Zum Konto
          </ButtonLink>
        </Meldung>
      )}

      <Card className="p-6">
        <ZustimmungFormular
          authorizationId={id}
          clientName={data.client.name?.trim() ?? ""}
          grenze={grenze}
        />
      </Card>
    </>
  );
}

/** Kopf mit Fehlermeldung — für Anfragen, zu denen es nichts zu erlauben gibt. */
function Kopf({ titel, meldung }: { titel: string; meldung: string }) {
  return (
    <>
      <header className="mb-8">
        <p className="type-label-medium text-primary">KiFu</p>
        <h1 className="type-headline-large mt-1 text-on-surface">{titel}</h1>
      </header>
      <Meldung tone="fehler">{meldung}</Meldung>
    </>
  );
}
