import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { NAV_EXPANDED_COOKIE } from "@/lib/nav";
import { AppNavClient } from "./AppNavClient";

/* App-Chrome: M3-Navigation als Navigation Rail (Tablet/Desktop) bzw.
   Bottom Navigation (Mobil). Server-Komponente — liest die Session, damit
   die Ziele zum Auth-Zustand passen; Aktiv-Zustand + Routing übernimmt der
   Client-Teil (Pfad-basiert). Der Aufklappzustand der Rail steckt in einem
   Cookie, damit schon das Server-Rendering passt (kein Flackern, keine
   Hydration-Diskrepanz). */
export async function AppNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  // Standard: ausgeklappt; nur explizites „0" klappt ein.
  const expanded = cookieStore.get(NAV_EXPANDED_COOKIE)?.value !== "0";

  return (
    <AppNavClient
      isAuthenticated={!!user}
      signOutAction={signOut}
      initialExpanded={expanded}
    />
  );
}
