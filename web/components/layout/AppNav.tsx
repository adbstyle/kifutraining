import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { PFAD_HEADER } from "@/lib/supabase/middleware";
import { getTrainingNavKontext } from "@/lib/queries/trainings";
import { AppNavClient } from "./AppNavClient";

/** Ein geöffnetes Training in der Adresse: `/training/<uuid>` und alles
 *  darunter (Ansehen, Bearbeiten, Durchführen, Fassung, Diagramm). */
const TRAINING_PFAD = /^\/training\/([0-9a-f-]{36})(\/|$)/i;

/* App-Chrome: Header-Navigation (Top-Bar). Server-Komponente — liest die
   Session, damit Ziele/CTA zum Auth-Zustand passen; Aktiv-Zustand + Routing
   übernimmt der Client-Teil (pfadbasiert).

   Ein Team-Training liegt zwar unter `/training/…`, gehört aber in den
   Team-Bereich (#156). Ob das der Fall ist, steht am Training und nicht in
   der Adresse — die Zugehörigkeit wird deshalb hier nachgeschlagen. Den Pfad
   liefert die Middleware als Request-Header; `headers()` macht das
   Root-Layout dynamisch, was es durch `auth.getUser()` (liest Cookies)
   ohnehin schon ist. */
export async function AppNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pfad = (await headers()).get(PFAD_HEADER) ?? "";
  const trainingId = pfad.match(TRAINING_PFAD)?.[1];
  // Nur angemeldet nötig: Teams sieht nur, wer Mitglied ist. Ohne Recht am
  // Training liefert die RLS `null` — die Navigation verrät dann nichts.
  const kontext =
    user && trainingId ? await getTrainingNavKontext(trainingId) : null;

  return (
    <AppNavClient
      isAuthenticated={!!user}
      userEmail={user?.email ?? null}
      imTeamBereich={!!kontext?.team}
      signOutAction={signOut}
    />
  );
}
