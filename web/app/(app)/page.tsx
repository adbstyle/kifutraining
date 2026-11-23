import { redirect } from "next/navigation";
import type { AdressParameter } from "@/lib/adresse";
import { UEBUNGEN_PFAD } from "@/lib/navigation";
import Uebungen from "./uebungen/page";

// Server-only Datenzugriff wie der Katalog selbst.
export const dynamic = "force-dynamic";

/* Die Startadresse (#674). Der Übungskatalog liegt neu unter UEBUNGEN_PFAD;
   «/» zeigt ihn bis zur Startseite (#670) weiterhin. Bisher geteilte
   Katalog-Adressen mit Filtern («/?teil=…», «/?mine=1» …) leiten schon jetzt
   samt Abfrage dorthin weiter, damit sie auch nach #670 ankommen. Der
   Hinweis nach «Konto löschen» (`account_deleted`) ist kein Filter und
   bleibt auf «/». */
const KATALOG_PARAMETER = ["teil", "kat", "feld", "form", "typ", "kinder", "q", "fav", "mine", "anzahl", "deleted", "hkat"];

export default async function Startadresse({ searchParams }: { searchParams: Promise<AdressParameter> }) {
  const sp = await searchParams;
  if (KATALOG_PARAMETER.some((k) => sp[k] !== undefined)) {
    const abfrage = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      for (const w of Array.isArray(v) ? v : v === undefined ? [] : [v]) abfrage.append(k, w);
    }
    redirect(`${UEBUNGEN_PFAD}?${abfrage}`);
  }
  return <Uebungen searchParams={Promise.resolve(sp)} />;
}
