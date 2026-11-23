import type { Metadata } from "next";
import { Startseite } from "@/components/start/Startseite";
import { getStartseitenBeispiele, toCardData } from "@/lib/queries/exercises";
import { getUserImRequest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/* Dieselbe Startseite, bewusst aufgerufen (#671 AK 1, Entscheid 4): über das
   Konto-Menü, auch angemeldet. Suchmaschinen kennen sie nur als «/». */
export const metadata: Metadata = {
  title: "Startseite - KiFu",
  robots: { index: false },
  alternates: { canonical: "/" },
};

export default async function StartseiteBewusst() {
  const [user, zeilen] = await Promise.all([getUserImRequest(), getStartseitenBeispiele()]);
  return <Startseite beispiele={zeilen.map(toCardData)} kontoGeloescht={false} angemeldet={user !== null} />;
}
