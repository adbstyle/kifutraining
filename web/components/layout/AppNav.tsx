import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { AppNavClient } from "./AppNavClient";

/* App-Chrome: Header-Navigation (Top-Bar). Server-Komponente — liest die
   Session, damit Ziele/CTA zum Auth-Zustand passen; Aktiv-Zustand + Routing
   übernimmt der Client-Teil (pfadbasiert). */
export async function AppNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AppNavClient
      isAuthenticated={!!user}
      userEmail={user?.email ?? null}
      signOutAction={signOut}
    />
  );
}
