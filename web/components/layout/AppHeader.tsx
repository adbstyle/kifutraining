import Link from "next/link";
import { Plus, LogOut } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

/* App-Chrome: schlanke Top-Leiste mit Logo + auth-abhängiger Navigation.
   Server-Komponente — liest die Session, damit Links zum Zustand passen.
   (Bewusst keine Navigation-Rail: der Übungspool braucht im MVP nur wenige
   Text-Ziele; die Rail ist für den Planer-lastigen App-Bereich vorgesehen.) */
export async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-30 border-b border-outline-variant bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="focus-ring type-headline-small rounded-[3px] text-on-surface transition-colors hover:text-primary"
        >
          KiFu
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <NavLink href="/meine-uebungen">Meine Übungen</NavLink>
              <ButtonLink href="/neu" variant="filled" size="sm">
                <Plus size={18} strokeWidth={2.5} aria-hidden />
                Übung
              </ButtonLink>
              <NavLink href="/konto">Konto</NavLink>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Abmelden"
                  className="focus-ring type-label-large inline-flex h-9 items-center gap-1.5 rounded-[3px] px-3 text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
                >
                  <LogOut size={18} strokeWidth={2} aria-hidden />
                  <span className="hidden sm:inline">Abmelden</span>
                </button>
              </form>
            </>
          ) : (
            <NavLink href="/login">Anmelden</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring type-label-large rounded-[3px] px-3 py-2 text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
    >
      {children}
    </Link>
  );
}
