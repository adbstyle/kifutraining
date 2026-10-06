import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PFAD_HEADER } from "@/lib/pfad";
import { APP_VERSION, getReleases, neuesteVeroeffentlichung } from "@/lib/releases";
import { GESEHEN_COOKIE, leseGesehen } from "@/lib/versionen-gesehen";
import { getAnzeigenameFuer } from "@/lib/queries/profil";
import { getMeineTeamsImRequest } from "@/lib/queries/teams";
import { getTrainingNavKontext } from "@/lib/queries/trainings";
import { AppNavClient } from "./AppNavClient";

/** Ein geöffnetes Training in der Adresse: `/training/<uuid>` und alles
 *  darunter (Ansehen, Bearbeiten, Durchführen, Fassung, Diagramm). */
const TRAINING_PFAD = /^\/training\/([0-9a-f-]{36})(\/|$)/i;

/* App-Chrome: die Seitenleiste. Server-Komponente — liest die Session, die
   eigenen Teams (Unterpunkte von „Teams"), den Anzeigenamen (Konto-Karte) und
   für die Markierung neuer Versionen die Releases und das Cookie (#410);
   Aktiv-Zustand und Drawer übernimmt der Client-Teil.

   Ein Team-Training liegt zwar unter `/training/…`, gehört aber in den
   Team-Bereich (#156). Ob das der Fall ist, steht am Training und nicht in
   der Adresse — die Zugehörigkeit wird deshalb hier nachgeschlagen. Den Pfad
   liefert die Middleware als Request-Header; `headers()` macht das Layout
   dynamisch, was es durch `auth.getUser()` (liest Cookies) ohnehin schon ist.

   Das gilt nur für den Erstaufbau: Bei einer Client-Navigation rendert Next.js
   das `(app)`-Layout nicht neu, der Wert von hier bliebe also stehen. Für den
   Weg danach meldet das Layout unter `/training/[id]` den Kontext nach —
   siehe `TeamKontext`. Teams und Name werden mit jeder Server Action neu
   gelesen, die `revalidatePath` ruft. */
export async function AppNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pfad = (await headers()).get(PFAD_HEADER) ?? "";
  const trainingId = pfad.match(TRAINING_PFAD)?.[1];

  // Für die Markierung neuer Releases (#410): der neueste veröffentlichte
  // und der zuletzt gesehene. Ohne Releases (GitHub nie erreicht) keine
  // Markierung — die Version steht trotzdem. Läuft parallel zum Rest.
  const releases = getReleases();

  // Nur angemeldet nötig: Teams sieht nur, wer Mitglied ist. Ohne Recht am
  // Training liefert die RLS `null` — die Navigation verrät dann nichts.
  // Scheitert eine der Abfragen, fehlt nur ihr Teil der Leiste, nicht die Seite.
  const [kontext, teams, name] = user
    ? await Promise.all([
        trainingId ? getTrainingNavKontext(trainingId) : null,
        getMeineTeamsImRequest()
          .then((teams) => teams.map(({ id, name }) => ({ id, name })))
          .catch(() => []),
        getAnzeigenameFuer(supabase, user.id).catch(() => null),
      ])
    : [null, [], null];

  const [stand, jar] = await Promise.all([releases, cookies()]);
  const neueste = stand && neuesteVeroeffentlichung(stand.releases);
  const gesehen = leseGesehen(jar.get(GESEHEN_COOKIE)?.value);

  return (
    <AppNavClient
      konto={
        user
          ? {
              // Ohne Namen (Abfrage gescheitert) der Teil vor dem @.
              name: name ?? user.email?.split("@")[0] ?? "Konto",
              email: user.email,
            }
          : null
      }
      teams={teams}
      imTeamBereich={!!kontext?.team}
      version={APP_VERSION}
      neuesteVersion={neueste}
      gesehenVersion={gesehen}
    />
  );
}
