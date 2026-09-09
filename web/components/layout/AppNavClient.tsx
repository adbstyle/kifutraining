"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserRound, ListChecks, ClipboardList } from "lucide-react";
import { Header } from "@/components/ui";
import type { HeaderNavItem, HeaderAccount } from "@/components/ui";

/* App-Chrome: M3-Header-Navigation als Top-Bar (alle Breakpoints; unter `lg`
   Hamburger → Drawer). Server-Teil (AppNav) liest die Session und reicht den
   Auth-Zustand + die Abmelde-Action durch; Aktiv-Zustand + Routing laufen
   hier pfadbasiert. Die Primär-Aktion „Neue Übung" sitzt im Content-Bereich
   (Katalog + Meine Übungen) wie „Neues Training" im Trainings-Modul — nicht mehr als
   Header-CTA. Anonym dient der Header-CTA nur dem Anmelden; Konto/Meine
   Übungen/Abmelden im Avatar-Menü. */
export function AppNavClient({
  isAuthenticated,
  userEmail,
  imTeamBereich,
  signOutAction,
}: {
  isAuthenticated: boolean;
  userEmail: string | null;
  /** Ist das geöffnete Training ein Team-Training? Der Server schlägt das
   *  nach — der Adresse ist es nicht anzusehen (#156). */
  imTeamBereich: boolean;
  signOutAction: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // „Übungen" aktiv auf Katalog (inkl. vorgefiltertem „Meine Übungen") und
  // Detailseiten. „Meine Übungen" ist derselbe Pool, vorgefiltert (?mine=1).
  const uebungenActive = pathname === "/" || pathname.startsWith("/uebung");

  // „Trainings" aktiv auf Editor, Einzel-/Durchführungs-/Druck-Ansicht und dem
  // Pool (/training… deckt als Präfix auch /trainings ab) — aber NICHT bei
  // einem Team-Training: das gehört dem Team und erscheint in keiner
  // Trainingsübersicht (#156 AK 1/8/9).
  const trainingsActive = pathname.startsWith("/training") && !imTeamBereich;

  // Das Trainings-Modul startet wie der Übungspool im gemeinsamen Pool
  // (öffentliche Trainings + eigene); „Meine Trainings" ist derselbe Pool,
  // vorgefiltert auf die eigenen Trainings.
  const trainingsHref = "/trainings";

  // „Teams" ist ein eigener Navigationspunkt (PO-Entscheid) und nur angemeldet
  // sinnvoll: Teams sind ausschliesslich ihren Mitgliedern sichtbar.
  // Ein geöffnetes Team-Training hält den Team-Bereich aktiv, gleichgültig
  // über welchen Weg es geöffnet wurde — auch per Lesezeichen (AK 10).
  const teamsActive =
    pathname === "/teams" || pathname.startsWith("/team/") || imTeamBereich;

  const nav: HeaderNavItem[] = [
    { label: "Übungen", href: "/", current: uebungenActive },
    { label: "Trainings", href: trainingsHref, current: trainingsActive },
    ...(isAuthenticated
      ? [{ label: "Teams", href: "/teams", current: teamsActive }]
      : []),
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
            onSelect: () => router.push("/?mine=1"),
          },
          {
            label: "Meine Trainings",
            icon: ClipboardList,
            onSelect: () => router.push("/trainings?mine=1"),
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
