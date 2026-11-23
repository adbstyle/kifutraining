import { cookies } from "next/headers";
import { BEREICH_COOKIE, arbeitsbereichPfad, leseBereich } from "@/lib/bereich";
import { getMeineTeamsImRequest } from "@/lib/queries/teams";
import { getMeinVereinOderWurf } from "@/lib/queries/verein";
import { nachTeamname } from "@/lib/spieler";

/* Der Arbeitsbereich eines angemeldeten Kontos (#671), für «/». Die Regel
   steht rein in `arbeitsbereichPfad` (lib/bereich.ts); hier nur, was der
   Server dafür liest: das Cookie des Wechslers, die eigenen Teams und den
   Verein.

   Beide Abfragen WERFEN bei einem Datenbankfehler (Fehlerseite): Ein
   verschluckter Fehler sähe aus wie «kein Verein» und führte ein Mitglied in
   den Einstieg «Verein gründen». Darum nie `getMeinVerein`. */
export async function getArbeitsbereichPfad(): Promise<string> {
  const [jar, teams, verein] = await Promise.all([cookies(), getMeineTeamsImRequest(), getMeinVereinOderWurf()]);
  const sortiert = [...teams].sort((a, b) => nachTeamname(a.name, b.name));
  return arbeitsbereichPfad(sortiert, verein !== null, leseBereich(jar.get(BEREICH_COOKIE)?.value));
}
