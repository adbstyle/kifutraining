"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserRound, ListChecks, ClipboardList } from "lucide-react";
import { Header } from "@/components/ui";
import type { HeaderNavItem, HeaderAccount } from "@/components/ui";

/* App-Chrome: M3-Header-Navigation als Top-Bar (alle Breakpoints; unter `lg`
   Hamburger → Drawer). Server-Teil (AppNav) liest die Session und reicht den
   Auth-Zustand + die Abmelde-Action durch; Aktiv-Zustand + Routing laufen
   hier pfadbasiert. Die Primär-Aktion „Neue Übung" sitzt im Content-Bereich
   (Katalog + Meine Übungen) wie „Neuer Plan" beim Planer — nicht mehr als
   Header-CTA. Anonym dient der Header-CTA nur dem Anmelden; Konto/Meine
   Übungen/Abmelden im Avatar-Menü. */
export function AppNavClient({
  isAuthenticated,
  userEmail,
  signOutAction,
}: {
  isAuthenticated: boolean;
  userEmail: string | null;
  signOutAction: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // „Übungen" aktiv auf Katalog, Detailseiten und den eigenen Übungen.
  const uebungenActive =
    pathname === "/" ||
    pathname.startsWith("/uebung") ||
    pathname.startsWith("/meine-uebungen");

  // „Trainingsplaner" aktiv auf Editor, Einzel-/Durchführungs-/Druck-Ansicht
  // und dem Pool.
  const planerActive =
    pathname.startsWith("/plan") || pathname.startsWith("/plaene");

  // Der Planer startet wie der Übungspool im gemeinsamen Pool (öffentliche
  // Pläne + eigene); „Meine Pläne" ist derselbe Pool, vorgefiltert auf die
  // eigenen Pläne.
  const planerHref = "/plaene";

  const nav: HeaderNavItem[] = [
    { label: "Übungen", href: "/", current: uebungenActive },
    { label: "Trainingsplaner", href: planerHref, current: planerActive },
  ];

  const account: HeaderAccount | undefined = isAuthenticated
    ? {
        name: userEmail ?? "Konto",
        email: userEmail ?? undefined,
        // Initialen aus dem Local-Part (vor dem @), sonst entstünde z. B. „A@"
        // bei einzeichigem Local-Part.
        initials: (userEmail?.split("@")[0]?.slice(0, 2).toUpperCase() || "K"),
        items: [
          { label: "Konto", icon: UserRound, onSelect: () => router.push("/konto") },
          {
            label: "Meine Übungen",
            icon: ListChecks,
            onSelect: () => router.push("/meine-uebungen"),
          },
          {
            label: "Meine Pläne",
            icon: ClipboardList,
            onSelect: () => router.push("/plaene?mine=1"),
          },
          { label: "Abmelden", icon: LogOut, danger: true, onSelect: () => signOutAction() },
        ],
      }
    : undefined;

  // Angemeldet: keine Header-CTA — „Neue Übung" lebt im Content-Bereich.
  // Anonym: Anmelden-CTA als Einstieg.
  const cta = isAuthenticated ? undefined : { label: "Anmelden", href: "/login" };

  return <Header nav={nav} account={account} cta={cta} />;
}
